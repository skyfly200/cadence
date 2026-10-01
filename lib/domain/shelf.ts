/**
 * "Not now" and "Park" as pure functions over the Occurrence log.
 *
 * How they are recorded (existing Occurrence types only):
 * - **Not now**  = a `moved` Occurrence on the item. Neutral; never a failure.
 * - **Park**     = a `parked` Occurrence on the item. It leaves the candidates.
 * - **Bring back** = an `undone` Occurrence pointing at the `parked` one.
 * - Undoing a Not now = an `undone` pointing at the `moved` one.
 *
 * A Not now shelves the item until the user finishes the next SHELF_CARDS
 * cards or SHELF_HOURS pass, whichever comes first. It is never dropped or
 * buried: the ranking falls back to shelved items when nothing else remains.
 * The fourth Not now on the same item raises the shrink / park / keep offer.
 */
import type { Occurrence } from './types';
import { activeOccurrences } from './estimates';

export const SHELF_HOURS = 2;
/** Cards finished (done or habit logged, on other items) that end a shelf early. */
export const SHELF_CARDS = 2;
/** The Nth Not now on one item raises the shrink / park / keep offer. */
export const SHRINK_PARK_KEEP_AT = 4;

const HOUR_MS = 60 * 60 * 1000;

/** Active (not undone) `moved` Occurrences on an item: its Not now count. */
export function notNowCount(nodeId: string, occs: readonly Occurrence[]): number {
  return activeOccurrences(occs).filter((o) => o.nodeId === nodeId && o.type === 'moved').length;
}

export function offerShrinkParkKeep(nodeId: string, occs: readonly Occurrence[]): boolean {
  return notNowCount(nodeId, occs) >= SHRINK_PARK_KEEP_AT;
}

/** An item with an active (not brought back) `parked` Occurrence is in the Parking lot. */
export function isParked(nodeId: string, occs: readonly Occurrence[]): boolean {
  return activeOccurrences(occs).some((o) => o.nodeId === nodeId && o.type === 'parked');
}

/**
 * When the item's latest active Not now happened, if it is still shelved at
 * `now`; otherwise null. Shelved means: less than SHELF_HOURS since the Not
 * now AND fewer than SHELF_CARDS other cards finished since.
 */
export function shelvedSince(nodeId: string, occs: readonly Occurrence[], now: Date): Date | null {
  const active = activeOccurrences(occs);
  const moves = active.filter((o) => o.nodeId === nodeId && o.type === 'moved').map((o) => Date.parse(o.at));
  if (moves.length === 0) return null;
  const since = Math.max(...moves);
  if (now.getTime() - since >= SHELF_HOURS * HOUR_MS) return null;
  const cards = active.filter((o) => (o.type === 'done' || o.type === 'logged')
    && o.nodeId !== nodeId && Date.parse(o.at) > since && Date.parse(o.at) <= now.getTime()).length;
  return cards >= SHELF_CARDS ? null : new Date(since);
}
