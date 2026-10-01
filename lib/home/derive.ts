/**
 * Pure derivations the Home screens read from the Life graph. Framework-free.
 * Ordering and shelving ("Not now", Park) live in lib/domain/ranking.ts and
 * shelf.ts; this file only reads the log for the Parking lot and the day's
 * finished items.
 */
import { activeOccurrences, isParked, periodWindow } from '../domain';
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

const isCommitment = (n: Node): n is Commitment => n.kind === 'commitment';
const isIdea = (n: Node): n is Idea => n.kind === 'idea';

export interface ParkedItem { id: string; title: string; kind: 'idea' | 'commitment'; }

/** The Parking lot: unclassified Ideas plus Commitments the user parked. Newest first. */
export function parkedItems(nodes: readonly Node[], occs: readonly Occurrence[]): ParkedItem[] {
  const out: (ParkedItem & { at: string })[] = [];
  for (const n of nodes) {
    if (isIdea(n)) out.push({ id: n.id, title: n.title, kind: 'idea', at: n.createdAt });
    else if (isCommitment(n) && isParked(n.id, occs)) out.push({ id: n.id, title: n.title, kind: 'commitment', at: n.updatedAt });
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
