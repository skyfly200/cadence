import { describe, expect, it } from 'vitest';
import { activeLogs, finalStretchMention, habitProgress, habitTap, homeHabitsPiece, isDueToday } from './habits';
import { at, counter, habit, occ, UTC } from './test-helpers';

// 2026-03-08 is a Sunday; with Monday-start weeks the week is Mar 2 – Mar 8.
const SUN = at('2026-03-08T12:00:00Z');

describe('habitProgress', () => {
  it('counts only logs inside the current period', () => {
    const h = habit({ period: 'week', target: 3 });
    const occs = [
      occ('logged', '2026-02-28T10:00:00Z'), // previous week
      occ('logged', '2026-03-02T10:00:00Z'),
      occ('logged', '2026-03-04T10:00:00Z'),
      occ('logged', '2026-03-09T10:00:00Z'), // next week
    ];
    const p = habitProgress(h, occs, SUN, UTC);
    expect(p.count).toBe(2);
    expect(p.met).toBe(false);
    expect(p.fill).toBeCloseTo(2 / 3, 5);
  });

  it('is met at the target and fill is capped past it', () => {
    const h = habit({ period: 'day', target: 2 });
    const two = [occ('logged', '2026-03-08T08:00:00Z'), occ('logged', '2026-03-08T20:00:00Z')];
    expect(habitProgress(h, two, SUN, UTC)).toMatchObject({ count: 2, met: true, fill: 1 });
    const three = [...two, occ('logged', '2026-03-08T21:00:00Z')];
    expect(habitProgress(h, three, SUN, UTC)).toMatchObject({ count: 3, met: true, fill: 1 });
  });

  it('ignores other habits and non-log occurrences, and excludes undone logs', () => {
    const h = habit({ period: 'day', target: 3 });
    const l1 = occ('logged', '2026-03-08T08:00:00Z');
    const l2 = occ('logged', '2026-03-08T09:00:00Z');
    const occs = [
      l1, l2,
      occ('logged', '2026-03-08T10:00:00Z', { nodeId: 'other' }),
      occ('skipped', '2026-03-08T11:00:00Z'),
      occ('undone', '2026-03-08T12:00:00Z', { undoes: l1.id }),
    ];
    expect(activeLogs('h1', occs).map((o) => o.id)).toEqual([l2.id]);
    expect(habitProgress(h, occs, SUN, UTC).count).toBe(1);
  });
});

describe('habitTap (log, and undo past the target)', () => {
  it('below the target it appends one log', () => {
    const h = habit({ period: 'day', target: 2 });
    const out = habitTap(h, [], SUN, 'app', counter(), UTC);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ nodeId: 'h1', type: 'logged', source: 'app', at: SUN.toISOString() });
  });

  it('at the target it undoes every active log in the period, back to zero, and never deletes', () => {
    const h = habit({ period: 'day', target: 2 });
    const id = counter('t');
    let log: ReturnType<typeof occ>[] = [];
    log = [...log, ...habitTap(h, log, at('2026-03-08T08:00:00Z'), 'app', id, UTC)];
    log = [...log, ...habitTap(h, log, at('2026-03-08T09:00:00Z'), 'app', id, UTC)];
    expect(habitProgress(h, log, SUN, UTC).met).toBe(true);

    const undo = habitTap(h, log, at('2026-03-08T10:00:00Z'), 'app', id, UTC);
    expect(undo.map((o) => o.type)).toEqual(['undone', 'undone']);
    expect(undo.map((o) => o.undoes)).toEqual(log.map((o) => o.id));
    log = [...log, ...undo];
    expect(log).toHaveLength(4); // append-only: nothing removed
    expect(habitProgress(h, log, SUN, UTC).count).toBe(0);

    // and the next tap logs again
    expect(habitTap(h, log, SUN, 'app', id, UTC)[0].type).toBe('logged');
  });

  it('only undoes logs from the current period', () => {
    const h = habit({ period: 'day', target: 1 });
    const yesterday = occ('logged', '2026-03-07T10:00:00Z');
    const today = occ('logged', '2026-03-08T10:00:00Z');
    const undo = habitTap(h, [yesterday, today], SUN, 'app', counter(), UTC);
    expect(undo).toHaveLength(1);
    expect(undo[0].undoes).toBe(today.id);
  });
});

