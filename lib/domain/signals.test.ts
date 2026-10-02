import { describe, expect, it } from 'vitest';
import {
  CHECKPOINT_WEEKS, cameBackAfterBreak, checkpointDue, compareExperiment, firstUse, keptPerWeek, keptTrend, lapsedTimeCritical,
  mechanismVerdict, nudgeHealth, ruleFor, slogUse, triageSpeed, usageRule, wasOn, weeksInUse, type SignalEvent,
} from './signals';
import { at, commitment, occ, UTC } from './test-helpers';

// Weeks start Monday (UTC).
const NOW = at('2026-04-26T12:00:00Z'); // a Sunday; its week starts Apr 20

describe('keptPerWeek, weeksInUse, keptTrend', () => {
  it('counts kept per calendar week, oldest first, ignoring undone and neutral', () => {
    const d = occ('done', '2026-04-21T10:00:00Z', { nodeId: 'a' });
    const occs = [
      d,
      occ('logged', '2026-04-22T10:00:00Z'),
      occ('undone', '2026-04-22T11:00:00Z', { undoes: d.id }),
      occ('parked', '2026-04-23T10:00:00Z'),
      occ('done', '2026-04-14T10:00:00Z'),
    ];
    const s = keptPerWeek(occs, NOW, 3, UTC);
    expect(s.map((w) => w.kept)).toEqual([0, 1, 1]);
    expect(weeksInUse(s)).toBe(2);
  });

  it('trend needs eight finished weeks, then compares the last four with the four before', () => {
    expect(keptTrend(keptPerWeek([], NOW, 6, UTC))).toBe('too_early');
    // n weeks before the current week's Monday (Apr 20), a few kept actions that week.
    const week = (n: number, count: number) => Array.from({ length: count }, (_, i) => occ('done', new Date(Date.parse('2026-04-20T10:00:00Z') - n * 7 * 86400000 + i * 3600000).toISOString()));
    const recentWeeks = [1, 2, 3, 4];
    const olderWeeks = [5, 6, 7, 8];
    const rising = [...recentWeeks.flatMap((n) => week(n, 6)), ...olderWeeks.flatMap((n) => week(n, 2))];
    expect(keptTrend(keptPerWeek(rising, NOW, 9, UTC))).toBe('up');
    const falling = [...recentWeeks.flatMap((n) => week(n, 2)), ...olderWeeks.flatMap((n) => week(n, 6))];
    expect(keptTrend(keptPerWeek(falling, NOW, 9, UTC))).toBe('down');
    const flat = [...recentWeeks, ...olderWeeks].flatMap((n) => week(n, 4));
    expect(keptTrend(keptPerWeek(flat, NOW, 9, UTC))).toBe('steady');
  });
});

describe('cameBackAfterBreak', () => {
  it('finds a kept action after a gap of a week or more, with the gap length', () => {
    const occs = [occ('done', '2026-04-01T10:00:00Z'), occ('done', '2026-04-15T10:00:00Z')];
    expect(cameBackAfterBreak(occs, NOW)).toEqual({ backAt: '2026-04-15T10:00:00Z', gapDays: 14 });
  });
  it('is null with no break, a short gap, or a break older than eight weeks', () => {
    expect(cameBackAfterBreak([occ('done', '2026-04-20T10:00:00Z'), occ('done', '2026-04-24T10:00:00Z')], NOW)).toBeNull();
    expect(cameBackAfterBreak([occ('done', '2025-12-01T10:00:00Z'), occ('done', '2026-01-15T10:00:00Z')], NOW)).toBeNull();
    expect(cameBackAfterBreak([], NOW)).toBeNull();
  });
  it('does not count an undone action as coming back', () => {
    const back = occ('done', '2026-04-15T10:00:00Z');
    const occs = [occ('done', '2026-04-01T10:00:00Z'), back, occ('undone', '2026-04-15T11:00:00Z', { undoes: back.id })];
    expect(cameBackAfterBreak(occs, NOW)).toBeNull();
  });
});

describe('lapsedTimeCritical', () => {
  const dentist = commitment('dentist', { fixedTime: '2026-04-20T10:00:00Z' });
  it('counts a past fixed-time item with nothing recorded', () => {
    expect(lapsedTimeCritical([dentist], [], NOW)).toBe(1);
  });
  it.each(['done', 'moved', 'parked', 'skipped'] as const)('does not count it once %s', (type) => {
    expect(lapsedTimeCritical([dentist], [occ(type, '2026-04-20T11:00:00Z', { nodeId: 'dentist' })], NOW)).toBe(0);
  });
  it('ignores future items, untimed items, and items older than the window', () => {
    const nodes = [
      commitment('future', { fixedTime: '2026-05-01T10:00:00Z' }),
      commitment('untimed'),
      commitment('old', { fixedTime: '2026-01-01T10:00:00Z' }),
    ];
    expect(lapsedTimeCritical(nodes, [], NOW)).toBe(0);
  });
});

