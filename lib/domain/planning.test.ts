import { describe, expect, it } from 'vitest';
import { CONFLICTS_MAX, TRIAGE_MAX, detectConflicts, ideasToReview, planningDue, recapLines } from './planning';
import { UTC, at, commitment, deepFreeze, ev, goal, habit, link } from './test-helpers';
import type { Idea } from './types';

const NOW = at('2026-03-14T18:30:00.000Z');
const idea = (id: string, createdAt: string): Idea => ({ id, kind: 'idea', title: id, private: false, createdAt, updatedAt: createdAt });

describe('ideasToReview', () => {
  const nodes = deepFreeze([idea('old', '2026-03-01T00:00:00.000Z'), idea('new1', '2026-03-10T00:00:00.000Z'), idea('new2', '2026-03-12T00:00:00.000Z'), commitment('c')]);

  it('shows Ideas captured since the last finished session, newest first', () => {
    expect(ideasToReview(nodes, '2026-03-05T00:00:00.000Z').map((n) => n.id)).toEqual(['new2', 'new1']);
  });

  it('shows every Idea on the first session', () => {
    expect(ideasToReview(nodes, null).map((n) => n.id)).toEqual(['new2', 'new1', 'old']);
  });

  it('skips what was already decided in an unfinished session, so stopping keeps progress', () => {
    expect(ideasToReview(nodes, null, ['new2']).map((n) => n.id)).toEqual(['new1', 'old']);
  });

  it('leaves backlogged Ideas alone until they are brought back up', () => {
    const withBacklog = [{ ...idea('later', '2026-03-11T00:00:00.000Z'), backlog: true }, idea('now', '2026-03-10T00:00:00.000Z')];
    expect(ideasToReview(withBacklog, null).map((n) => n.id)).toEqual(['now']);
  });

  it('shows only a few at a time', () => {
    const many = Array.from({ length: 9 }, (_, i) => idea(`i${i}`, `2026-03-0${i + 1}T00:00:00.000Z`));
    expect(ideasToReview(many, null)).toHaveLength(TRIAGE_MAX);
  });
});

describe('planningDue', () => {
  it('is never due when the reminder is off, and due after a week when it is on', () => {
    expect(planningDue(null, NOW, false)).toBe(false);
    expect(planningDue(null, NOW, true)).toBe(true);
    expect(planningDue('2026-03-10T00:00:00.000Z', NOW, true)).toBe(false);
    expect(planningDue('2026-03-07T00:00:00.000Z', NOW, true)).toBe(true);
  });
});

