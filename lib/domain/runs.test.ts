import { describe, expect, it } from 'vitest';
import { keptRun, recentPeriods } from './runs';
import { at, habit, occ, UTC } from './test-helpers';

// Weekly x1, Monday-start weeks: Feb 16, Feb 23, Mar 2, Mar 9.
const weekly = habit({ period: 'week', target: 1 });
const log = (iso: string) => occ('logged', iso);

describe('keptRun (praise only)', () => {
  it('counts consecutive met periods, including the current one', () => {
    const occs = [log('2026-02-17T10:00:00Z'), log('2026-02-24T10:00:00Z'), log('2026-03-03T10:00:00Z')];
    expect(keptRun(weekly, occs, at('2026-03-04T12:00:00Z'), UTC)).toBe(3);
  });

  it('a run of one shows nothing', () => {
    expect(keptRun(weekly, [log('2026-03-03T10:00:00Z')], at('2026-03-04T12:00:00Z'), UTC)).toBeNull();
  });

  it('a gap breaks the run silently (null, no reset message)', () => {
    const occs = [log('2026-02-17T10:00:00Z'), log('2026-03-03T10:00:00Z')]; // week of Feb 23 missed
    expect(keptRun(weekly, occs, at('2026-03-04T12:00:00Z'), UTC)).toBeNull();
    // and with the older weeks met but the previous one missed, still nothing
    const older = [log('2026-02-10T10:00:00Z'), log('2026-02-17T10:00:00Z')];
    expect(keptRun(weekly, older, at('2026-03-11T12:00:00Z'), UTC)).toBeNull();
  });

  it('an open current period does not erase a run: it counts from the previous one', () => {
    const occs = [log('2026-02-24T10:00:00Z'), log('2026-03-03T10:00:00Z')];
    // week of Mar 9 is open and unmet, the two before it were met
    expect(keptRun(weekly, occs, at('2026-03-11T12:00:00Z'), UTC)).toBe(2);
  });

  it('respects the lookback cap', () => {
    const occs = [log('2026-02-17T10:00:00Z'), log('2026-02-24T10:00:00Z'), log('2026-03-03T10:00:00Z')];
    expect(keptRun(weekly, occs, at('2026-03-04T12:00:00Z'), UTC, 2)).toBe(2);
  });
});

describe('recentPeriods (quiet close, no failure marks)', () => {
  it('lists closed periods newest first; below-target ones are just lighter', () => {
    const h = habit({ period: 'week', target: 3 });
    const occs = [
      occ('logged', '2026-03-02T10:00:00Z'), occ('logged', '2026-03-03T10:00:00Z'), occ('logged', '2026-03-04T10:00:00Z'), // Mar 2 week: met
      occ('logged', '2026-02-24T10:00:00Z'), // Feb 23 week: 1 of 3
    ];
    const out = recentPeriods(h, occs, at('2026-03-11T12:00:00Z'), 3, UTC);
    expect(out.map((p) => p.window.key)).toEqual(['week:2026-03-02', 'week:2026-02-23', 'week:2026-02-16']);
    expect(out.map((p) => p.met)).toEqual([true, false, false]);
    expect(out[1].fill).toBeCloseTo(1 / 3, 5);
    for (const p of out) {
      expect(p).not.toHaveProperty('failed');
      expect(p).not.toHaveProperty('missed');
    }
  });
});
