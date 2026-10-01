/**
 * Sync for the Life graph tables (cadence_nodes, cadence_links, cadence_occurrences).
 * Called from lib/sync.ts alongside the existing collections; same offline-first
 * rules (no client or session means every call is a no-op for the caller).
 *
 *   nodes        one row per Node: { user_id, id, kind, data jsonb, updated_at }.
 *                Last-writer-wins by the Node's own updatedAt; ties go to the cloud.
 *   links        real columns (type, from_id, to_id, origin, confidence, evidence,
 *                updated_at). Last-writer-wins by updatedAt; ties go to the cloud.
 *   occurrences  append-only. Merge is a union by id; an existing row is never
 *                updated (the table has a trigger that rejects UPDATE), so pushes
 *                use INSERT ... ON CONFLICT DO NOTHING, and nothing here deletes a
 *                row (delete-by-range is a separate, later feature).
 *
 * Deletes for nodes and links follow the existing rule: only ids present at the
 * last pull and now gone locally are deleted remotely, never rows another device
 * created since. There are no foreign keys, so a link may be pushed before (or
 * without) its nodes.
 *
 * Row mapping (DB column names are exactly those in supabase/drafts/0001_graph_core.sql):
 *   Node        -> { kind: node.kind, data: node, updated_at: node.updatedAt }
 *   Link        -> { type, from_id: fromId, to_id: toId, origin, confidence, evidence, updated_at: updatedAt }
 *                  Link types ('part_of') and origins ('proposed_accepted') are already
 *                  snake_case in the domain, so they map one to one. The table has no
 *                  created_at column: on pull, createdAt keeps the local value if the
 *                  link is known locally, otherwise it is set to the row's updated_at.
 *   Occurrence  -> { node_id: nodeId, type, at, source, undoes, note } (created_at is
 *                  the DB default and is not read back; null undoes/note are omitted).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Link, Node, Occurrence } from './domain';
import {
  getGraphNodes, saveGraphNodes,
  getGraphLinks, saveGraphLinks,
  getGraphOccurrences, saveGraphOccurrences,
} from './graph-storage';

export const GRAPH_TABLES = ['nodes', 'links', 'occurrences'] as const;
export const GRAPH_TABLE_NAMES = GRAPH_TABLES.map((t) => `cadence_${t}`);

const PAGE = 1000;   // PostgREST returns at most 1000 rows per request by default
const CHUNK = 500;   // rows per write request

// ── row shapes ──────────────────────────────────────────────

export interface NodeRow { user_id?: string; id: string; kind: string; data: Node; updated_at?: string }
export interface LinkRow {
  user_id?: string; id: string; type: string; from_id: string; to_id: string; origin: string;
  confidence: number; evidence: string[]; updated_at: string;
}
export interface OccurrenceRow {
  user_id?: string; id: string; node_id: string; type: string; at: string; source: string;
  undoes: string | null; note: string | null;
}

// ── pure mapping ────────────────────────────────────────────

export function nodeToRow(userId: string, n: Node): NodeRow {
  return { user_id: userId, id: n.id, kind: n.kind, data: n, updated_at: n.updatedAt };
}
export function nodeFromRow(r: NodeRow): Node {
  return r.data;
}

export function linkToRow(userId: string, l: Link): LinkRow {
  return {
    user_id: userId, id: l.id, type: l.type, from_id: l.fromId, to_id: l.toId, origin: l.origin,
    confidence: l.confidence, evidence: l.evidence, updated_at: l.updatedAt,
  };
}
export function linkFromRow(r: LinkRow, existing?: Link): Link {
  return {
    id: r.id,
    type: r.type as Link['type'],
    fromId: r.from_id,
    toId: r.to_id,
    origin: r.origin as Link['origin'],
    confidence: r.confidence,
    evidence: Array.isArray(r.evidence) ? r.evidence : [],
    createdAt: existing?.createdAt ?? r.updated_at,
    updatedAt: r.updated_at,
  };
}

export function occurrenceToRow(userId: string, o: Occurrence): OccurrenceRow {
  return {
    user_id: userId, id: o.id, node_id: o.nodeId, type: o.type, at: o.at, source: o.source,
    undoes: o.undoes ?? null, note: o.note ?? null,
  };
}
export function occurrenceFromRow(r: OccurrenceRow): Occurrence {
  const o: { -readonly [K in keyof Occurrence]: Occurrence[K] } = {
    id: r.id, nodeId: r.node_id, type: r.type as Occurrence['type'], at: r.at, source: r.source as Occurrence['source'],
  };
  if (r.undoes != null) o.undoes = r.undoes;
  if (r.note != null) o.note = r.note;
  return o;
}

// ── pure merge ──────────────────────────────────────────────

/** Same rule as sync.ts mergeRows: newer wins, ties go to the cloud, an unstamped side loses to a stamped one. */
export function mergeNewest<T extends { id: string }>(local: T[], server: T[], ts: (x: T) => string | null | undefined): T[] {
  const map = new Map<string, T>();
  for (const r of local) map.set(r.id, r);
  for (const s of server) {
    const existing = map.get(s.id);
    if (!existing) { map.set(s.id, s); continue; }
    const lt = ts(existing);
    const st = ts(s);
    let takeServer: boolean;
    if (lt && st) takeServer = st >= lt;
    else if (st && !lt) takeServer = true;
    else if (lt && !st) takeServer = false;
    else takeServer = true;
    if (takeServer) map.set(s.id, s);
  }
  return [...map.values()];
}

