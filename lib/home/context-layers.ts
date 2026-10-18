/**
 * Layered context for a conversation: what the AI sees each turn, chosen on this device.
 *
 *   Base layer (every turn): the time, today, the next three weeks of the Stack, the Heap, open
 *   Goals and the few memories that best match what is being said.
 *   Lookups (only when the AI asks): memory, items (the whole graph), history (what was done or
 *   moved) and calendar (Google Calendar, when connected). The AI names a layer and a few words;
 *   the browser answers from local data and sends the result with the next call.
 *
 * Framework-free. Private Nodes and Private memories are dropped here, before anything leaves the
 * device; the count of dropped items is reported so the sheet can say so.
 */
import { activeOccurrences, dayKey, isParked } from '../domain';
import type { Commitment, Link, Node, Occurrence } from '../domain';
import { heapItems, keptToday, nodeState, stackDays } from './derive';
import { overlap, rankMemories, searchMemories, words, type Memory } from './memory';
import type { ContextBlock, LookupLayer } from '../../server/utils/discuss';

export const BASE_DAYS = 21;
const MAX_COMING = 40;
const MAX_HEAP = 15;
const MAX_GOALS = 10;
export const BASE_MEMORIES = 8;
const MAX_FOUND = 20;
const HISTORY_DAYS = 60;

export interface GraphData {
  nodes: readonly Node[];
  links: readonly Link[];
  occurrences: readonly Occurrence[];
  memories: readonly Memory[];
}

export interface LayerOpts { now: Date; timeZone: string }

const line = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 200);

