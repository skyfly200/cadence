import { describe, expect, it } from 'vitest';
import { isKept, keptInWindow, weeklyKept } from './tally';
import { periodWindow } from './periods';
import { at, occ, UTC } from './test-helpers';

// Week Mon Mar 2 – Sun Mar 8, 2026 (UTC).
const SUN = at('2026-03-08T12:00:00Z');

describe('weekly kept tally', () => {
  it('counts done, logged and started', () => {
    const occs = [
      occ('done', '2026-03-02T10:00:00Z'),
      occ('logged', '2026-03-03T10:00:00Z'),
      occ('started', '2026-03-04T10:00:00Z'),
    ];
    expect(weeklyKept(occs, SUN, UTC)).toBe(3);
  });

  it('skipped, parked, moved (and captured) are neutral: never counted, never failures', () => {
    const kept = [occ('done', '2026-03-02T10:00:00Z'), occ('logged', '2026-03-03T10:00:00Z')];
    const neutral = [
      occ('skipped', '2026-03-04T10:00:00Z'),
      occ('parked', '2026-03-04T11:00:00Z'),
      occ('moved', '2026-03-05T10:00:00Z'),
      occ('captured', '2026-03-05T11:00:00Z'),
    ];
    expect(weeklyKept([...kept, ...neutral], SUN, UTC)).toBe(weeklyKept(kept, SUN, UTC));
    expect(weeklyKept(neutral, SUN, UTC)).toBe(0);
    expect(neutral.some(isKept)).toBe(false);
  });

  it('an undone occurrence does not count', () => {
    const l1 = occ('logged', '2026-03-03T10:00:00Z');
    const l2 = occ('logged', '2026-03-03T11:00:00Z');
    const occs = [l1, l2, occ('undone', '2026-03-03T12:00:00Z', { undoes: l1.id })];
    expect(weeklyKept(occs, SUN, UTC)).toBe(1);
  });

  it('only counts the calendar week containing the date', () => {
    const occs = [
      occ('done', '2026-03-01T23:59:59Z'), // previous week (Sunday)
      occ('done', '2026-03-02T00:00:00Z'),
      occ('done', '2026-03-09T00:00:00Z'), // next week
    ];
    expect(weeklyKept(occs, SUN, UTC)).toBe(1);
  });

  it('the week start is configurable', () => {
    const occs = [occ('done', '2026-03-08T10:00:00Z')]; // a Sunday
    expect(weeklyKept(occs, at('2026-03-04T12:00:00Z'), UTC)).toBe(1); // Monday-start week Mar 2–8 contains Sunday Mar 8
    expect(weeklyKept(occs, at('2026-03-08T12:00:00Z'), { ...UTC, weekStartsOn: 0 })).toBe(1); // Sunday-start week Mar 8–14
    expect(weeklyKept(occs, at('2026-03-04T12:00:00Z'), { ...UTC, weekStartsOn: 0 })).toBe(0); // Sunday-start week Mar 1–7 ends before it
  });

  it('keptInWindow works for any window', () => {
    const occs = [occ('logged', '2026-03-10T10:00:00Z'), occ('logged', '2026-04-10T10:00:00Z')];
    const march = periodWindow('month', at('2026-03-15T00:00:00Z'), UTC);
    expect(keptInWindow(occs, march)).toBe(1);
  });
});
