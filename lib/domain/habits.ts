/**
 * Habit progress, tapping (log / undo past the target), pinning, the Home
 * "Habits · X of Y today" piece, and the final-stretch rule for longer periods.
 *
 * Design notes
 * - A habit completion is a 'logged' Occurrence. The log is append-only, so
 *   "logging past the target undoes back to zero" is modelled as appending
 *   'undone' Occurrences (each pointing at a log via `undoes`), never deleting.
 *   `habitTap` returns the Occurrences to append; callers own persistence.
 * - Nothing here has a "missed" or "failed" state: a period that ended below
 *   its target is just `met: false` with a smaller `fill`.
 */
import type { Habit, Occurrence, OccurrenceSource } from './types';
import { inWindow, localWeekday, periodProgress, periodWindow, type PeriodOptions, type PeriodWindow } from './periods';

/** A longer-period habit that is still open may be mentioned once from this fraction of its period onward. */
export const FINAL_STRETCH_FROM = 0.8;

const defaultId = () => globalThis.crypto.randomUUID();

export interface HabitProgress {
  window: PeriodWindow;
  count: number;
  target: number;
  met: boolean;
  /** 0..1, count / target, capped. */
  fill: number;
}

/** 'logged' Occurrences of a Habit that have not been undone. */
export function activeLogs(habitId: string, occs: readonly Occurrence[]): Occurrence[] {
  const undone = new Set<string>();
  for (const o of occs) if (o.type === 'undone' && o.undoes) undone.add(o.undoes);
  return occs.filter((o) => o.nodeId === habitId && o.type === 'logged' && !undone.has(o.id));
}

/** Progress of a Habit inside a specific window. */
export function habitProgressIn(habit: Habit, occs: readonly Occurrence[], window: PeriodWindow): HabitProgress {
  const target = Math.max(1, habit.recurrence.target);
  const count = activeLogs(habit.id, occs).filter((o) => inWindow(window, new Date(o.at))).length;
  return { window, count, target, met: count >= target, fill: Math.min(count / target, 1) };
}

/** Progress of a Habit in the current period (the window containing `at`). */
export function habitProgress(habit: Habit, occs: readonly Occurrence[], at: Date, opts: PeriodOptions = {}): HabitProgress {
  return habitProgressIn(habit, occs, periodWindow(habit.recurrence.period, at, opts));
}

/**
 * One tap on a habit. Below the target it appends one 'logged'; at or past the
 * target it appends 'undone' for every active log in the current period, taking
 * the count back to zero. Returns only the Occurrences to append.
 */
export function habitTap(
  habit: Habit,
  occs: readonly Occurrence[],
  at: Date,
  source: OccurrenceSource = 'app',
  newId: () => string = defaultId,
  opts: PeriodOptions = {},
): Occurrence[] {
  const p = habitProgress(habit, occs, at, opts);
  const iso = at.toISOString();
  if (!p.met) return [{ id: newId(), nodeId: habit.id, type: 'logged', at: iso, source }];
  return activeLogs(habit.id, occs)
    .filter((o) => inWindow(p.window, new Date(o.at)))
    .map((log) => ({ id: newId(), nodeId: habit.id, type: 'undone' as const, at: iso, source, undoes: log.id }));
}

/**
 * Is this Habit due today? Quiet (Background) habits never are. A habit pinned
 * to weekdays is due only on those weekdays, whatever its period; an unpinned
 * habit is due today only if its period is a day.
 */
export function isDueToday(habit: Habit, at: Date, opts: PeriodOptions = {}): boolean {
  if (habit.quiet) return false;
  const weekdays = habit.pin?.weekdays;
  if (weekdays && weekdays.length > 0) return weekdays.includes(localWeekday(at, opts));
  return habit.recurrence.period === 'day';
}

export interface HomeHabitsPiece {
  done: number;
  total: number;
  habits: { habit: Habit; done: boolean }[];
}

/**
 * The small "Habits · X of Y today" piece on Home: day-period habits and
 * anything pinned to today, never quiet ones. A day-period habit is done when
 * its target is met today; a longer-period habit pinned to today is done when
 * its period target is met or it has been logged at least once today.
 */
export function homeHabitsPiece(habits: readonly Habit[], occs: readonly Occurrence[], at: Date, opts: PeriodOptions = {}): HomeHabitsPiece {
  const today = periodWindow('day', at, opts);
  const rows = habits
    .filter((h) => isDueToday(h, at, opts))
    .map((habit) => {
      const own = habitProgress(habit, occs, at, opts);
      const loggedToday = habitProgressIn({ ...habit, recurrence: { period: 'day', target: 1 } }, occs, today).met;
      const done = habit.recurrence.period === 'day' ? own.met : own.met || loggedToday;
      return { habit, done };
    });
  return { done: rows.filter((r) => r.done).length, total: rows.length, habits: rows };
}

/**
 * The final-stretch rule for longer-period habits: a still-open, non-quiet,
 * non-day habit gets at most one gentle mention, once its period is 80% over,
 * and never after the period closes (the window then belongs to the next
 * period). Returns the window key to record as mentioned, or null. Pass keys
 * already mentioned so the same period is never mentioned twice.
 */
export function finalStretchMention(
  habit: Habit,
  occs: readonly Occurrence[],
  at: Date,
  mentionedKeys: readonly string[] = [],
  opts: PeriodOptions = {},
): string | null {
  if (habit.quiet || habit.recurrence.period === 'day') return null;
  const p = habitProgress(habit, occs, at, opts);
  if (p.met) return null;
  if (periodProgress(p.window, at) < FINAL_STRETCH_FROM) return null;
  if (mentionedKeys.includes(p.window.key)) return null;
  return p.window.key;
}
