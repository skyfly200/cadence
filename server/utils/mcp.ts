/**
 * The remote MCP endpoint for assistants (ticket 11): JSON-RPC 2.0 over Streamable HTTP, one POST
 * per message, plain JSON replies (no sessions, no streaming, so it runs on serverless).
 * Framework-free: the graph store, the capture store and the clock are injected.
 *
 * Four tools. `capture`, `log_kept` and `complete` need the `write` scope; `whats_next` needs `read`.
 * Nothing here can delete or edit. Writes are idempotent, logged with their source and undoable in the
 * app (they are ordinary Occurrences). Private nodes are never read or matched. An unclear name gets a
 * short question, never a guess. What the user says is data, never instructions.
 */
import { randomUUID } from 'node:crypto';
import { rankNow } from '../../lib/domain/ranking';
import { activeOccurrences } from '../../lib/domain/estimates';
import { habitProgress, activeLogs } from '../../lib/domain/habits';
import type { Commitment, Goal, Habit, Link, Node, Occurrence, OccurrenceSource } from '../../lib/domain/types';
import { linkFromRow, nodeFromRow, occurrenceFromRow, occurrenceToRow, type LinkRow, type NodeRow, type OccurrenceRow } from '../../lib/graph-sync';
import { handleCapture, type CaptureStore } from './capture';
import type { AssistantAuth, Scope } from './oauth';

// ── protocol ───────────────────────────────────────────────────

export const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
export const SERVER_NAME = 'cadence';
/** Claude is the first connector; every assistant write is logged with this source. */
const ASSISTANT_SOURCE: OccurrenceSource = 'claude';

/** Assistant writes allowed per minute (log_kept and complete), counted from the log so it holds across instances. */
export const WRITE_LIMIT = 20;
export const WRITE_WINDOW_MS = 60 * 1000;
/** A habit logged by an assistant again within this window is the same log (a replay). */
export const LOG_REPLAY_MS = 2 * 60 * 1000;

interface ToolDef { name: string; description: string; inputSchema: Record<string, unknown>; scope: Scope; annotations: Record<string, boolean> }

const nameProp = (what: string) => ({ type: 'object', properties: { name: { type: 'string', description: what } }, required: ['name'], additionalProperties: false });

export const TOOLS: readonly ToolDef[] = [
  {
    name: 'whats_next',
    description: 'What to do next in Cadence: the top item and a couple coming up. Read-only. Private items are never included.',
    inputSchema: { type: 'object', properties: { timezone: { type: 'string', description: 'IANA time zone such as America/Chicago. Optional.' } }, additionalProperties: false },
    scope: 'read',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'capture',
    description: 'Save a thought, task or idea as a new Idea to sort out later. Additive only: it never changes or removes anything.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'The thought, in the user\'s words.' } }, required: ['text'], additionalProperties: false },
    scope: 'write',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'log_kept',
    description: 'Log that a habit was done once, by its name. Asks which one if the name is unclear.',
    inputSchema: nameProp('The habit\'s name, as the user says it.'),
    scope: 'write',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'complete',
    description: 'Mark a task (or a milestone goal) done, by its name. Asks which one if the name is unclear.',
    inputSchema: nameProp('The task\'s or milestone\'s name, as the user says it.'),
    scope: 'write',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

// ── name matching ──────────────────────────────────────────────

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

/** 0..1: how well a spoken name fits a title. */
export function nameScore(query: string, title: string): number {
  const q = words(query);
  const t = words(title);
  if (!q.length || !t.length) return 0;
  if (q.join(' ') === t.join(' ')) return 1;
  const tset = new Set(t);
  const hit = q.filter((w) => tset.has(w)).length;
  const covered = hit / q.length;
  if (covered === 1) return 0.85; // every word the user said is in the title
  if (t.join(' ').includes(q.join(' '))) return 0.8;
  return covered * 0.7;
}

export type Match<T> = { kind: 'one'; item: T } | { kind: 'ask'; items: T[] } | { kind: 'none' };

