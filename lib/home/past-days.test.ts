import { describe, expect, it } from 'vitest';
import { dayInputToAt, pastDays } from './past-days';

const now = new Date(2026, 9, 14, 9, 30); // Wed 14 Oct 2026, local

describe('pastDays', () => {
  it('lists yesterday first, then earlier days, each at local noon', () => {
    const days = pastDays(now, 3);
    expect(days.map((d) => d.key)).toEqual(['2026-10-13', '2026-10-12', '2026-10-11']);
    expect(days[0]!.label).toBe('Yesterday');
    expect(days[1]!.label).toContain('12');
    expect(days.every((d) => d.at.getHours() === 12)).toBe(true);
  });
  it('crosses a month boundary', () => {
    expect(pastDays(new Date(2026, 10, 2, 8), 3).map((d) => d.key)).toEqual(['2026-11-01', '2026-10-31', '2026-10-30']);
  });
});

describe('dayInputToAt', () => {
  it('turns an earlier day into local noon', () => {
    const at = dayInputToAt('2026-10-01', now)!;
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours()]).toEqual([2026, 9, 1, 12]);
  });
  it('records today as now', () => expect(dayInputToAt('2026-10-14', now)).toBe(now));
  it('refuses the future, an empty value and an impossible date', () => {
    expect(dayInputToAt('2026-10-15', now)).toBeNull();
    expect(dayInputToAt('', now)).toBeNull();
    expect(dayInputToAt('2026-02-31', now)).toBeNull();
  });
});
