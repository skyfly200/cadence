/**
 * Reward moments (SPEC section 7, ticket 17). Pure and framework-free.
 *
 * A reward is a short template line in the plain, warm register, a small progress update, the weekly
 * tally, and a soft tone: never points, XP, levels or a streak that can die. "Kept N weeks running" is
 * praise only (see runs.ts) and simply does not appear when a run is broken. A rare small delight is
 * capped to one a day and is never tied to loss. Everything is synchronous so the feedback lands in
 * well under a second, and none of it touches the AI.
 */
import type { Period } from '../domain/types';
import { periodWindow, type PeriodOptions } from '../domain/periods';
import { keptInWindow } from '../domain/tally';
import type { Occurrence } from '../domain/types';

/** The behaviours that earn a reward: the hard-to-start moments, never hours or volume. */
export type Moment = 'habit' | 'start' | 'done' | 'planning' | 'capture';

/** The settings toggles (on by default). The tone is also governed by the device's own tone setting and volume. */
export interface RewardPrefs { lines: boolean; tally: boolean; sound: boolean }
export const DEFAULT_REWARD_PREFS: RewardPrefs = { lines: true, tally: true, sound: true };

/** soft: one short tone; big: two notes, for a slog; none: silent. */
export type Tone = 'none' | 'soft' | 'big';
export interface Reward { text: string; tone: Tone }

const LINES: Record<string, readonly string[]> = {
  habit: ['Logged. That is one more.', 'Kept. Nice and steady.', 'Logged. Well kept.'],
  habitMet: ['Well kept. That one is met.', 'Met. Nicely done.'],
  start: ['Started. The hard part is done.', 'You have begun. That is the part that counts.', 'Underway.'],
  done: ['Done. Nicely done.', 'That is off your plate.', 'Finished. Take a breath.'],
  planning: ['Planning done. Nicely kept.', 'Planning done. That was time well spent.'],
  capture: ['Out of your head and safe.', 'Caught it.', 'Safe with me.'],
  slogStart: ['Two minutes is all this needs. Just begin.', 'Starting the heavy one. That is the hard part.'],
  slogDone: ['That was a slog, and you did it.', 'That one was heavy. It is done.'],
};

/** What is said when coach lines are switched off: just the plain fact. */
const PLAIN: Record<Moment, string> = { habit: 'Logged.', start: 'Started.', done: 'Done.', planning: 'Planning done.', capture: '' };

/** A rare small delight: a warm note, never about loss or what was missed. */
export const DELIGHTS: readonly string[] = [
  'A small gold star, or a walk outside.',
  'Whatever comes next, this part is done.',
  'Good things happen in small steps.',
];

const pickFrom = <T>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.max(0, Math.floor(r * list.length)))]!;
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

const RUN_UNIT: Record<Period, string> = {
  day: 'days', week: 'weeks', month: 'months', quarter: 'quarters', four_months: 'four-month stretches', six_months: 'six-month stretches', year: 'years',
};
/** "Kept 6 weeks running." Praise only: the caller passes a run only when it is two or more periods long. */
export function runPraise(periods: number, period: Period): string {
  return `Kept ${periods} ${RUN_UNIT[period]} running.`;
}

export interface RewardInput {
  moment: Moment;
  prefs: RewardPrefs;
  /** The item is tagged a slog: its own lines and a bigger tone. */
  slog?: boolean;
  /** A habit log that met the period's target. */
  met?: boolean;
  /** A small progress update, e.g. "2 of 3 this week." */
  progress?: string | null;
  /** Kept things this calendar week, after this action. */
  weeklyKept: number;
  /** Praise for a met habit whose run is two or more periods long; null or absent otherwise. */
  run?: { periods: number; period: Period } | null;
  /** The reply the action already has (a capture's "Got it, in the heap."), kept as the plain acknowledgement. */
  ack?: string;
  /** 0..1, picks a line so the same words do not repeat every time. */
  pick: number;
  /** Whether a rare delight is due (see nextDelight). */
  delight: boolean;
}

/** The text and tone for one reward moment. */
export function rewardFor(i: RewardInput): Reward {
  const parts: string[] = [];
  if (i.ack) parts.push(i.ack);
  if (i.prefs.lines) {
    const key = i.slog && i.moment === 'start' ? 'slogStart' : i.slog && i.moment === 'done' ? 'slogDone' : i.moment === 'habit' && i.met ? 'habitMet' : i.moment;
    parts.push(pickFrom(LINES[key]!, i.pick));
  } else if (!i.ack && PLAIN[i.moment]) {
    parts.push(PLAIN[i.moment]);
  }
  if (i.progress) parts.push(i.progress);
  if (i.run && i.run.periods >= 2) parts.push(runPraise(i.run.periods, i.run.period));
  if (i.prefs.tally && i.weeklyKept > 0) parts.push(`${plural(i.weeklyKept, 'thing')} kept this week.`);
  if (i.prefs.lines && i.delight) parts.push(pickFrom(DELIGHTS, (i.pick * 7.31) % 1));
  return { text: parts.join(' '), tone: !i.prefs.sound ? 'none' : i.slog ? 'big' : 'soft' };
}

// ── the rare delight ────────────────────────────────────────

/** How often a delight shows (about one reward in twelve) and the cap per day. */
export const DELIGHT_ODDS = 1 / 12;
export const DELIGHT_PER_DAY = 1;
export interface DelightState { day: string; shown: number }

/** Whether a delight is due now, and the state to keep. A new day resets the cap. */
export function nextDelight(state: DelightState | null, today: string, rand: number): { show: boolean; state: DelightState } {
  const cur: DelightState = state && state.day === today ? state : { day: today, shown: 0 };
  if (cur.shown >= DELIGHT_PER_DAY || rand >= DELIGHT_ODDS) return { show: false, state: cur };
  return { show: true, state: { day: today, shown: cur.shown + 1 } };
}

// ── the end-of-day line ─────────────────────────────────────

/** The line appears from this local hour on (opt-in). */
export const END_OF_DAY_FROM_HOUR = 17;

export interface EndOfDayInput {
  on: boolean;
  occurrences: readonly Occurrence[];
  now: Date;
  /** Day-period habits logged today and how many there are (the "3 of 5" on Home). */
  habitsDone: number;
  habitsTotal: number;
  opts?: PeriodOptions;
}

/** "Here is what you kept today": a good-news line, or null (nothing to say, or switched off). Never mentions anything missed. */
export function endOfDayLine(i: EndOfDayInput): string | null {
  if (!i.on) return null;
  const tz = i.opts?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: tz }).format(i.now));
  if (hour < END_OF_DAY_FROM_HOUR) return null;
  const kept = keptInWindow([...i.occurrences], periodWindow('day', i.now, i.opts));
  if (kept <= 0) return null;
  const habits = i.habitsTotal > 0 && i.habitsDone > 0 ? ` ${i.habitsDone} of ${i.habitsTotal} habits logged.` : '';
  return `Today you kept ${plural(kept, 'thing')}.${habits}`;
}
