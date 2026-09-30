import { describe, expect, it } from 'vitest';
import { inWindow, nextWindow, periodProgress, periodWindow, previousWindow } from './periods';
import { at, iso, UTC } from './test-helpers';

const DAY = 24 * 3600 * 1000;
const span = (w: { start: Date; end: Date }) => w.end.getTime() - w.start.getTime();

describe('period boundaries (UTC)', () => {
  it('year: last second of the year and the first instant of the next', () => {
    const w = periodWindow('year', at('2026-12-31T23:59:59Z'), UTC);
    expect(iso(w.start)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(w.end)).toBe('2027-01-01T00:00:00.000Z');
    expect(periodWindow('year', at('2027-01-01T00:00:00Z'), UTC).key).toBe('year:2027-01-01');
  });

  it('quarter: Mar 31 is Q1, Apr 1 is Q2, Sep 30 is Q3', () => {
    expect(iso(periodWindow('quarter', at('2026-03-31T12:00:00Z'), UTC).end)).toBe('2026-04-01T00:00:00.000Z');
    expect(periodWindow('quarter', at('2026-04-01T00:00:00Z'), UTC).key).toBe('quarter:2026-04-01');
    expect(iso(periodWindow('quarter', at('2026-09-30T23:00:00Z'), UTC).end)).toBe('2026-10-01T00:00:00.000Z');
  });

  it('four_months: Jan–Apr, May–Aug, Sep–Dec edges', () => {
    const apr30 = periodWindow('four_months', at('2026-04-30T23:59:59Z'), UTC);
    expect([iso(apr30.start), iso(apr30.end)]).toEqual(['2026-01-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z']);
    const may1 = periodWindow('four_months', at('2026-05-01T00:00:00Z'), UTC);
    expect([iso(may1.start), iso(may1.end)]).toEqual(['2026-05-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z']);
    const aug31 = periodWindow('four_months', at('2026-08-31T23:59:59Z'), UTC);
    expect(aug31.key).toBe('four_months:2026-05-01');
    const sep1 = periodWindow('four_months', at('2026-09-01T00:00:00Z'), UTC);
    expect([iso(sep1.start), iso(sep1.end)]).toEqual(['2026-09-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']);
  });

  it('six_months: Jun 30 is the first half, Jul 1 the second', () => {
    const h1 = periodWindow('six_months', at('2026-06-30T23:59:59Z'), UTC);
    expect([iso(h1.start), iso(h1.end)]).toEqual(['2026-01-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z']);
    const h2 = periodWindow('six_months', at('2026-07-01T00:00:00Z'), UTC);
    expect([iso(h2.start), iso(h2.end)]).toEqual(['2026-07-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']);
  });

  it('leap day: Feb 2028 has 29 days, Feb 2027 has 28, the year 2028 has 366', () => {
    const feb28 = periodWindow('month', at('2028-02-29T12:00:00Z'), UTC);
    expect(iso(feb28.start)).toBe('2028-02-01T00:00:00.000Z');
    expect(span(feb28)).toBe(29 * DAY);
    expect(span(periodWindow('month', at('2027-02-10T00:00:00Z'), UTC))).toBe(28 * DAY);
    expect(span(periodWindow('year', at('2028-06-01T00:00:00Z'), UTC))).toBe(366 * DAY);
    const day = periodWindow('day', at('2028-02-29T05:00:00Z'), UTC);
    expect([iso(day.start), iso(day.end)]).toEqual(['2028-02-29T00:00:00.000Z', '2028-03-01T00:00:00.000Z']);
  });

  it('week starts on Monday by default, or on any configured weekday', () => {
    // 2026-03-08 is a Sunday.
    const monday = periodWindow('week', at('2026-03-08T12:00:00Z'), UTC);
    expect([iso(monday.start), iso(monday.end)]).toEqual(['2026-03-02T00:00:00.000Z', '2026-03-09T00:00:00.000Z']);
    const sunday = periodWindow('week', at('2026-03-08T12:00:00Z'), { ...UTC, weekStartsOn: 0 });
    expect([iso(sunday.start), iso(sunday.end)]).toEqual(['2026-03-08T00:00:00.000Z', '2026-03-15T00:00:00.000Z']);
  });
});

describe('time zones and DST', () => {
  const NY = { timeZone: 'America/New_York' };

  it('spring forward: the local day is 23 hours', () => {
    const w = periodWindow('day', at('2026-03-08T15:00:00Z'), NY);
    expect([iso(w.start), iso(w.end)]).toEqual(['2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z']);
    expect(span(w)).toBe(23 * 3600 * 1000);
  });

  it('fall back: the local day is 25 hours', () => {
    const w = periodWindow('day', at('2026-11-01T15:00:00Z'), NY);
    expect([iso(w.start), iso(w.end)]).toEqual(['2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z']);
    expect(span(w)).toBe(25 * 3600 * 1000);
  });

  it('a week spanning spring forward is one hour short', () => {
    const w = periodWindow('week', at('2026-03-08T15:00:00Z'), NY);
    expect([iso(w.start), iso(w.end)]).toEqual(['2026-03-02T05:00:00.000Z', '2026-03-09T04:00:00.000Z']);
  });

  it('uses the local date: 03:00Z on Jan 1 is still Dec 31 in New York', () => {
    const w = periodWindow('year', at('2026-01-01T03:00:00Z'), NY);
    expect([iso(w.start), iso(w.end)]).toEqual(['2025-01-01T05:00:00.000Z', '2026-01-01T05:00:00.000Z']);
  });

  it('London summer time: the clocks-forward day is 23 hours', () => {
    const w = periodWindow('day', at('2026-03-29T12:00:00Z'), { timeZone: 'Europe/London' });
    expect(span(w)).toBe(23 * 3600 * 1000);
  });
});

describe('navigation and progress', () => {
  it('previous and next windows are contiguous', () => {
    const w = periodWindow('quarter', at('2026-08-15T00:00:00Z'), UTC);
    expect(w.key).toBe('quarter:2026-07-01');
    const prev = previousWindow(w, UTC);
    const next = nextWindow(w, UTC);
    expect(prev.key).toBe('quarter:2026-04-01');
    expect(next.key).toBe('quarter:2026-10-01');
    expect(prev.end.getTime()).toBe(w.start.getTime());
    expect(w.end.getTime()).toBe(next.start.getTime());
  });

  it('inWindow is half-open', () => {
    const w = periodWindow('month', at('2026-04-10T00:00:00Z'), UTC);
    expect(inWindow(w, at('2026-04-01T00:00:00Z'))).toBe(true);
    expect(inWindow(w, at('2026-05-01T00:00:00Z'))).toBe(false);
  });

  it('periodProgress is the elapsed fraction, clamped to 0..1', () => {
    const w = periodWindow('month', at('2026-04-10T00:00:00Z'), UTC); // 30 days
    expect(periodProgress(w, at('2026-04-16T00:00:00Z'))).toBeCloseTo(0.5, 5);
    expect(periodProgress(w, at('2026-03-01T00:00:00Z'))).toBe(0);
    expect(periodProgress(w, at('2026-06-01T00:00:00Z'))).toBe(1);
  });
});