function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}
function fmtDay(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

export interface BaseContext {
  blocks: ContextBlock[];
  /** Memories sent this turn, to mark as used. */
  memoryIds: string[];
  /** Private items left out of what was sent. */
  privateExcluded: number;
}

/** The base layer for one turn. `query` is what the person just said (picks the memories). */
export function baseContext(data: GraphData, query: string, opts: LayerOpts): BaseContext {
  const { now, timeZone: tz } = opts;
  const priv = new Set(data.nodes.filter((n) => n.private).map((n) => n.id));
  let privateExcluded = 0;
  const keep = (id: string) => { if (priv.has(id)) { privateExcluded++; return false; } return true; };

  const when = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const blocks: ContextBlock[] = [{ layer: 'now', title: 'Now', lines: [`${when} (${tz})`] }];

  // stackDays also adds days past the window for far-off items; those wait for a lookup.
  const lastKey = dayKey(new Date(now.getTime() + (BASE_DAYS - 1) * 86_400_000), tz);
  const days = stackDays(data.nodes, data.occurrences, now, BASE_DAYS, { timeZone: tz }).filter((d) => d.key <= lastKey);
  const [today, ...later] = days;
  const todayLines = (today?.items ?? []).filter((i) => keep(i.id)).map((i) => line(i.time ? `${fmtTime(i.time, tz)} ${i.title}` : i.title));
  const kept = keptToday(data.nodes, data.occurrences, now, { timeZone: tz }).filter((k) => keep(k.id)).map((k) => line(`done: ${k.title}`));
  blocks.push({ layer: 'today', title: 'Today', lines: [...todayLines, ...kept] });

  const coming: string[] = [];
  for (const d of later) {
    for (const i of d.items) {
      if (!keep(i.id)) continue;
      coming.push(line(`${fmtDay(d.date, tz)}: ${i.time ? `${fmtTime(i.time, tz)} ` : ''}${i.title}`));
    }
  }
  blocks.push({ layer: 'coming_up', title: `Planned for the next ${BASE_DAYS - 1} days`, lines: coming.slice(0, MAX_COMING) });

  const heap = heapItems(data.nodes, data.occurrences, data.links).filter((h) => keep(h.id)).slice(0, MAX_HEAP)
    .map((h) => line(`${h.title}${h.blockedBy.length ? ` (waiting on ${h.blockedBy.map((b) => b.title).join(', ')})` : ''}`));
  blocks.push({ layer: 'heap', title: 'Heap (unsorted, not planned)', lines: heap });

  const goals = data.nodes.filter((n) => n.kind === 'goal' && !nodeState(n.id, data.occurrences).done).filter((g) => keep(g.id)).slice(0, MAX_GOALS).map((g) => line(g.title));
  blocks.push({ layer: 'goals', title: 'Open goals', lines: goals });

  privateExcluded += data.memories.filter((m) => m.private && !m.deleted).length;
  const mems = rankMemories(data.memories, query, BASE_MEMORIES);
  blocks.push({ layer: 'memory', title: 'What Cadence remembers about the person', lines: mems.map((m) => line(m.text)) });

  return { blocks, memoryIds: mems.map((m) => m.id), privateExcluded };
}

function status(n: Node, occs: readonly Occurrence[]): string {
  if (n.kind === 'commitment') {
    if (nodeState(n.id, occs).done) return 'done';
    if (isParked(n.id, occs)) return 'in the heap';
    return 'open';
  }
  if (n.kind === 'goal') return nodeState(n.id, occs).done ? 'done' : 'open';
  return '';
}

function describe(n: Node, occs: readonly Occurrence[], tz: string): string {
  const bits: string[] = [n.kind === 'thing' ? n.thingType : n.kind];
  const s = status(n, occs);
  if (s) bits.push(s);
  if (n.kind === 'commitment') {
    const c = n as Commitment;
    const at = c.fixedTime ?? c.deadline;
    if (at) bits.push(`${c.fixedTime ? 'at' : 'due'} ${dayKey(new Date(at), tz)} ${fmtTime(at, tz)}`);
    else if (c.plannedFor) bits.push(`planned ${c.plannedFor}`);
  }
  if (n.kind === 'habit') bits.push(`${n.recurrence.target} per ${n.recurrence.period.replace('_', ' ')}`);
  if (n.category) bits.push(`tag ${n.category}`);
  const notes = n.notes ? ` | notes: ${n.notes}` : '';
  return line(`${n.title} (${bits.join(', ')})${notes}`);
}

/** Answer a lookup from data on this device. Calendar is fetched separately (calendarBlock). */
export function lookupLayer(layer: Exclude<LookupLayer, 'calendar'>, query: string, data: GraphData, opts: LayerOpts): ContextBlock {
  const { now, timeZone: tz } = opts;
  const q = new Set(words(query));
  const open = data.nodes.filter((n) => !n.private);
  if (layer === 'memory') {
    const found = searchMemories(data.memories, query, MAX_FOUND);
    return { layer, title: `Memories matching "${line(query)}"`, lines: found.map((m) => line(m.text)) };
  }
  if (layer === 'items') {
    const found = open
      .map((n) => ({ n, score: overlap(q, `${n.title} ${n.notes ?? ''} ${n.category ?? ''}`) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.n.updatedAt.localeCompare(a.n.updatedAt))
      .slice(0, MAX_FOUND)
      .map(({ n }) => describe(n, data.occurrences, tz));
    return { layer, title: `Items matching "${line(query)}"`, lines: found };
  }
  // history: what happened over the last 60 days, for matching items (or everything when the query has no words)
  const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString();
  const byId = new Map(open.map((n) => [n.id, n] as const));
  const lines = activeOccurrences(data.occurrences)
    .filter((o) => o.at >= since && o.type !== 'undone' && byId.has(o.nodeId))
    .filter((o) => !q.size || overlap(q, byId.get(o.nodeId)!.title) > 0)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 30)
    .map((o) => line(`${dayKey(new Date(o.at), tz)} ${o.type}: ${byId.get(o.nodeId)!.title}`));
  return { layer, title: `History (last ${HISTORY_DAYS} days)${q.size ? ` for "${line(query)}"` : ''}`, lines };
}

export interface CalendarEvent { summary: string; start: string | null; end: string | null }

/** The 48 hour window a calendar lookup reads: from the start of the named day (YYYY-MM-DD), else today. */
export function calendarWindow(query: string, opts: LayerOpts): { timeMin: string; timeMax: string; day: string } {
  const m = query.match(/\d{4}-\d{2}-\d{2}/);
  const day = m ? m[0] : dayKey(opts.now, opts.timeZone);
  const start = new Date(`${day}T00:00:00`);
  return { timeMin: start.toISOString(), timeMax: new Date(start.getTime() + 47.99 * 3600_000).toISOString(), day };
}

export function calendarBlock(events: readonly CalendarEvent[] | null, day: string, tz: string): ContextBlock {
  if (!events) return { layer: 'calendar', title: 'Calendar', lines: ['The calendar could not be read just now.'] };
  const lines = events.map((e) => line(e.start ? `${dayKey(new Date(e.start), tz)} ${fmtTime(e.start, tz)} ${e.summary}` : `${e.summary} (all day)`));
  return { layer: 'calendar', title: `Calendar from ${day}, two days`, lines };
}
