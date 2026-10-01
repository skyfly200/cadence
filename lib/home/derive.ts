/**
 * Pure derivations the Home screens read from the Life graph. Framework-free.
 *
 * PROVISIONAL: `pickNow` is a simple stand-in (time first, then oldest). It is
 * replaced by the ranking function from feature/now-ranking (ticket 23); the
 * rest of this file (state from the occurrence log, parked items, today's
 * counts) stays.
 */
import { periodWindow, type PeriodOptions } from '../domain/periods';
import type { Commitment, Idea, Node, Occurrence } from '../domain/types';

/** "Not now" shelves an item for this long (ticket 23: until the next card or two hours, whichever is sooner). */
export const SHELF_MS = 2 * 60 * 60 * 1000;
const SHELF_NOTE = 'until:';

/** Occurrences that have not been cancelled, and are not 'undone' records themselves. */
export function liveOccurrences(occs: readonly Occurrence[]): Occurrence[] {
  const cancelled = new Set<string>();
  for (const o of occs) if (o.type === 'undone' && o.undoes) cancelled.add(o.undoes);
  return occs.filter((o) => o.type !== 'undone' && !cancelled.has(o.id));
}

export interface NodeState {
  done: boolean;
  doneAt?: string;
  parked: boolean;
  started: boolean;
  /** ISO time until which a "Not now" keeps the item off the Now card. */
  shelvedUntil?: string;
}

export function nodeState(nodeId: string, occs: readonly Occurrence[]): NodeState {
  const mine = liveOccurrences(occs).filter((o) => o.nodeId === nodeId).sort((a, b) => a.at.localeCompare(b.at));
  const s: NodeState = { done: false, parked: false, started: false };
  for (const o of mine) {
    if (o.type === 'done') { s.done = true; s.doneAt = o.at; }
    else if (o.type === 'parked') s.parked = true;
    else if (o.type === 'started') s.started = true;
    else if (o.type === 'moved' && o.note?.startsWith(SHELF_NOTE)) s.shelvedUntil = o.note.slice(SHELF_NOTE.length);
  }
  return s;
}

export function shelfNote(now: Date): string {
  return `${SHELF_NOTE}${new Date(now.getTime() + SHELF_MS).toISOString()}`;
}

const isCommitment = (n: Node): n is Commitment => n.kind === 'commitment';
const isIdea = (n: Node): n is Idea => n.kind === 'idea';

/** When a Commitment wants attention: its fixed time, else its deadline. */
const when = (c: Commitment): string | null => c.fixedTime ?? c.deadline ?? null;

/** Open Commitments that could be the Now card: not done, not parked, not shelved. */
export function candidates(nodes: readonly Node[], occs: readonly Occurrence[], now: Date): Commitment[] {
  return nodes.filter(isCommitment).filter((c) => {
    if (c.quiet) return false;
    const s = nodeState(c.id, occs);
    if (s.done || s.parked) return false;
    if (s.shelvedUntil && new Date(s.shelvedUntil).getTime() > now.getTime()) return false;
    return true;
  });
}

/** PROVISIONAL ordering: items with a time first (soonest), then the rest oldest first. */
export function pickNow(nodes: readonly Node[], occs: readonly Occurrence[], now: Date, stripSize = 3): { now: Commitment | null; strip: Commitment[] } {
  const ranked = candidates(nodes, occs, now).sort((a, b) => {
    const wa = when(a), wb = when(b);
    if (wa && wb) return wa.localeCompare(wb);
    if (wa) return -1;
    if (wb) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
  return { now: ranked[0] ?? null, strip: ranked.slice(1, 1 + stripSize) };
}

export interface ParkedItem { id: string; title: string; kind: 'idea' | 'commitment'; }

/** The Parking lot: unclassified Ideas plus Commitments the user parked. Newest first. */
export function parkedItems(nodes: readonly Node[], occs: readonly Occurrence[]): ParkedItem[] {
  const out: (ParkedItem & { at: string })[] = [];
  for (const n of nodes) {
    if (isIdea(n)) out.push({ id: n.id, title: n.title, kind: 'idea', at: n.createdAt });
    else if (isCommitment(n) && nodeState(n.id, occs).parked) out.push({ id: n.id, title: n.title, kind: 'commitment', at: n.updatedAt });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...rest }) => rest);
}

/** Commitments finished today (the "Kept earlier" list), most recent first. */
export function keptToday(nodes: readonly Node[], occs: readonly Occurrence[], now: Date, opts: PeriodOptions = {}): { id: string; title: string }[] {
  const day = periodWindow('day', now, opts);
  return nodes
    .filter(isCommitment)
    .map((c) => ({ c, s: nodeState(c.id, occs) }))
    .filter(({ s }) => s.done && s.doneAt && new Date(s.doneAt) >= day.start && new Date(s.doneAt) < day.end)
    .sort((a, b) => b.s.doneAt!.localeCompare(a.s.doneAt!))
    .map(({ c }) => ({ id: c.id, title: c.title }));
}