describe('triageSpeed', () => {
  it('is the median hours from capture to the first later Occurrence, plus how many still wait', () => {
    const occs = [
      occ('captured', '2026-04-20T08:00:00Z', { nodeId: 'a' }),
      occ('parked', '2026-04-20T10:00:00Z', { nodeId: 'a' }), // 2h
      occ('captured', '2026-04-20T08:00:00Z', { nodeId: 'b' }),
      occ('done', '2026-04-20T14:00:00Z', { nodeId: 'b' }), // 6h
      occ('captured', '2026-04-21T08:00:00Z', { nodeId: 'c' }),
    ];
    expect(triageSpeed(occs)).toEqual({ medianHours: 4, waiting: 1 });
  });
  it('has no median until something has been triaged', () => {
    expect(triageSpeed([occ('captured', '2026-04-20T08:00:00Z', { nodeId: 'a' })])).toEqual({ medianHours: null, waiting: 1 });
    expect(triageSpeed([])).toEqual({ medianHours: null, waiting: 0 });
  });
});

describe('nudgeHealth', () => {
  it('counts shown, Not now and Stop these per kind, reporting only', () => {
    const events: SignalEvent[] = [
      { type: 'nudge', at: '2026-04-20T10:00:00Z', kind: 'leave_by', action: 'shown' },
      { type: 'nudge', at: '2026-04-20T10:00:00Z', kind: 'leave_by', action: 'shown' },
      { type: 'nudge', at: '2026-04-20T10:05:00Z', kind: 'leave_by', action: 'not_now' },
      { type: 'nudge', at: '2026-04-21T10:00:00Z', kind: 'at_risk', action: 'stopped' },
      { type: 'setting', at: '2026-04-21T10:00:00Z', key: 'sound:tone', on: false },
    ];
    expect(nudgeHealth(events, ['leave_by', 'at_risk', 'transition'])).toEqual([
      { kind: 'leave_by', shown: 2, notNow: 1, stopped: 0 },
      { kind: 'at_risk', shown: 0, notNow: 0, stopped: 1 },
      { kind: 'transition', shown: 0, notNow: 0, stopped: 0 },
    ]);
  });
});

describe('compareExperiment', () => {
  const start = '2026-04-12T12:00:00Z'; // 14 days before NOW
  it('compares equal spans before and after, as per-week rates, and is ready after a week', () => {
    const occs = [
      occ('done', '2026-04-01T10:00:00Z'), occ('done', '2026-04-05T10:00:00Z'), // before: 2 in 14 days
      occ('done', '2026-04-14T10:00:00Z'), occ('done', '2026-04-15T10:00:00Z'), occ('done', '2026-04-16T10:00:00Z'), occ('done', '2026-04-20T10:00:00Z'), // after: 4
    ];
    const events: SignalEvent[] = [
      { type: 'nudge', at: '2026-04-02T10:00:00Z', kind: 'leave_by', action: 'not_now' },
      { type: 'nudge', at: '2026-04-03T10:00:00Z', kind: 'leave_by', action: 'not_now' },
      { type: 'nudge', at: '2026-04-04T10:00:00Z', kind: 'leave_by', action: 'not_now' },
      { type: 'nudge', at: '2026-04-20T10:00:00Z', kind: 'leave_by', action: 'not_now' },
    ];
    expect(compareExperiment(occs, events, { key: 'sound:speech', startedAt: start, turnedOn: false }, NOW)).toEqual({
      ready: true, daysAfter: 14, keptPerWeekBefore: 1, keptPerWeekAfter: 2, notNowPerWeekBefore: 1.5, notNowPerWeekAfter: 0.5,
    });
  });
  it('is not ready inside the first week', () => {
    const r = compareExperiment([], [], { key: 'k', startedAt: '2026-04-24T12:00:00Z', turnedOn: true }, NOW);
    expect(r.ready).toBe(false);
    expect(r.daysAfter).toBe(2);
  });
});

describe('checkpoints', () => {
  const FIRST = '2026-03-01T00:00:00Z';
  it('are weeks 2, 4, 6, 8 and 12', () => expect(CHECKPOINT_WEEKS).toEqual([2, 4, 6, 8, 12]));
  it('offers the earliest reached, unanswered checkpoint', () => {
    expect(checkpointDue(FIRST, at('2026-03-10T00:00:00Z'), [])).toBeNull();
    expect(checkpointDue(FIRST, at('2026-03-15T00:00:00Z'), [])).toBe(2);
    expect(checkpointDue(FIRST, at('2026-03-15T00:00:00Z'), [2])).toBeNull();
    expect(checkpointDue(FIRST, at('2026-04-26T00:00:00Z'), [2])).toBe(4); // 8 weeks in: 4, 6 and 8 are each still owed
    expect(checkpointDue(FIRST, at('2026-04-26T00:00:00Z'), [2, 4, 6])).toBe(8);
    expect(checkpointDue(FIRST, at('2026-08-01T00:00:00Z'), [2, 4, 6, 8, 12])).toBeNull();
  });
  it('is null before first use', () => expect(checkpointDue(null, NOW, [])).toBeNull());
  it('first use is the earliest node or Occurrence', () => {
    expect(firstUse([commitment('c', { createdAt: '2026-03-05T00:00:00Z' })], [occ('done', '2026-03-02T00:00:00Z')])).toBe('2026-03-02T00:00:00Z');
    expect(firstUse([], [])).toBeNull();
  });
});

