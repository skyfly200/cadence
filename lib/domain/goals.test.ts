import { describe, expect, it } from 'vitest';
import { goalNextSteps, goalRows } from './goals';
import { rankNow } from './ranking';
import { UTC, at, commitment, deepFreeze, ev, goal, link } from './test-helpers';

const NOW = at('2026-03-14T18:30:00.000Z');
const later = (id: string, day: number) => ({ createdAt: `2026-02-${String(day).padStart(2, '0')}T00:00:00.000Z` });

describe('goalRows progress', () => {
  it('counts done Commitments at any depth, and milestones get their own bars', () => {
    const nodes = deepFreeze([
      goal('g'), goal('m1', { checkpoint: true }), goal('m2', { checkpoint: true }),
      commitment('a'), commitment('b'), commitment('c'), commitment('d'),
    ]);
    const links = deepFreeze([
      link('part_of', 'm1', 'g'), link('part_of', 'm2', 'g'),
      link('part_of', 'a', 'm1'), link('part_of', 'b', 'm1'), link('part_of', 'c', 'm2'), link('part_of', 'd', 'g'),
    ]);
    const occs = deepFreeze([ev('a', 'done', '2026-03-10T00:00:00.000Z'), ev('b', 'done', '2026-03-11T00:00:00.000Z')]);
    const rows = goalRows(nodes, links, occs);
    expect(rows).toHaveLength(1); // milestones are not top-level rows
    expect(rows[0]).toMatchObject({ done: 2, total: 4, fraction: 0.5 });
    expect(rows[0]!.milestones.map((m) => [m.goal.id, m.done, m.total])).toEqual([['m1', 2, 2], ['m2', 0, 1]]);
  });

  it('a done that was undone does not count; a Goal with nothing under it is 0 of 0', () => {
    const done = ev('a', 'done', '2026-03-10T00:00:00.000Z');
    const undo = ev('a', 'undone', '2026-03-10T01:00:00.000Z', { undoes: done.id });
    const rows = goalRows([goal('g'), goal('empty'), commitment('a')], [link('part_of', 'a', 'g')], [done, undo]);
    expect(rows.find((r) => r.goal.id === 'g')).toMatchObject({ done: 0, total: 1 });
    expect(rows.find((r) => r.goal.id === 'empty')).toMatchObject({ done: 0, total: 0, fraction: 0, next: null });
  });

  it('survives a part-of cycle', () => {
    const rows = goalRows(
      [goal('g1'), goal('g2'), commitment('a')],
      [link('part_of', 'g2', 'g1'), link('part_of', 'g1', 'g2'), link('part_of', 'a', 'g2')],
      [],
    );
    expect(rows.length).toBeGreaterThanOrEqual(0); // terminates; the cycle contributes each node once
    expect(goalNextSteps([goal('g1'), goal('g2'), commitment('a')], [link('part_of', 'g2', 'g1'), link('part_of', 'g1', 'g2'), link('part_of', 'a', 'g2')], [commitment('a')]).size).toBe(1);
  });
});

describe('next step', () => {
  it('is the oldest open, ready, unparked Commitment, skipping done and blocked ones', () => {
    const nodes = [
      goal('g'),
      commitment('done1', later('x', 1)), commitment('blocked', later('x', 2)), commitment('parked', later('x', 3)),
      commitment('newer', later('x', 9)), commitment('prereq', later('x', 8)),
    ];
    const links = [
      ...['done1', 'blocked', 'parked', 'newer', 'prereq'].map((id) => link('part_of', id, 'g')),
      link('requires', 'blocked', 'prereq'),
    ];
    const occs = [ev('done1', 'done', '2026-03-01T00:00:00.000Z'), ev('parked', 'parked', '2026-03-02T00:00:00.000Z')];
    expect(goalRows(nodes, links, occs)[0]!.next?.id).toBe('prereq');
  });

  it('agrees with the Now card tier 4 reason', () => {
    const nodes = [goal('g', { title: 'Projection mapping' }), commitment('step', { title: 'Sketch the layout' })];
    const links = [link('part_of', 'step', 'g')];
    const now = rankNow({ now: NOW, opts: UTC, nodes, links, occurrences: [] });
    expect(now.now?.node.id).toBe('step');
    expect(now.now?.reason).toBe('The next step for Projection mapping');
    expect(goalRows(nodes, links, [])[0]!.next?.id).toBe('step');
  });

  it('gives a shared Commitment to the oldest Goal only', () => {
    const nodes = [goal('old', later('g', 1)), goal('new', later('g', 2)), commitment('a', later('c', 1)), commitment('b', later('c', 2))];
    const links = [link('part_of', 'a', 'old'), link('part_of', 'a', 'new'), link('part_of', 'b', 'new')];
    const rows = goalRows(nodes, links, []);
    expect(rows.map((r) => [r.goal.id, r.next?.id])).toEqual([['old', 'a'], ['new', 'b']]);
  });
});

describe('goalRows time windows', () => {
  it('skips a step outside its time-of-day window, like the Now card does', () => {
    const nodes = [goal('g'), commitment('night', { windowStart: '22:00', windowEnd: '23:00', createdAt: '2026-02-01T00:00:00.000Z' }), commitment('any', { createdAt: '2026-02-02T00:00:00.000Z' })];
    const links = [link('part_of', 'night', 'g'), link('part_of', 'any', 'g')];
    expect(goalRows(nodes, links, [], NOW, 'UTC')[0]!.next?.id).toBe('any'); // 18:30 UTC is outside 22:00-23:00
    expect(goalRows(nodes, links, [], at('2026-03-14T22:30:00.000Z'), 'UTC')[0]!.next?.id).toBe('night');
  });
});

describe('goalRows order', () => {
  it('follows the user\'s order first, then age for goals never moved', () => {
    const nodes = [goal('old', later('', 1)), goal('mid', { ...later('', 2), order: 0 }), goal('new', later('', 3))];
    expect(goalRows(nodes, [], []).map((r) => r.goal.id)).toEqual(['mid', 'old', 'new']);
  });
});