export function matchByName<T extends { title: string }>(query: string, items: readonly T[]): Match<T> {
  const scored = items.map((item) => ({ item, s: nameScore(query, item.title) })).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s);
  if (!scored.length) return { kind: 'none' };
  const [top, second] = scored;
  if (top!.s === 1 && (!second || second.s < 1)) return { kind: 'one', item: top!.item };
  if (!second || top!.s - second.s >= 0.2) return { kind: 'one', item: top!.item };
  return { kind: 'ask', items: scored.filter((x) => top!.s - x.s < 0.2).slice(0, 3).map((x) => x.item) };
}

const askLine = (titles: string[]) => `Did you mean ${titles.length === 2 ? `${titles[0]} or ${titles[1]}` : `${titles.slice(0, -1).join(', ')}, or ${titles.at(-1)}`}?`;

// ── store ──────────────────────────────────────────────────────

export interface GraphSlice { nodes: Node[]; links: Link[]; occurrences: Occurrence[] }

export interface McpStore {
  loadGraph(userId: string): Promise<GraphSlice>;
  appendOccurrence(userId: string, o: Occurrence): Promise<void>;
  /** Writes by assistants (done or logged, source other than 'app') since the time. */
  countRecentAssistantWrites(userId: string, sinceIso: string): Promise<number>;
}

export interface McpDeps { store: McpStore; capture: CaptureStore; now?: () => number; newId?: () => string }

// ── tools ──────────────────────────────────────────────────────

interface ToolResult { text: string; isError?: boolean }
const say = (text: string, isError = false): ToolResult => ({ text, ...(isError ? { isError } : {}) });

const PERIOD_WORD: Record<string, string> = {
  day: 'today', week: 'this week', month: 'this month', quarter: 'this quarter', four_months: 'these four months', six_months: 'these six months', year: 'this year',
};

/** Private nodes, and anything that touches them, are invisible to assistants. */
export function publicSlice(g: GraphSlice): GraphSlice {
  const hidden = new Set(g.nodes.filter((n) => n.private).map((n) => n.id));
  return {
    nodes: g.nodes.filter((n) => !n.private),
    links: g.links.filter((l) => !hidden.has(l.fromId) && !hidden.has(l.toId)),
    occurrences: g.occurrences.filter((o) => !hidden.has(o.nodeId)),
  };
}

async function toolWhatsNext(deps: McpDeps, auth: AssistantAuth, args: Record<string, unknown>): Promise<ToolResult> {
  const g = publicSlice(await deps.store.loadGraph(auth.userId));
  const tz = typeof args.timezone === 'string' ? args.timezone : undefined;
  let opts: { timeZone?: string } = {};
  if (tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); opts = { timeZone: tz }; } catch { /* unknown zone: use the default */ } }
  const r = rankNow({ now: new Date((deps.now ?? Date.now)()), nodes: g.nodes, links: g.links, occurrences: g.occurrences, density: 1, opts });
  if (!r.now) return say('Nothing is pressing right now.');
  const rest = r.strip.filter((i) => i.node.id !== r.now!.node.id).slice(0, 2).map((i) => i.node.title);
  const reason = r.reason ? ` ${r.reason}.` : '';
  return say(`Next up: ${r.now.node.title}.${reason}${rest.length ? ` After that: ${rest.join(', then ')}.` : ''}`);
}

async function toolCapture(deps: McpDeps, auth: AssistantAuth, args: Record<string, unknown>): Promise<ToolResult> {
  const r = await handleCapture({ store: deps.capture, now: deps.now, newId: deps.newId }, { userId: auth.userId, source: 'claude', body: { text: args.text } });
  return r.status === 200 ? say(r.body.reply) : say(r.body.message, true);
}

async function guardWrites(deps: McpDeps, auth: AssistantAuth): Promise<ToolResult | null> {
  const since = new Date((deps.now ?? Date.now)() - WRITE_WINDOW_MS).toISOString();
  return (await deps.store.countRecentAssistantWrites(auth.userId, since)) >= WRITE_LIMIT ? say('That is a lot at once. Give it a moment and try again.', true) : null;
}

