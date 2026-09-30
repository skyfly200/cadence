/**
 * "Kept N periods running": praise only. A run is shown only when it is two or
 * more met periods long and simply returns null when broken: there is no
 * reset message, no streak that can die, and no failure mark on a period.
 */
import type { Habit, Occurrence } from './types';
import { habitProgressIn, type HabitProgress } from './habits';
import { periodWindow, previousWindow, type PeriodOptions } from './periods';

const MAX_LOOKBACK = 400;

/**
 * Length of the run of consecutive met periods, or null if it is shorter than
 * two. The run counts back from the current period when it is already met;
 * otherwise from the previous one, so an open period never erases a run
 * mid-way.
 */
export function keptRun(habit: Habit, occs: readonly Occurrence[], at: Date, opts: PeriodOptions = {}, maxLookback = MAX_LOOKBACK): number | null {
  let window = periodWindow(habit.recurrence.period, at, opts);
  if (!habitProgressIn(habit, occs, window).met) window = previousWindow(window, opts);
  let run = 0;
  while (run < maxLookback && habitProgressIn(habit, occs, window).met) {
    run += 1;
    window = previousWindow(window, opts);
  }
  return run >= 2 ? run : null;
}

/**
 * The most recent closed periods, newest first. A closed period below its
 * target is just a lighter one (met: false, smaller fill), never a failure.
 */
export function recentPeriods(habit: Habit, occs: readonly Occurrence[], at: Date, count: number, opts: PeriodOptions = {}): HabitProgress[] {
  const out: HabitProgress[] = [];
  let window = previousWindow(periodWindow(habit.recurrence.period, at, opts), opts);
  for (let i = 0; i < count; i++) {
    out.push(habitProgressIn(habit, occs, window));
    window = previousWindow(window, opts);
  }
  return out;
}
