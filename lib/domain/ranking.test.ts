import { describe, expect, it } from 'vitest';
import { rankNow, type RankInput } from './ranking';
import type { Node } from './types';
import { UTC, at, commitment, deepFreeze, ev, goal, habit, link } from './test-helpers';

// 2026-03-14 is a Saturday (weekday 6). Everything runs in UTC.
const SAT_1830 = at('2026-03-14T18:30:00.000Z');

function run(over: Partial<RankInput> = {}) {
  return rankNow({ now: SAT_1830, opts: UTC, nodes: [], links: [], occurrences: [], ...over });
}

const travel25 = { travel: (c: { id: string }) => (c.id === 'gig' ? 25 : 0) };

// the House of Fire chain: gig requires load, load requires cooler
const gig = commitment('gig', { title: 'Leave for House of Fire', fixedTime: '2026-03-14T20:00:00.000Z', durationMinutes: 15 });
const load = commitment('load', { title: 'Load the projector' });
const cooler = commitment('cooler', { title: 'Take the cooler out' });
const chainLinks = [link('requires', 'load', 'cooler'), link('requires', 'gig', 'load')];

describe('tier 1: time-critical', () => {
  it('a ready fixed-time item whose start-by is within the hour wins, with the start-by in the reason', () => {
    const r = run({
      nodes: [gig, commitment('late', { deadline: '2026-03-14T22:00:00.000Z' }), commitment('other')],
      providers: travel25,
    });
    expect(r.now?.node.id).toBe('gig');
    expect(r.tier).toBe(1);
    // 20:00 minus 15 minutes minus 25 minutes of travel = 19:20
    expect(r.now?.startBy?.toISOString()).toBe('2026-03-14T19:20:00.000Z');
    expect(r.reason).toBe('Leave by 7:20, so this comes first');
  });

  it('uses injected duration and travel for the start-by', () => {
    const r = run({ nodes: [gig], providers: { duration: () => 30, travel: () => 20 } });
    expect(r.now?.startBy?.toISOString()).toBe('2026-03-14T19:10:00.000Z');
    expect(r.now?.minutes).toBe(30);
    expect(r.now?.travelMinutes).toBe(20);
    expect(r.reason).toBe('Leave by 7:10, so this comes first');
  });

  it('is not time-critical while the start-by is more than an hour away: it waits in the strip as scheduled', () => {
    const r = run({ now: at('2026-03-14T16:00:00.000Z'), nodes: [gig, commitment('x')], providers: travel25 });
    expect(r.now?.node.id).toBe('x');
    const sched = r.strip.find((s) => s.node.id === 'gig');
    expect(sched?.scheduled).toBe(true);
    expect(sched?.reason).toBe('At 8:00');
  });

  it('stops being time-critical an hour after its fixed time and becomes an ordinary item', () => {
    const r = run({ now: at('2026-03-14T21:10:00.000Z'), nodes: [gig] });
    expect(r.now?.node.id).toBe('gig');
    expect(r.tier).toBe(5);
    expect(r.reason).toBe('Up next');
  });
});