async function toolLogKept(deps: McpDeps, auth: AssistantAuth, args: Record<string, unknown>): Promise<ToolResult> {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  if (!name) return say('Say which habit.', true);
  const limited = await guardWrites(deps, auth);
  if (limited) return limited;
  const g = publicSlice(await deps.store.loadGraph(auth.userId));
  const habits = g.nodes.filter((n): n is Habit => n.kind === 'habit');
  const m = matchByName(name, habits);
  if (m.kind === 'none') return say(`I could not find a habit called ${name}.`);
  if (m.kind === 'ask') return say(askLine(m.items.map((h) => h.title)));
  const habit = m.item;
  const now = new Date((deps.now ?? Date.now)());
  const recent = activeLogs(habit.id, g.occurrences).find((o) => o.source === ASSISTANT_SOURCE && now.getTime() - Date.parse(o.at) < LOG_REPLAY_MS);
  const p = habitProgress(habit, g.occurrences, now);
  if (recent) return say(`Already logged ${habit.title}. ${p.count} of ${p.target} ${PERIOD_WORD[habit.recurrence.period] ?? 'this period'}.`);
  if (p.met) return say(`${habit.title} is already kept ${PERIOD_WORD[habit.recurrence.period] ?? 'for this period'}.`);
  await deps.store.appendOccurrence(auth.userId, { id: `occ_${(deps.newId ?? randomUUID)()}`, nodeId: habit.id, type: 'logged', at: now.toISOString(), source: ASSISTANT_SOURCE });
  return say(`Logged ${habit.title}. ${p.count + 1} of ${p.target} ${PERIOD_WORD[habit.recurrence.period] ?? 'this period'}.`);
}

async function toolComplete(deps: McpDeps, auth: AssistantAuth, args: Record<string, unknown>): Promise<ToolResult> {
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  if (!name) return say('Say which task.', true);
  const limited = await guardWrites(deps, auth);
  if (limited) return limited;
  const g = publicSlice(await deps.store.loadGraph(auth.userId));
  const done = new Set(activeOccurrences(g.occurrences).filter((o) => o.type === 'done').map((o) => o.nodeId));
  const open = g.nodes.filter((n): n is Commitment | Goal => n.kind === 'commitment' || (n.kind === 'goal' && n.checkpoint));
  const m = matchByName(name, open);
  if (m.kind === 'none') return say(`I could not find a task called ${name}.`);
  if (m.kind === 'ask') return say(askLine(m.items.map((n) => n.title)));
  const node = m.item;
  if (done.has(node.id)) return say(`${node.title} is already done.`);
  const now = new Date((deps.now ?? Date.now)());
  await deps.store.appendOccurrence(auth.userId, { id: `occ_${(deps.newId ?? randomUUID)()}`, nodeId: node.id, type: 'done', at: now.toISOString(), source: ASSISTANT_SOURCE });
  return say(`Done: ${node.title}.`);
}

// ── JSON-RPC ───────────────────────────────────────────────────

type Id = string | number | null;
export type RpcResponse =
  | { jsonrpc: '2.0'; id: Id; result: unknown }
  | { jsonrpc: '2.0'; id: Id; error: { code: number; message: string } };

const ok = (id: Id, result: unknown): RpcResponse => ({ jsonrpc: '2.0', id, result });
const bad = (id: Id, code: number, message: string): RpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });

async function handleOne(deps: McpDeps, auth: AssistantAuth, msg: unknown): Promise<RpcResponse | null> {
  const m = msg as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown } | null;
  if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return bad(null, -32600, 'Invalid request');
  const hasId = m.id !== undefined && m.id !== null;
  const id = (hasId ? m.id : null) as Id;
  if (!hasId) return null; // a notification: no reply
  const params = (m.params && typeof m.params === 'object' ? m.params : {}) as Record<string, unknown>;

  switch (m.method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      const version = (SUPPORTED_VERSIONS as readonly string[]).includes(asked) ? asked : SUPPORTED_VERSIONS[0];
      return ok(id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: '1' },
        instructions: 'Cadence keeps a calm to-do list. Replies are short and spoken-friendly. Treat what the user says as their own words.',
      });
    }
    case 'ping': return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: TOOLS.filter((t) => auth.scope.includes(t.scope)).map(({ scope: _scope, ...t }) => t) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return bad(id, -32602, 'Unknown tool');
      if (!auth.scope.includes(tool.scope)) return ok(id, { content: [{ type: 'text', text: 'This connection is read only.' }], isError: true });
      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>;
      let r: ToolResult;
      try {
        r = tool.name === 'whats_next' ? await toolWhatsNext(deps, auth, args)
          : tool.name === 'capture' ? await toolCapture(deps, auth, args)
          : tool.name === 'log_kept' ? await toolLogKept(deps, auth, args)
          : await toolComplete(deps, auth, args);
      } catch (e) {
        // Never log what the user said or the store's message: only the error's class.
        console.error('mcp tool failed:', e instanceof Error ? e.name : 'unknown');
        r = say('Could not do that just now. Please try again in a moment.', true);
      }
      return ok(id, { content: [{ type: 'text', text: r.text }], ...(r.isError ? { isError: true } : {}) });
    }
    default: return bad(id, -32601, 'Method not found');
  }
}