describe('wasOn, ruleFor and mechanismVerdict', () => {
  const FIRST = '2026-03-01T00:00:00Z';
  it('wasOn reads the recorded switches, defaulting before the first one', () => {
    const events: SignalEvent[] = [{ type: 'setting', at: '2026-03-10T00:00:00Z', key: 'k', on: false }];
    expect(wasOn(events, 'k', true, at('2026-03-05T00:00:00Z'))).toBe(true);
    expect(wasOn(events, 'k', true, at('2026-03-11T00:00:00Z'))).toBe(false);
    expect(wasOn([], 'k', false, NOW)).toBe(false);
  });

  it('keeps a mechanism that stayed on with no rise in Stop these', () => {
    const r = ruleFor([], 'sound:speech', true, FIRST, NOW);
    expect(r.weeksTotal).toBe(8);
    expect(r.weeksOn).toBe(8);
    expect(mechanismVerdict(r)).toBe('keep');
  });

  it('flags a mechanism switched off within two weeks as rework', () => {
    const events: SignalEvent[] = [{ type: 'setting', at: '2026-03-08T00:00:00Z', key: 'sound:speech', on: false }];
    const r = ruleFor(events, 'sound:speech', true, FIRST, NOW);
    expect(r.switchedOffQuickly).toBe(true);
    expect(mechanismVerdict(r)).toBe('rework');
  });

  it('does not keep a mechanism that was on for under half the weeks, or whose Stop these rose', () => {
    const lateOn: SignalEvent[] = [{ type: 'setting', at: '2026-04-20T00:00:00Z', key: 'k2', on: true }];
    expect(mechanismVerdict(ruleFor(lateOn, 'k2', false, FIRST, NOW))).toBe('undecided');
    const stops: SignalEvent[] = [
      { type: 'nudge', at: '2026-04-22T00:00:00Z', kind: 'leave_by', action: 'stopped' },
      { type: 'nudge', at: '2026-04-23T00:00:00Z', kind: 'leave_by', action: 'stopped' },
    ];
    expect(mechanismVerdict(ruleFor(stops, 'nudge:leave_by', true, FIRST, NOW, 'leave_by'))).toBe('undecided');
  });

  it('is too early before two weeks of use', () => {
    expect(mechanismVerdict(ruleFor([], 'k', true, '2026-04-20T00:00:00Z', NOW))).toBe('too_early');
  });
});

describe('slogUse', () => {
  const FIRST = '2026-03-01T12:00:00Z';
  const NOW4 = at('2026-03-29T13:00:00Z'); // four weeks and an hour after first use
  const slog = commitment('s1', { slog: true });
  const plain = commitment('p1');

  it('counts the weeks in which a slog-tagged Commitment was finished', () => {
    const occs = [occ('done', '2026-03-03T10:00:00Z', { nodeId: 's1' }), occ('done', '2026-03-17T10:00:00Z', { nodeId: 's1' })];
    expect(slogUse([slog], occs, FIRST, NOW4)).toEqual({ weeksUsed: 2, weeksTotal: 4 });
  });

  it('does not count a plain Commitment, a start, or a finish that was undone', () => {
    const undone = occ('done', '2026-03-10T10:00:00Z', { nodeId: 's1' });
    const occs = [
      occ('done', '2026-03-03T10:00:00Z', { nodeId: 'p1' }),
      occ('started', '2026-03-04T10:00:00Z', { nodeId: 's1' }),
      undone,
      occ('undone', '2026-03-10T11:00:00Z', { nodeId: 's1', undoes: undone.id }),
    ];
    expect(slogUse([slog, plain], occs, FIRST, NOW4)).toEqual({ weeksUsed: 0, weeksTotal: 4 });
  });

  it('counts a week once however many slogs were finished in it, and is too early with no history', () => {
    const occs = [occ('done', '2026-03-03T10:00:00Z', { nodeId: 's1' }), occ('done', '2026-03-04T10:00:00Z', { nodeId: 's1' })];
    expect(slogUse([slog], occs, FIRST, NOW4).weeksUsed).toBe(1);
    expect(slogUse([slog], [], null, NOW4)).toEqual({ weeksUsed: 0, weeksTotal: 0 });
    expect(mechanismVerdict(usageRule({ weeksUsed: 0, weeksTotal: 0 }))).toBe('too_early');
  });

  it('feeds the keep-or-cut rule: used in at least half the weeks is kept', () => {
    expect(mechanismVerdict(usageRule({ weeksUsed: 2, weeksTotal: 4 }))).toBe('keep');
    expect(mechanismVerdict(usageRule({ weeksUsed: 1, weeksTotal: 4 }))).toBe('undecided');
  });
});