describe('tier 2: unblockers and dependency readiness', () => {
  const nodes = [gig, load, cooler];

  it('the cooler comes first: it unblocks loading, which unblocks leaving', () => {
    const r = run({ nodes, links: chainLinks, providers: travel25 });
    expect(r.now?.node.id).toBe('cooler');
    expect(r.tier).toBe(2);
    expect(r.reason).toBe('It unblocks Load the projector');
    expect(r.chain).toEqual(['unblocks: Load the projector', 'unblocks: Leave for House of Fire']);
    // the blocked time-critical item is not the Now card; it waits in the strip
    expect(r.strip.map((s) => s.node.id)).toEqual(['gig']);
    expect(r.strip[0]!.scheduled).toBe(true);
  });

  it('the next link in the chain opens once the prerequisite is done, and then the time-critical item itself', () => {
    const afterCooler = run({ nodes, links: chainLinks, providers: travel25, occurrences: [ev('cooler', 'done', '2026-03-14T18:10:00.000Z')] });
    expect(afterCooler.now?.node.id).toBe('load');
    expect(afterCooler.tier).toBe(2);
    expect(afterCooler.reason).toBe('It unblocks Leave for House of Fire');

    const afterLoad = run({
      nodes, links: chainLinks, providers: travel25,
      occurrences: [ev('cooler', 'done', '2026-03-14T18:10:00.000Z'), ev('load', 'done', '2026-03-14T18:20:00.000Z')],
    });
    expect(afterLoad.now?.node.id).toBe('gig');
    expect(afterLoad.tier).toBe(1);
  });

  it('an undone "done" reopens the item', () => {
    const done = ev('cooler', 'done', '2026-03-14T18:10:00.000Z');
    const r = run({ nodes, links: chainLinks, providers: travel25, occurrences: [done, ev('cooler', 'undone', '2026-03-14T18:12:00.000Z', { undoes: done.id })] });
    expect(r.now?.node.id).toBe('cooler');
  });

  it('a prerequisite that is not a Commitment, or is missing, does not block', () => {
    const r = run({ nodes: [commitment('a'), goal('g1')], links: [link('requires', 'a', 'g1'), link('requires', 'a', 'ghost')] });
    expect(r.now?.node.id).toBe('a');
  });
});

describe('tier 3: due today', () => {
  it('orders by earliest deadline, counts a deadline already past, and ignores tomorrow', () => {
    const r = run({
      density: 2,
      nodes: [
        commitment('a', { deadline: '2026-03-14T22:00:00.000Z' }),
        commitment('b', { deadline: '2026-03-14T21:00:00.000Z' }),
        commitment('c', { deadline: '2026-03-13T10:00:00.000Z' }),
        commitment('d', { deadline: '2026-03-15T15:00:00.000Z' }),
      ],
    });
    expect(r.now?.node.id).toBe('c');
    expect(r.tier).toBe(3);
    expect(r.reason).toBe("It's due today");
    expect(r.strip.map((s) => [s.node.id, s.tier])).toEqual([['b', 3], ['a', 3], ['d', 5]]);
  });

  it('breaks equal deadlines by shortest first when energy is low', () => {
    const nodes = [
      commitment('long', { deadline: '2026-03-14T22:00:00.000Z', durationMinutes: 60 }),
      commitment('short', { deadline: '2026-03-14T22:00:00.000Z', durationMinutes: 10 }),
    ];
    expect(run({ nodes, energy: 'low' }).now?.node.id).toBe('short');
    expect(run({ nodes, energy: 'ok' }).now?.node.id).toBe('long'); // then older-first, then id
  });
});

describe('tier 4: next step of an active Goal', () => {
  it('picks the oldest ready item under each Goal, including nested sub-goals', () => {
    const nodes: Node[] = [
      goal('g', { title: 'Projection mapping' }),
      goal('sub', { title: 'Sub' }),
      commitment('s1', { createdAt: '2026-01-02T00:00:00.000Z' }),
      commitment('s2', { createdAt: '2026-01-03T00:00:00.000Z' }),
      commitment('s3', { createdAt: '2026-01-01T12:00:00.000Z' }),
      commitment('loose', { createdAt: '2026-01-05T00:00:00.000Z' }),
    ];
    const links = [link('part_of', 'sub', 'g'), link('part_of', 's1', 'g'), link('part_of', 's2', 'g'), link('part_of', 's3', 'sub')];
    const r = run({ nodes, links, density: 2 });
    expect(r.now?.node.id).toBe('s3'); // oldest under g (via the nested sub-goal)
    expect(r.tier).toBe(4);
    expect(r.reason).toBe('The next step for Projection mapping');
    // only ONE next step per goal is tier 4; the others fall to "the rest"
    expect(r.strip.map((s) => [s.node.id, s.tier])).toEqual([['s1', 5], ['s2', 5], ['loose', 5]]);
  });

  it('is outranked by a deadline today', () => {
    const r = run({
      nodes: [goal('g'), commitment('step'), commitment('due', { deadline: '2026-03-14T23:00:00.000Z' })],
      links: [link('part_of', 'step', 'g')],
    });
    expect(r.now?.node.id).toBe('due');
  });
});