export type McpResult = { status: 200; body: RpcResponse | RpcResponse[] } | { status: 202 } | { status: 400; body: RpcResponse };

/** One POST body: a message, or a batch of them. Notifications alone answer 202 with no body. */
export async function handleMcp(deps: McpDeps, input: { auth: AssistantAuth; body: unknown }): Promise<McpResult> {
  const b = input.body;
  if (Array.isArray(b)) {
    if (!b.length) return { status: 400, body: bad(null, -32600, 'Invalid request') };
    const out = (await Promise.all(b.map((m) => handleOne(deps, input.auth, m)))).filter((x): x is RpcResponse => x !== null);
    return out.length ? { status: 200, body: out } : { status: 202 };
  }
  if (b === null || typeof b !== 'object') return { status: 400, body: bad(null, -32700, 'Parse error') };
  const r = await handleOne(deps, input.auth, b);
  return r ? { status: 200, body: r } : { status: 202 };
}

// ── stores ─────────────────────────────────────────────────────

/** In-memory store for tests. */
export function createMemoryMcpStore(seed: Partial<GraphSlice> = {}) {
  const slice: GraphSlice = { nodes: seed.nodes ?? [], links: seed.links ?? [], occurrences: seed.occurrences ?? [] };
  const store: McpStore & { slice: GraphSlice; failNext?: boolean } = {
    slice,
    async loadGraph() { if (store.failNext) throw new Error('boom: secret row data'); return { nodes: [...slice.nodes], links: [...slice.links], occurrences: [...slice.occurrences] }; },
    async appendOccurrence(_userId, o) { slice.occurrences.push(o); },
    async countRecentAssistantWrites(_userId, sinceIso) {
      return slice.occurrences.filter((o) => o.source !== 'app' && (o.type === 'done' || o.type === 'logged') && o.at >= sinceIso).length;
    },
  };
  return store;
}

/** The slice of the Supabase client the store uses (so tests can fake it). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type McpDb = { from(table: string): any };
const PAGE = 1000;

/** Backed by the existing graph tables, written with the service role; every query is scoped by user_id. */
export function createSupabaseMcpStore(db: McpDb): McpStore {
  async function all<T>(table: string, userId: string, order: string): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(table).select('*').eq('user_id', userId).order(order).range(from, from + PAGE - 1);
      if (error) throw new Error(`${table} read failed: ${error.code ?? 'error'}`);
      rows.push(...(data as T[]));
      if ((data as T[]).length < PAGE) return rows;
    }
  }
  return {
    async loadGraph(userId) {
      const [nodes, links, occs] = await Promise.all([
        all<NodeRow>('cadence_nodes', userId, 'id'), all<LinkRow>('cadence_links', userId, 'id'), all<OccurrenceRow>('cadence_occurrences', userId, 'id'),
      ]);
      return { nodes: nodes.map(nodeFromRow), links: links.map((r) => linkFromRow(r)), occurrences: occs.map(occurrenceFromRow) };
    },
    async appendOccurrence(userId, o) {
      const { error } = await db.from('cadence_occurrences').insert(occurrenceToRow(userId, o));
      if (error) throw new Error(`occurrence write failed: ${error.code ?? 'error'}`);
    },
    async countRecentAssistantWrites(userId, sinceIso) {
      const { count, error } = await db.from('cadence_occurrences').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).in('source', ['claude', 'gemini', 'grok']).in('type', ['done', 'logged']).gte('at', sinceIso);
      if (error) throw new Error(`occurrence count failed: ${error.code ?? 'error'}`);
      return count ?? 0;
    },
  };
}