describe('pinning and today', () => {
  it('an unpinned habit is due today only when its period is a day', () => {
    expect(isDueToday(habit({ period: 'day' }), SUN, UTC)).toBe(true);
    expect(isDueToday(habit({ period: 'week', target: 3 }), SUN, UTC)).toBe(false);
    expect(isDueToday(habit({ period: 'quarter' }), SUN, UTC)).toBe(false);
  });

  it('a habit pinned to weekdays is due only on those weekdays, whatever its period', () => {
    const mwf = habit({ period: 'day', pin: { weekdays: [1, 3, 5] } });
    expect(isDueToday(mwf, at('2026-03-04T12:00:00Z'), UTC)).toBe(true); // Wednesday
    expect(isDueToday(mwf, at('2026-03-03T12:00:00Z'), UTC)).toBe(false); // Tuesday
    const sundayWeekly = habit({ period: 'week', pin: { weekdays: [0] } });
    expect(isDueToday(sundayWeekly, SUN, UTC)).toBe(true);
  });

  it('quiet (Background) habits are never due', () => {
    expect(isDueToday(habit({ period: 'day', quiet: true }), SUN, UTC)).toBe(false);
    expect(isDueToday(habit({ period: 'day', quiet: true, pin: { weekdays: [0] } }), SUN, UTC)).toBe(false);
  });
});

describe('homeHabitsPiece', () => {
  it('counts day-period habits and anything pinned to today, never quiet or unpinned longer ones', () => {
    const habits = [
      habit({ id: 'a', period: 'day' }),
      habit({ id: 'b', period: 'day' }),
      habit({ id: 'c', period: 'week', target: 3 }),
      habit({ id: 'd', period: 'day', quiet: true }),
      habit({ id: 'e', period: 'week', target: 3, pin: { weekdays: [0] } }),
    ];
    const occs = [
      occ('logged', '2026-03-08T08:00:00Z', { nodeId: 'a' }),
      occ('logged', '2026-03-08T09:00:00Z', { nodeId: 'e' }), // pinned weekly, logged today
      occ('logged', '2026-03-08T09:30:00Z', { nodeId: 'c' }),
      occ('logged', '2026-03-08T09:40:00Z', { nodeId: 'd' }),
    ];
    const piece = homeHabitsPiece(habits, occs, SUN, UTC);
    expect(piece.total).toBe(3);
    expect(piece.done).toBe(2);
    expect(piece.habits.map((r) => r.habit.id)).toEqual(['a', 'b', 'e']);
  });
});

describe('finalStretchMention (longer periods, once, never after close)', () => {
  const monthly = habit({ period: 'month', target: 2 });

  it('is silent early in the period', () => {
    expect(finalStretchMention(monthly, [], at('2026-04-20T12:00:00Z'), [], UTC)).toBeNull();
  });

  it('mentions an open habit once it is 80% through, returning the window key', () => {
    expect(finalStretchMention(monthly, [], at('2026-04-25T12:00:00Z'), [], UTC)).toBe('month:2026-04-01');
  });

  it('never mentions the same period twice', () => {
    expect(finalStretchMention(monthly, [], at('2026-04-27T12:00:00Z'), ['month:2026-04-01'], UTC)).toBeNull();
  });

  it('is silent once the target is met, for day habits, and for quiet habits', () => {
    const met = [occ('logged', '2026-04-02T10:00:00Z'), occ('logged', '2026-04-03T10:00:00Z')];
    expect(finalStretchMention(monthly, met, at('2026-04-27T12:00:00Z'), [], UTC)).toBeNull();
    expect(finalStretchMention(habit({ period: 'day' }), [], at('2026-04-27T23:00:00Z'), [], UTC)).toBeNull();
    expect(finalStretchMention(habit({ period: 'month', quiet: true }), [], at('2026-04-27T12:00:00Z'), [], UTC)).toBeNull();
  });

  it('never mentions after the period closes: the new period is barely started', () => {
    expect(finalStretchMention(monthly, [], at('2026-05-02T12:00:00Z'), [], UTC)).toBeNull();
  });
});
