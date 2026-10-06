/**
 * Pure derivations the Home screens read from the Life graph. Framework-free.
 * Ordering and shelving ("Not now", Park) live in lib/domain/ranking.ts and
 * shelf.ts; this file only reads the log for the Heap, the Stack and the day's
 * finished items.
 */
import { activeOccurrences, dayKey, isParked, periodWindow } from '../domain';
import type { Commitment, Idea, Link, Node, Occurrence, PeriodOptions } from '../domain';
import { openBlockers } from './heap';

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

export interface HeapItem {
  id: string; title: string; kind: 'idea' | 'commitment';
  /** When it arrived in the Heap (for sorting). */
  at: string;
  category: string | null;
  /** The user's own duration if it has one, else the guess. */
  minutes: number | null;
  backlog: boolean;
  /** What it still waits on. */
  blockedBy: { id: string; title: string }[];
}

/** The Heap: unclassified Ideas plus Commitments the user parked. Newest first, backlogged items last. */
export function heapItems(nodes: readonly Node[], occs: readonly Occurrence[], links: readonly Link[] = []): HeapItem[] {
  const blockers = openBlockers(nodes, links, occs);
  const out: HeapItem[] = [];
  for (const n of nodes) {
    const parked = isCommitment(n) && isParked(n.id, occs);
    if (!isIdea(n) && !parked) continue;
    out.push({
      id: n.id, title: n.title, kind: isIdea(n) ? 'idea' : 'commitment', at: isIdea(n) ? n.createdAt : n.updatedAt,
      category: n.category ?? null, minutes: (isCommitment(n) ? n.durationMinutes : null) ?? n.estimateMinutes ?? null,
      backlog: n.backlog === true, blockedBy: blockers.get(n.id) ?? [],
    });
  }
  return out.sort((a, b) => Number(a.backlog) - Number(b.backlog) || b.at.localeCompare(a.at));
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
 * sits on today. Overdue items are shown on today; anything further out gets a day of its own after the week. Within a day: timed items first, by time.
 */
export function stackDays(nodes: readonly Node[], occs: readonly Occurrence[], now: Date, days = 7, opts: PeriodOptions = {}): StackDay[] {
  const tz = opts.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = dayKey(now, tz);
  const out: StackDay[] = Array.from({ length: days }, (_, i) => {
    const date = new Date(now.getTime() + i * 86_400_000);
    return { key: dayKey(date, tz), date, items: [] };
  });
  const byKey = new Map(out.map((d) => [d.key, d] as const));
  const order = new Map<string, number>();
  for (const c of nodes.filter(isCommitment)) {
    if (isParked(c.id, occs) || nodeState(c.id, occs).done) continue;
    const at = c.fixedTime ?? c.deadline ?? null;
    let key = at ? dayKey(new Date(at), tz) : (c.plannedFor ?? today);
    if (key < today) key = today;
    let day = byKey.get(key);
    if (!day) {
      // Scheduled past the week: it gets its own day after the week, so it never vanishes.
      day = { key, date: new Date(`${key}T12:00:00`), items: [] };
      byKey.set(key, day);
      out.push(day);
    }
    day.items.push({ id: c.id, title: c.title, time: at });
    order.set(c.id, c.dayOrder ?? Infinity);
  }
  const rank = (id: string) => order.get(id) ?? Infinity;
  out.sort((a, b) => a.key.localeCompare(b.key));
  for (const d of out) d.items.sort((a, b) => (a.time ?? '￿').localeCompare(b.time ?? '￿') || (rank(a.id) === rank(b.id) ? 0 : rank(a.id) < rank(b.id) ? -1 : 1));
  return out;
}

/** The untimed ids of a day in their new order once `id` is dropped before `beforeId` (or at the end when null or not in the list). */
export function reorderIds(untimedIds: readonly string[], id: string, beforeId: string | null): string[] {
  const rest = untimedIds.filter((x) => x !== id);
  const at = beforeId ? rest.indexOf(beforeId) : -1;
  rest.splice(at < 0 ? rest.length : at, 0, id);
  return rest;
}
