import { describe, expect, it } from 'vitest';
import { eisenhower } from './eisenhower';
import { at, commitment, deepFreeze, ev, goal, link } from './test-helpers';

const now = at('2026-03-10T09:00:00.000Z');
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('eisenhower', () => {
  const nodes = deepFreeze([
    goal('g'),
    commitment('soonGoal', { deadline: '2026-03-11T09:00:00.000Z' }),
    commitment('soonPlain', { fixedTime: '2026-03-10T15:00:00.000Z' }),
    commitment('laterGoal', { deadline: '2026-03-20T09:00:00.000Z' }),
    commitment('laterPlain'),
    commitment('overdueSlog', { deadline: '2026-03-01T09:00:00.000Z', slog: true }),
    commitment('nested'),
    commitment('done', { deadline: '2026-03-10T10:00:00.000Z' }),
    commitment('parked', { deadline: '2026-03-10T10:00:00.000Z' }),
  ]);
  const links = deepFreeze([
    link('part_of', 'soonGoal', 'g'), link('part_of', 'laterGoal', 'g'),
    link('part_of', 'nested', 'laterGoal'), link('part_of', 'g', 'nested'), // a cycle never loops
  ]);
  const occs = deepFreeze([ev('done', 'done', '2026-03-10T08:00:00.000Z'), ev('parked', 'parked', '2026-03-10T08:00:00.000Z')]);
  const q = eisenhower(nodes, links, occs, now);

  it('puts urgent and important items in Do, soonest first', () => {
    expect(ids(q.do)).toEqual(['overdueSlog', 'soonGoal']);
  });
  it('puts urgent but not important items in Quick', () => expect(ids(q.quick)).toEqual(['soonPlain']));
  it('puts important, not urgent items in Plan, including those nested under a goal', () => {
    expect(ids(q.plan)).toEqual(['laterGoal', 'nested']);
  });
  it('puts the rest in Later and leaves out done and parked items', () => {
    expect(ids(q.later)).toEqual(['laterPlain']);
  });
});
