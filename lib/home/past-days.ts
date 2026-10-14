/**
 * The days offered when finishing or logging something for a day that has passed. Pure and
 * framework-free; days are the device's own local days, like the datetime fields in the edit sheet.
 */

export interface PastDay { key: string; label: string; at: Date }

const two = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const noon = (y: number, m: number, d: number) => new Date(y, m, d, 12, 0, 0, 0);

/** Yesterday and the days before it, newest first, each stamped at local noon so it lands inside its own day. */
export function pastDays(now: Date, count = 7): PastDay[] {
  return Array.from({ length: count }, (_, i) => {
    const at = noon(now.getFullYear(), now.getMonth(), now.getDate() - (i + 1));
    const label = i === 0 ? 'Yesterday' : at.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
    return { key: keyOf(at), label, at };
  });
}

/** A 'YYYY-MM-DD' date input as the moment to record, or null if it is empty, malformed or after today. Today is recorded as now. */
export function dayInputToAt(value: string, now: Date): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const at = noon(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (keyOf(at) !== value) return null;
  const today = keyOf(now);
  if (value === today) return now;
  return value < today ? at : null;
}
