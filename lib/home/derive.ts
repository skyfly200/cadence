/**
 * Pure derivations the Home screens read from the Life graph. Framework-free.
 * Ordering and shelving ("Not now", Park) live in lib/domain/ranking.ts and
 * shelf.ts; this file only reads the log for the Heap, the Stack and the day's
 * finished items.
 */
import { activeOccurrences, dayKey, isParked, periodWindow } from '../domain';
import type { Commitment, Idea, Node, Occurrence, PeriodOptions } from '../domain';

export interface NodeState {
  done: boolean;
  doneAt?: string;
  started: boolean;
}

export function nodeState(nodeId: string, occs: readonly Occurrence[]): NodeState {
  const mine = activeOccurrences(occs).filter((o) => o.nodeId === nodeId).sort((a, b) => a.at.localeCompare(b.at));
  const s: NodeState = { done: false, started: false };
  for (const o of mine) {
    if (o.type === 'done') { s.done = true; s.doneAt = o.at; }
    else if (o.type === 'started') s.started = true;
  }
  return s;
}

/** The 'undone' records that cancel every still-standing 'started' on a node (empty if it is not started). */
export function stopRecords<T>(nodeId: string, occs: readonly Occurrence[], make: (nodeId: string, undoes: string) => T): T[] {
  return activeOccurrences(occs).filter((o) => o.nodeId === nodeId && o.type === 'started').map((o) => make(nodeId, o.id));
}

const isCommitment = (n: Node): n is Commitment => n.kind === 'commitment';
const isIdea = (n: Node): n is Idea => n.kind === 'idea';

export interface HeapItem { id: string; title: string; kind: 'idea' | 'commitment'; }

/** The Heap: unclassified Ideas plus Commitments the user parked. Newest first. */
export function heapItems(nodes: readonly Node[], occs: readonly Occurrence[]): HeapItem[] {
  const out: (HeapItem & { at: string })[] = [];
  for (const n of nodes) {
    if (isIdea(n)) out.push({ id: n.id, title: n.title, kind: 'idea', at: n.createdAt });
    else if (isCommitment(n) && isParked(n.id, occs)) out.push({ id: n.id, title: n.title, kind: 'commitment', at: n.updatedAt });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...rest }) => rest);
}

/** Commitments finished today (the "Accomplished earlier" list), most recent first. */
export function keptToday(nodes: readonly Node[], occs: readonly Occurrence[], now: Date, opts: PeriodOptions = {}): { id: string; title: string }[] {
  const day = periodWindow('day', now, opts);
  return nodes
    .filter(isCommitment)
    .map((c) => ({ c, s: nodeState(c.id, occs) }))
    .filter(({ s }) => s.done && s.doneAt && new Date(s.doneAt) >= day.start && new Date(s.doneAt) < day.end)
    .sort((a, b) => b.s.doneAt!.localeCompare(a.s.doneAt!))
    .map(({ c }) => ({ id: c.id, title: c.title }));
}

export interface StackItem { id: string; title: string; time: string | null; }
export interface StackDay { key: string; date: Date; items: StackItem[]; }

/**
 * The Stack: open, unparked Commitments laid out over `days` local days starting today. A fixed time or
 * deadline places an item on its day; otherwise the day the user planned it for; an item with neither
 * sits on today. Overdue items are shown on today. Within a day: timed items first, by time.
 */
export function stackDays(nodes: readonly Node[], occs: readonly Occurrence[], now: Date, days = 7, opts: PeriodOptions = {}): StackDay[] {
  const tz = opts.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = dayKey(now, tz);
  const out: StackDay[] = Array.from({ length: days }, (_, i) => {
    const date = new Date(now.getTime() + i * 86_400_000);
    return { key: dayKey(date, tz), date, items: [] };
  });
  const byKey = new Map(out.map((d) => [d.key, d] as const));
  for (const c of nodes.filter(isCommitment)) {
    if (isParked(c.id, occs) || nodeState(c.id, occs).done) continue;
    const at = c.fixedTime ?? c.deadline ?? null;
    let key = at ? dayKey(new Date(at), tz) : (c.plannedFor ?? today);
    if (key < today) key = today;
    const day = byKey.get(key);
    if (!day) continue;
    day.items.push({ id: c.id, title: c.title, time: at });
  }
  for (const d of out) d.items.sort((a, b) => (a.time ?? '￿').localeCompare(b.time ?? '￿'));
  return out;
}