/** Union by id. Occurrences are immutable, so a local row is never replaced by a server row with the same id. */
export function mergeOccurrences(local: Occurrence[], server: Occurrence[]): Occurrence[] {
  const map = new Map<string, Occurrence>();
  for (const o of local) map.set(o.id, o);
  for (const o of server) if (!map.has(o.id)) map.set(o.id, o);
  return [...map.values()];
}

// ── baselines (ids on the server at the last pull) ──────────

const baseline: { nodes?: Set<string>; links?: Set<string>; occurrences?: Set<string> } = {};

export function resetGraphBaseline() {
  delete baseline.nodes; delete baseline.links; delete baseline.occurrences;
}

// ── transport ───────────────────────────────────────────────

async function fetchAll<T>(sb: SupabaseClient, table: string, columns: string, userId: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(columns).eq('user_id', userId).order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data || []) as unknown as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
}

export async function pullGraph(sb: SupabaseClient, userId: string): Promise<void> {
  const nodeRows = await fetchAll<NodeRow>(sb, 'cadence_nodes', 'id,kind,data', userId);
  baseline.nodes = new Set(nodeRows.map((r) => r.id));
  saveGraphNodes(mergeNewest(getGraphNodes(), nodeRows.map(nodeFromRow), (n) => n.updatedAt));

  const linkRows = await fetchAll<LinkRow>(sb, 'cadence_links', 'id,type,from_id,to_id,origin,confidence,evidence,updated_at', userId);
  baseline.links = new Set(linkRows.map((r) => r.id));
  const localLinks = getGraphLinks();
  const known = new Map(localLinks.map((l) => [l.id, l]));
  saveGraphLinks(mergeNewest(localLinks, linkRows.map((r) => linkFromRow(r, known.get(r.id))), (l) => l.updatedAt));

  const occRows = await fetchAll<OccurrenceRow>(sb, 'cadence_occurrences', 'id,node_id,type,at,source,undoes,note', userId);
  baseline.occurrences = new Set(occRows.map((r) => r.id));
  saveGraphOccurrences(mergeOccurrences(getGraphOccurrences(), occRows.map(occurrenceFromRow)));
}

async function pushUpserts(sb: SupabaseClient, table: string, rows: object[]) {
  for (const part of chunks(rows)) {
    const { error } = await sb.from(table).upsert(part, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
}

async function pushDeletes(sb: SupabaseClient, table: string, userId: string, base: Set<string> | undefined, localIds: Set<string>) {
  if (!base) return;
  const toDelete = [...base].filter((id) => !localIds.has(id));
  if (!toDelete.length) return;
  const { error } = await sb.from(table).delete().eq('user_id', userId).in('id', toDelete);
  if (error) throw error;
}

export async function pushGraph(sb: SupabaseClient, userId: string): Promise<void> {
  // Nodes and links: upsert everything, then delete only what was on the server at the last pull and is now gone locally.
  const nodes = getGraphNodes();
  await pushUpserts(sb, 'cadence_nodes', nodes.map((n) => nodeToRow(userId, n)));
  const nodeIds = new Set(nodes.map((n) => n.id));
  await pushDeletes(sb, 'cadence_nodes', userId, baseline.nodes, nodeIds);
  baseline.nodes = nodeIds;

  const links = getGraphLinks();
  await pushUpserts(sb, 'cadence_links', links.map((l) => linkToRow(userId, l)));
  const linkIds = new Set(links.map((l) => l.id));
  await pushDeletes(sb, 'cadence_links', userId, baseline.links, linkIds);
  baseline.links = linkIds;

  // Occurrences: append-only. Insert only ids the server is not known to have, and never update or delete.
  const known = baseline.occurrences ?? new Set<string>();
  const fresh = getGraphOccurrences().filter((o) => !known.has(o.id));
  for (const part of chunks(fresh.map((o) => occurrenceToRow(userId, o)))) {
    const { error } = await sb.from('cadence_occurrences').upsert(part, { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (error) throw error;
  }
  baseline.occurrences = new Set([...known, ...fresh.map((o) => o.id)]);
}
