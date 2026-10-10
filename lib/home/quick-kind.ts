/**
 * One capture box for everything: a typed capture that names a Goal ("goal: finish the projection mapping")
 * or a Habit with how often ("stretch every day", "run twice a week") becomes that, on this device.
 * Pure and deterministic. Anything unclear (a weekday, "every other", no title left) returns null and the
 * capture stays an Idea or a Commitment, as before.
 */
import type { Period } from '../domain';

export type QuickKind =
  | { kind: 'goal'; title: string }
  | { kind: 'habit'; title: string; period: Period; target: number };

const NUMBERS: Record<string, number> = { once: 1, one: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const UNIT: Record<string, Period> = { day: 'day', week: 'week', month: 'month', quarter: 'quarter', year: 'year' };

/** "every day", "daily", "each morning": once a period. */
const EVERY = /\s*,?\s*(?:every|each)\s+(day|morning|evening|night|week|month|quarter|year)$/i;
const LY = /\s*,?\s*(daily|nightly|weekly|monthly|quarterly|yearly|annually)$/i;
/** "twice a week", "3 times a day", "four times per month", "2x a week". */
const TIMES = /\s*,?\s*(once|twice|one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})(?:\s*(?:times|x))?\s+(?:a|an|per|each|every)\s+(day|week|month|quarter|year)$/i;

const LY_PERIOD: Record<string, Period> = { daily: 'day', nightly: 'day', weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year', annually: 'year' };

const tidy = (t: string) => t.replace(/[\s,.;:-]+$/, '').trim();

export function quickKind(text: string): QuickKind | null {
  const t = text.trim();
  const goal = /^goal\s*:\s*(.+)$/is.exec(t);
  if (goal) {
    const title = tidy(goal[1]!);
    return title ? { kind: 'goal', title } : null;
  }
  let m = TIMES.exec(t);
  if (m) {
    const n = NUMBERS[m[1]!.toLowerCase()] ?? Number(m[1]);
    const title = tidy(t.slice(0, m.index));
    return title && n >= 1 && n <= 31 ? { kind: 'habit', title, period: UNIT[m[2]!.toLowerCase()]!, target: n } : null;
  }
  m = EVERY.exec(t);
  if (m) {
    const w = m[1]!.toLowerCase();
    const title = tidy(t.slice(0, m.index));
    return title ? { kind: 'habit', title, period: UNIT[w] ?? 'day', target: 1 } : null;
  }
  m = LY.exec(t);
  if (m) {
    const title = tidy(t.slice(0, m.index));
    return title ? { kind: 'habit', title, period: LY_PERIOD[m[1]!.toLowerCase()]!, target: 1 } : null;
  }
  return null;
}