describe('detectConflicts', () => {
  const base = { now: NOW, opts: UTC, sleepTime: '23:00', timeFormat: '12' as const };

  it('finds overlapping fixed times and offers one fix that opens the later item', () => {
    const nodes = deepFreeze([
      commitment('a', { title: 'Dentist', fixedTime: '2026-03-15T15:00:00.000Z', durationMinutes: 60 }),
      commitment('b', { title: 'Call Sam', fixedTime: '2026-03-15T15:30:00.000Z', durationMinutes: 15 }),
    ]);
    const out = detectConflicts({ ...base, nodes, links: [], occurrences: [] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'overlap', line: '"Dentist" and "Call Sam" overlap at 3:30 pm.' });
    expect(out[0]!.fix.action).toEqual({ type: 'edit', id: 'b' });
  });

  it('does not flag back-to-back items, finished items or parked ones', () => {
    const nodes = deepFreeze([
      commitment('a', { fixedTime: '2026-03-15T15:00:00.000Z', durationMinutes: 60 }),
      commitment('b', { fixedTime: '2026-03-15T16:00:00.000Z' }),
      commitment('c', { fixedTime: '2026-03-15T15:10:00.000Z' }),
      commitment('d', { fixedTime: '2026-03-15T15:20:00.000Z' }),
    ]);
    const occs = deepFreeze([ev('c', 'done', '2026-03-14T10:00:00.000Z'), ev('d', 'parked', '2026-03-14T10:00:00.000Z')]);
    expect(detectConflicts({ ...base, nodes, links: [], occurrences: occs })).toEqual([]);
  });

  it('uses the Now card workload guard for a full day and offers to park the biggest open item', () => {
    const deadline = '2026-03-14T20:00:00.000Z';
    const nodes = deepFreeze([
      commitment('s', { title: 'Small', deadline, durationMinutes: 100 }),
      commitment('big', { title: 'Big one', deadline, durationMinutes: 300 }),
      commitment('m', { title: 'Mid', deadline, durationMinutes: 200 }),
    ]);
    const out = detectConflicts({ ...base, nodes, links: [], occurrences: [] });
    expect(out).toEqual([{ kind: 'full', line: 'Today looks full.', fix: { text: 'Park "Big one" for now?', action: { type: 'park', id: 'big' } } }]);
  });

  it('names things that wait on each other', () => {
    const nodes = deepFreeze([commitment('a', { title: 'Pack' }), commitment('b', { title: 'Load' })]);
    const links = deepFreeze([link('requires', 'a', 'b'), link('requires', 'b', 'a')]);
    const out = detectConflicts({ ...base, nodes, links, occurrences: [] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'cycle', line: 'These wait on each other: "Pack", "Load".' });
    expect(out[0]!.fix.action).toEqual({ type: 'edit', id: 'a' });
  });

  it('shows at most a couple, and nothing when all is well', () => {
    expect(detectConflicts({ ...base, nodes: [], links: [], occurrences: [] })).toEqual([]);
    const nodes = deepFreeze([
      commitment('a', { fixedTime: '2026-03-15T15:00:00.000Z', durationMinutes: 60 }),
      commitment('b', { fixedTime: '2026-03-15T15:30:00.000Z' }),
      commitment('x', { deadline: '2026-03-14T20:00:00.000Z', durationMinutes: 900 }),
      commitment('p'), commitment('q'),
    ]);
    const links = deepFreeze([link('requires', 'p', 'q'), link('requires', 'q', 'p')]);
    expect(detectConflicts({ ...base, nodes, links, occurrences: [] })).toHaveLength(CONFLICTS_MAX);
  });
});

describe('recapLines', () => {
  const nodes = deepFreeze([
    goal('g', { title: 'Projection mapping' }), commitment('a'), commitment('b'),
    habit({ id: 'h1', title: 'Walk', period: 'week', target: 2 }), habit({ id: 'h2', title: 'Read', period: 'week', target: 5 }),
    habit({ id: 'dh', title: 'Floss', period: 'day' }),
  ]);
  const links = deepFreeze([link('part_of', 'a', 'g'), link('part_of', 'b', 'g')]);
  const occs = deepFreeze([
    ev('a', 'done', '2026-03-10T10:00:00.000Z'), ev('b', 'done', '2026-03-11T10:00:00.000Z'),
    ev('h1', 'logged', '2026-03-10T08:00:00.000Z'), ev('h1', 'logged', '2026-03-12T08:00:00.000Z'), ev('h2', 'logged', '2026-03-12T08:00:00.000Z'),
  ]);
  const input = { nodes, links, occurrences: occs, at: NOW, period: 'week' as const, opts: UTC };

  it('is the tally, the habits of that period, and one goal that moved: three lines at most', () => {
    expect(recapLines(input)).toEqual([
      '5 things kept this week.',
      '1 of 2 weekly habits met so far.',
      'Projection mapping moved forward: 2 steps done.',
    ]);
  });

  it('leaves a line out when there is nothing good to say, and never mentions anything undone or missed', () => {
    const done = ev('a', 'done', '2026-03-10T10:00:00.000Z');
    const undo = ev('a', 'undone', '2026-03-10T11:00:00.000Z', { undoes: done.id });
    const lines = recapLines({ ...input, nodes: [goal('g'), commitment('a')], links: [link('part_of', 'a', 'g')], occurrences: [done, undo, ev('x', 'skipped', '2026-03-10T10:00:00.000Z')] });
    expect(lines).toEqual([]);
    for (const l of recapLines(input)) expect(l).not.toMatch(/miss|fail|streak|undone|behind|skipped/i);
  });

  it('covers a month or a quarter on the same terms', () => {
    const monthly = [...nodes, habit({ id: 'mh', title: 'Call Mum', period: 'month', target: 1 })];
    const lines = recapLines({ ...input, nodes: monthly, occurrences: [...occs, ev('mh', 'logged', '2026-03-02T08:00:00.000Z')], period: 'month' });
    expect(lines[0]).toBe('6 things kept this month.');
    expect(lines[1]).toBe('1 of 1 monthly habit met so far.');
  });
});