describe('tier 5: the rest, and energy tie-breaks', () => {
  const nodes = [
    commitment('old', { createdAt: '2026-01-01T00:00:00.000Z', durationMinutes: 50 }),
    commitment('quick', { createdAt: '2026-01-02T00:00:00.000Z', durationMinutes: 10 }),
    commitment('slog', { createdAt: '2026-01-03T00:00:00.000Z', durationMinutes: 30, slog: true }),
  ];

  it('older captures first by default', () => {
    const r = run({ nodes });
    expect(r.now?.node.id).toBe('old');
    expect(r.reason).toBe('Up next');
  });

  it('low energy prefers the shortest; good energy prefers the slog', () => {
    expect(run({ nodes, energy: 'low' }).now?.node.id).toBe('quick');
    expect(run({ nodes, energy: 'good' }).now?.node.id).toBe('slog');
  });
});

describe('eligibility', () => {
  it('Ideas, Goals and Things are never candidates; Private nodes are', () => {
    const idea: Node = { id: 'i', kind: 'idea', title: 'maybe', private: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    const r = run({ nodes: [idea, goal('g'), commitment('p', { private: true })] });
    expect(r.now?.node.id).toBe('p');
    expect(r.strip).toHaveLength(0);
    expect(run({ nodes: [idea, goal('g')] }).now).toBeNull();
  });

  it('quiet (Background) Commitments appear only when the atRisk hook says so', () => {
    const quiet = commitment('teeth', { quiet: true });
    expect(run({ nodes: [quiet] }).now).toBeNull();
    expect(run({ nodes: [quiet], providers: { atRisk: (n) => n.id === 'teeth' } }).now?.node.id).toBe('teeth');
  });

  it('respects a time window: outside it the item is not doable now', () => {
    const shop = commitment('shop', { windowStart: '09:00', windowEnd: '17:00' });
    expect(run({ nodes: [shop] }).now).toBeNull(); // 18:30
    expect(run({ nodes: [shop], now: at('2026-03-14T12:00:00.000Z') }).now?.node.id).toBe('shop');
    const night = commitment('night', { windowStart: '22:00', windowEnd: '06:00' });
    expect(run({ nodes: [night], now: at('2026-03-14T23:00:00.000Z') }).now?.node.id).toBe('night');
    expect(run({ nodes: [night], now: at('2026-03-14T12:00:00.000Z') }).now).toBeNull();
  });

  it('done items are not candidates', () => {
    const r = run({ nodes: [commitment('a')], occurrences: [ev('a', 'done', '2026-03-14T10:00:00.000Z')] });
    expect(r.now).toBeNull();
  });
});

describe('habits', () => {
  it('pinned to a time of day: tier 1 within an hour of the slot, otherwise not a candidate', () => {
    const near = habit({ id: 'h-near', title: 'Stretch', pin: { timesOfDay: ['19:00'] } });
    const r = run({ nodes: [near] });
    expect(r.now?.node.id).toBe('h-near');
    expect(r.tier).toBe(1);
    expect(r.reason).toBe('Right on time for Stretch');
    const far = habit({ id: 'h-far', pin: { timesOfDay: ['08:00'] } });
    expect(run({ nodes: [far] }).now).toBeNull();
  });

  it('pinned to weekdays: tier 3 on those days, absent on others', () => {
    expect(run({ nodes: [habit({ pin: { weekdays: [6] } })] }).tier).toBe(3);
    expect(run({ nodes: [habit({ pin: { weekdays: [1] } })] }).now).toBeNull();
  });

  it('an unpinned open day habit is only in the last tier, and a met habit is gone', () => {
    const h = habit({ id: 'h1' });
    const r = run({ nodes: [h, commitment('task', { deadline: '2026-03-14T22:00:00.000Z' })] });
    expect(r.now?.node.id).toBe('task');
    expect(r.strip[0]!.node.id).toBe('h1');
    expect(r.strip[0]!.tier).toBe(5);
    const met = run({ nodes: [h], occurrences: [ev('h1', 'logged', '2026-03-14T08:00:00.000Z')] });
    expect(met.now).toBeNull();
  });

  it('a longer-period habit joins "due today" only in the final stretch of its period', () => {
    const weekly = habit({ id: 'w', title: 'Long walk', period: 'week', target: 1 });
    // Saturday 18:30 is 82% through the Monday-start week
    const late = run({ nodes: [weekly] });
    expect(late.tier).toBe(3);
    expect(late.reason).toBe('Still open this week');
    // Wednesday noon is about 40% through
    expect(run({ nodes: [weekly], now: at('2026-03-11T12:00:00.000Z') }).now).toBeNull();
    // once met it is gone
    expect(run({ nodes: [weekly], occurrences: [ev('w', 'logged', '2026-03-13T09:00:00.000Z')] }).now).toBeNull();
  });

  it('quiet habits appear only when at risk', () => {
    const q = habit({ id: 'teeth', quiet: true });
    expect(run({ nodes: [q] }).now).toBeNull();
    expect(run({ nodes: [q], providers: { atRisk: () => true } }).now?.node.id).toBe('teeth');
  });
});

describe('Not now and Park', () => {
  const a = commitment('a', { createdAt: '2026-01-01T00:00:00.000Z' });
  const b = commitment('b', { createdAt: '2026-01-02T00:00:00.000Z' });

  it('Not now shelves the item: the next one becomes the card, and the shelved item is not lost', () => {
    const moved = ev('a', 'moved', '2026-03-14T18:20:00.000Z');
    const r = run({ nodes: [a, b], occurrences: [moved] });
    expect(r.now?.node.id).toBe('b');
    expect(r.strip.map((s) => s.node.id)).toEqual(['a']); // still coming
    // only one card left and it is shelved: it still comes back rather than vanishing
    expect(run({ nodes: [a], occurrences: [moved] }).now?.node.id).toBe('a');
  });

  it('the shelf ends after two hours', () => {
    const moved = ev('a', 'moved', '2026-03-14T18:20:00.000Z');
    expect(run({ nodes: [a, b], occurrences: [moved], now: at('2026-03-14T20:21:00.000Z') }).now?.node.id).toBe('a');
    expect(run({ nodes: [a, b], occurrences: [moved], now: at('2026-03-14T20:19:00.000Z') }).now?.node.id).toBe('b');
  });

  it('the shelf ends early once two other cards are finished', () => {
    const occs = [
      ev('a', 'moved', '2026-03-14T18:00:00.000Z'),
      ev('x1', 'done', '2026-03-14T18:10:00.000Z'),
      ev('x2', 'done', '2026-03-14T18:20:00.000Z'),
    ];
    expect(run({ nodes: [a, b], occurrences: occs }).now?.node.id).toBe('a');
    // only one finished: still shelved
    expect(run({ nodes: [a, b], occurrences: occs.slice(0, 2) }).now?.node.id).toBe('b');
  });

  it('a time-critical item whose start-by has passed is never shelved away', () => {
    const r = run({
      now: at('2026-03-14T19:30:00.000Z'), nodes: [gig, commitment('other')], providers: travel25,
      occurrences: [ev('gig', 'moved', '2026-03-14T19:25:00.000Z')],
    });
    expect(r.now?.node.id).toBe('gig');
  });

  it('the fourth Not now raises shrink / park / keep; an undone one lowers the count', () => {
    const moves = ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'].map((d) => ev('a', 'moved', `${d}T10:00:00.000Z`));
    expect(run({ nodes: [a], occurrences: moves.slice(0, 3) }).offerShrinkParkKeep).toBe(false);
    expect(run({ nodes: [a], occurrences: moves }).offerShrinkParkKeep).toBe(true);
    const undo = ev('a', 'undone', '2026-03-13T10:05:00.000Z', { undoes: moves[3]!.id });
    expect(run({ nodes: [a], occurrences: [...moves, undo] }).offerShrinkParkKeep).toBe(false);
  });

  it('Park removes the item until it is brought back (an undone parked)', () => {
    const parked = ev('a', 'parked', '2026-03-14T10:00:00.000Z');
    expect(run({ nodes: [a], occurrences: [parked] }).now).toBeNull();
    const back = ev('a', 'undone', '2026-03-14T12:00:00.000Z', { undoes: parked.id });
    expect(run({ nodes: [a], occurrences: [parked, back] }).now?.node.id).toBe('a');
  });
});

describe('the strip', () => {
  const nodes = Array.from({ length: 7 }, (_, i) => commitment(`c${i}`, { createdAt: `2026-01-0${i + 1}T00:00:00.000Z` }));

  it('shows 1, 3 or 5 items by density, and at most 2 when energy is low', () => {
    expect(run({ nodes, density: 0 }).strip).toHaveLength(1);
    expect(run({ nodes, density: 1 }).strip).toHaveLength(3);
    expect(run({ nodes, density: 2 }).strip).toHaveLength(5);
    expect(run({ nodes, density: 2, energy: 'low' }).strip).toHaveLength(2);
    expect(run({ nodes, density: 0, energy: 'low' }).strip).toHaveLength(1);
  });

  it('the Now card is never repeated in the strip', () => {
    const r = run({ nodes, density: 2 });
    expect(r.strip.map((s) => s.node.id)).not.toContain(r.now!.node.id);
  });
});

describe('workload guard', () => {
  const NIGHT = at('2026-03-14T22:00:00.000Z'); // an hour before the 23:00 sleep window
  const task = (id: string) => commitment(id, { deadline: '2026-03-14T23:30:00.000Z', durationMinutes: 30 });

  it('shows a calm line when today\'s open work will not fit (time left minus fixed events, with a 20% buffer)', () => {
    // 60 minutes left * 0.8 = 48 available
    const two = run({ now: NIGHT, nodes: [task('a'), task('b')] });
    expect(two.workloadGuard.show).toBe(true);
    expect(two.workloadGuard.line).toBe('Today looks full. Want to park a few?');
    expect(two.workloadGuard.openMinutes).toBe(60);
    expect(two.workloadGuard.availableMinutes).toBe(48);
    const one = run({ now: NIGHT, nodes: [task('a')] });
    expect(one.workloadGuard.show).toBe(false);
    expect(one.workloadGuard.line).toBeNull();
  });

  it('a fixed event later today uses up the time', () => {
    const event = commitment('event', { fixedTime: '2026-03-14T22:30:00.000Z', durationMinutes: 30 });
    const r = run({ now: NIGHT, nodes: [task('a'), event] });
    // (60 - 30) * 0.8 = 24 available against 30 of work
    expect(r.workloadGuard.availableMinutes).toBe(24);
    expect(r.workloadGuard.show).toBe(true);
  });

  it('never acts on its own: it only reports', () => {
    const r = run({ now: NIGHT, nodes: [task('a'), task('b')] });
    expect(r.now).not.toBeNull();
    expect(Object.keys(r.workloadGuard).sort()).toEqual(['availableMinutes', 'line', 'openMinutes', 'show']);
  });
});

describe('planned days', () => {
  it('keeps a Commitment planned for a later day out of today, and brings it in on its day', () => {
    const later = commitment('later', { plannedFor: '2026-03-16' });
    expect(run({ nodes: [later] }).now).toBeNull();
    expect(run({ now: at('2026-03-16T09:00:00.000Z'), nodes: [later] }).now?.node.id).toBe('later');
  });

  it('lets a fixed time win over the planned day', () => {
    const c = commitment('c', { plannedFor: '2026-03-20', fixedTime: '2026-03-14T20:00:00.000Z' });
    expect(run({ nodes: [c] }).now?.node.id).toBe('c');
  });
});

describe('purity', () => {
  it('is deterministic and does not mutate its input', () => {
    const input = deepFreeze({
      now: SAT_1830, opts: UTC,
      nodes: [gig, load, cooler, goal('g'), habit({ pin: { weekdays: [6] } }), commitment('x', { deadline: '2026-03-14T22:00:00.000Z' })] as Node[],
      links: chainLinks,
      occurrences: [ev('x', 'moved', '2026-03-14T18:00:00.000Z')],
      providers: undefined,
    }) as RankInput;
    const a = rankNow(input);
    const b = rankNow(input);
    expect(a).toEqual(b);
  });
});
