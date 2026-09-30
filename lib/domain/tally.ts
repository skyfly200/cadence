/**
 * The weekly "things kept" tally, derived from the Occurrence log.
 * done, logged and started count as kept. skipped, parked and moved are
 * neutral: they are never counted and never treated as failures. Occurrences
 * that have been undone do not count. ('captured' earns a reward moment per
 * the reinforcement ticket but is not tallied.)
 */
import type { Occurrence, OccurrenceType } from './types';
import { inWindow, periodWindow, type PeriodOptions, type PeriodWindow } from './periods';

export const KEPT_TYPES: readonly OccurrenceType[] = ['done', 'logged', 'started'];

export function isKept(o: Occurrence): boolean {
  return KEPT_TYPES.includes(o.type);
}

/** Kept Occurrences inside a window, ignoring any that were undone. */
export function keptInWindow(occs: readonly Occurrence[], window: PeriodWindow): number {
  const undone = new Set<string>();
  for (const o of occs) if (o.type === 'undone' && o.undoes) undone.add(o.undoes);
  return occs.filter((o) => isKept(o) && !undone.has(o.id) && inWindow(window, new Date(o.at))).length;
}

/** "14 things kept this week": the calendar week containing `at`. */
export function weeklyKept(occs: readonly Occurrence[], at: Date, opts: PeriodOptions = {}): number {
  return keptInWindow(occs, periodWindow('week', at, opts));
}
