import { describe, expect, it } from 'vitest';
import {
  GROUND_KINDS, MAX_BLOOMS, PIECE_KINDS, hemisphereOfZone, seasonNameFor, seasonNameOfKey, PLANT_FOR_PERIOD, RESTING_DAYS, gardenState, pressSeason, pressedBook, seasonOf, stageOf, unit,
} from './garden';
import { commitment, deepFreeze, ev, goal, habit, link, UTC } from './test-helpers';

const NOW = new Date('2026-11-10T12:00:00.000Z'); // Autumn 2026
const logs = (id: string, days: string[]) => days.map((d) => ev(id, 'logged', `${d}T09:00:00.000Z`));
const g = (nodes: Parameters<typeof gardenState>[0], links: Parameters<typeof gardenState>[1], occs: Parameters<typeof gardenState>[2], now = NOW) =>
  gardenState(nodes, links, occs, now, UTC);

describe('seasons', () => {
  it('follows the calendar quarter', () => {
    expect(seasonOf(new Date('2026-02-01T00:00:00Z'), UTC)).toMatchObject({ name: 'Winter', year: 2026 });
    expect(seasonOf(new Date('2026-05-01T00:00:00Z'), UTC).name).toBe('Spring');
    expect(seasonOf(new Date('2026-08-01T00:00:00Z'), UTC).name).toBe('Summer');
    expect(seasonOf(NOW, UTC)).toMatchObject({ name: 'Autumn', key: 'quarter:2026-10-01' });
  });
});

describe('the art set', () => {
  it('is about fifteen pieces: seven plants, three trees, four ground pieces', () => {
    expect(PIECE_KINDS).toHaveLength(14);
    expect(new Set(Object.values(PLANT_FOR_PERIOD)).size).toBe(7);
  });
  it('stage counts up and never down', () => {
    expect([0, 1, 2, 3, 7, 8, 19, 20, 99].map(stageOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('gardenState: growth', () => {
  it('starts light: a habit with no logs this season shows no plant, and nothing is shown as neglect', () => {
    const s = g([habit({ id: 'h1' })], [], []);
    expect(s.pieces).toEqual([]);
    expect(s.empty).toBe(true);
  });

  it('a habit becomes a plant of its period species and grows with each kept log', () => {
    const h = habit({ id: 'h1', period: 'week', target: 2 });
    const one = g([h], [], logs('h1', ['2026-11-02']));
    const many = g([h], [], logs('h1', ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']));
    expect(one.pieces[0]).toMatchObject({ kind: 'fern', stage: 1, nodeId: 'h1', title: 'Stretch' });
    expect(many.pieces[0]!.stage).toBe(2);
  });

  it('kept periods become blooms, capped', () => {
    const h = habit({ id: 'h1', period: 'day', target: 1 });
    const days = Array.from({ length: 12 }, (_, i) => `2026-10-${String(i + 2).padStart(2, '0')}`);
    expect(g([h], [], logs('h1', days.slice(0, 2))).pieces[0]!.blooms).toBe(2);
    expect(g([h], [], logs('h1', days)).pieces[0]!.blooms).toBe(MAX_BLOOMS);
  });

  it('a period that ended below its target gives no bloom and costs nothing', () => {
    const h = habit({ id: 'h1', period: 'week', target: 3 });
    const s = g([h], [], logs('h1', ['2026-11-02'])); // 1 of 3
    expect(s.pieces[0]).toMatchObject({ stage: 1, blooms: 0 });
  });

  it('undoing a log undoes its growth', () => {
    const h = habit({ id: 'h1', period: 'day' });
    const l = ev('h1', 'logged', '2026-11-03T09:00:00.000Z', { id: 'L1' });
    const withLog = g([h], [], [l]);
    const undone = g([h], [], [l, ev('h1', 'undone', '2026-11-03T10:00:00.000Z', { undoes: 'L1' })]);
    expect(withLog.pieces).toHaveLength(1);
    expect(undone.pieces).toHaveLength(0);
  });

  it('goals are trees that grow with the steps done below them, undone ones excluded', () => {
    const nodes = [goal('G'), commitment('a'), commitment('b')];
    const links = [link('part_of', 'a', 'G'), link('part_of', 'b', 'G')];
    const sapling = g(nodes, links, []);
    expect(sapling.pieces[0]).toMatchObject({ nodeId: 'G', stage: 0 });
    expect(['oak', 'birch', 'pine']).toContain(sapling.pieces[0]!.kind);
    const grown = g(nodes, links, [ev('a', 'done', '2026-11-01T10:00:00.000Z'), ev('b', 'done', '2026-11-02T10:00:00.000Z', { id: 'D2' })]);
    expect(grown.pieces[0]!.stage).toBe(1);
    const back = g(nodes, links, [
      ev('a', 'done', '2026-11-01T10:00:00.000Z'), ev('b', 'done', '2026-11-02T10:00:00.000Z', { id: 'D2' }),
      ev('b', 'undone', '2026-11-02T11:00:00.000Z', { undoes: 'D2' }),
    ]);
    expect(back.pieces[0]!.stage).toBe(1); // one step still done
  });

  it('a milestone (a goal inside a goal) is not a separate tree', () => {
    const s = g([goal('G'), goal('M')], [link('part_of', 'M', 'G')], []);
    expect(s.pieces.map((p) => p.nodeId)).toEqual(['G']);
  });

  it('small things kept scatter ground pieces', () => {
    const nodes = [commitment('c1'), commitment('c2'), commitment('c3'), commitment('c4')];
    const occs = ['c1', 'c2', 'c3', 'c4'].map((id, i) => ev(id, 'done', `2026-11-0${i + 1}T10:00:00.000Z`));
    const ground = g(nodes, [], occs).pieces.filter((p) => GROUND_KINDS.includes(p.kind));
    expect(ground).toHaveLength(2);
  });
});

describe('gardenState: seasons and perennials', () => {
  const day = habit({ id: 'hd', period: 'day' });
  const year = habit({ id: 'hy', period: 'year', target: 1 });
  const occs = [...logs('hd', ['2026-08-10', '2026-08-11']), ...logs('hy', ['2026-08-12'])];

  it('a new season is light: season-scoped plants fade, perennials persist', () => {
    const summer = g([day, year], [], occs, new Date('2026-08-20T12:00:00Z'));
    expect(summer.pieces.map((p) => p.nodeId).sort()).toEqual(['hd', 'hy']);
    const autumn = g([day, year], [], occs);
    expect(autumn.pieces.map((p) => p.nodeId)).toEqual(['hy']);
    expect(autumn.pieces[0]!.kind).toBe('iris');
  });

  it('rests for the first days of a season, by the calendar alone', () => {
    expect(g([], [], [], new Date('2026-10-02T12:00:00Z')).resting).toBe(true);
    expect(g([], [], [], new Date(Date.UTC(2026, 9, 1 + RESTING_DAYS, 12))).resting).toBe(false);
    expect(g([], [], [], NOW).resting).toBe(false);
  });

  it('the same inputs give the same layout, and adding a plant never moves another', () => {
    const a = habit({ id: 'ha' });
    const b = habit({ id: 'hb' });
    const one = g([a], [], logs('ha', ['2026-11-02']));
    const two = g([a, b], [], [...logs('ha', ['2026-11-02']), ...logs('hb', ['2026-11-03'])]);
    const pa = (s: typeof one) => s.pieces.find((p) => p.id === 'ha')!;
    expect(pa(two)).toEqual(pa(one));
    expect(unit('x', 'a')).toBe(unit('x', 'a'));
    for (const p of two.pieces) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it('does not mutate its inputs', () => {
    const nodes = deepFreeze([day, goal('G')]);
    const o = deepFreeze(logs('hd', ['2026-11-02']));
    expect(() => g(nodes, [], o)).not.toThrow();
  });
});

describe('pressed book', () => {
  const day = habit({ id: 'hd', title: 'Walk', period: 'day' });
  const week = habit({ id: 'hw', title: 'Read', period: 'week' });
  const year = habit({ id: 'hy', title: 'Check-up', period: 'year' });
  const nodes = [day, week, year, goal('G'), commitment('c1')];
  const links = [link('part_of', 'c1', 'G')];
  const summer = [
    ...logs('hd', ['2026-08-10', '2026-08-11', '2026-08-12']), ...logs('hw', ['2026-08-13']), ...logs('hy', ['2026-08-14']),
    ev('c1', 'done', '2026-08-15T10:00:00.000Z'),
  ];

  it('presses the plants that grew most in a past season, never perennials', () => {
    const { seasons } = pressedBook(nodes, links, summer, NOW, [], UTC);
    expect(seasons).toHaveLength(1);
    expect(seasons[0]).toMatchObject({ name: 'Summer', year: 2026, kept: 6 });
    expect(seasons[0]!.plants.map((p) => p.title)).toEqual(['Walk', 'G', 'Read']);
    expect(seasons[0]!.plants.every((p) => p.nodeId !== 'hy')).toBe(true);
  });

  it('leaves out the current season and seasons with nothing kept', () => {
    const occs = [...summer, ...logs('hd', ['2026-11-02'])];
    expect(pressedBook(nodes, links, occs, NOW, [], UTC).seasons.map((s) => s.name)).toEqual(['Summer']);
    expect(pressedBook(nodes, links, [], NOW, [], UTC).seasons).toEqual([]);
  });

  it('a stored page wins, so a deleted habit stays in the book; only unstored pages are fresh', () => {
    const first = pressedBook(nodes, links, summer, NOW, [], UTC);
    expect(first.fresh).toHaveLength(1);
    const later = pressedBook([], [], summer, NOW, first.fresh, UTC);
    expect(later.seasons[0]!.plants.map((p) => p.title)).toEqual(['Walk', 'G', 'Read']);
    expect(later.fresh).toEqual([]);
  });

  it('an undone log is not pressed', () => {
    const l = ev('hd', 'logged', '2026-08-10T09:00:00.000Z', { id: 'X1' });
    const un = ev('hd', 'undone', '2026-08-10T10:00:00.000Z', { undoes: 'X1' });
    expect(pressSeason([day], [], [l, un], seasonOf(new Date('2026-08-20T00:00:00Z'), UTC), UTC)).toBeNull();
  });

  it('presses at most five plants per season', () => {
    const many = Array.from({ length: 7 }, (_, i) => habit({ id: `m${i}`, title: `M${i}`, period: 'day' }));
    const occs = many.flatMap((h) => logs(h.id, ['2026-08-10']));
    expect(pressSeason(many, [], occs, seasonOf(new Date('2026-08-20T00:00:00Z'), UTC), UTC)!.plants).toHaveLength(5);
  });
});

describe('keeping deleted plants in the book', () => {
  const day = habit({ id: 'hd', title: 'Walk', period: 'day' });
  const gone = habit({ id: 'hx', title: 'Gone', period: 'day' });
  const season = seasonOf(new Date('2026-08-20T00:00:00Z'), UTC);
  const occs = [...logs('hd', ['2026-08-10']), ...logs('hx', ['2026-08-11', '2026-08-12'])];

  it('a plant on the season draft whose node was deleted still gets pressed', () => {
    const draft = pressSeason([day, gone], [], occs, season, UTC)!;
    const book = pressedBook([day], [], occs, NOW, [], UTC, draft);
    expect(book.seasons[0]!.plants.map((p) => p.title)).toEqual(['Gone', 'Walk']);
    expect(pressedBook([day], [], occs, NOW, [], UTC).seasons[0]!.plants.map((p) => p.title)).toEqual(['Walk']);
  });

  it('still-existing plants come from the log, so an undone log is not kept alive by the draft', () => {
    const l = ev('hd', 'logged', '2026-08-10T09:00:00.000Z', { id: 'U1' });
    const draft = pressSeason([day], [], [l], season, UTC)!;
    const undone = [l, ev('hd', 'undone', '2026-08-10T10:00:00.000Z', { undoes: 'U1' })];
    expect(pressedBook([day], [], undone, NOW, [], UTC, draft).seasons).toEqual([]);
  });

  it('ignores a draft for another season', () => {
    const other = { ...pressSeason([day, gone], [], occs, season, UTC)!, key: 'quarter:2026-04-01' };
    expect(pressedBook([day], [], occs, NOW, [], UTC, other).seasons[0]!.plants.map((p) => p.title)).toEqual(['Walk']);
  });
});

describe('hemisphere', () => {
  const south = { ...UTC, hemisphere: 'south' } as const;

  it('names the seasons for the north by default and for the south when asked', () => {
    expect(seasonOf(new Date('2026-11-10T12:00:00Z'), UTC).name).toBe('Autumn');
    expect(seasonOf(new Date('2026-11-10T12:00:00Z'), south).name).toBe('Spring');
    expect(seasonOf(new Date('2026-02-10T12:00:00Z'), south).name).toBe('Summer');
    expect(seasonOf(new Date('2026-08-10T12:00:00Z'), south).name).toBe('Winter');
    expect(seasonOf(new Date('2026-05-10T12:00:00Z'), south).name).toBe('Autumn');
  });

  it('never changes the quarter key, so stored pages stay valid', () => {
    for (const iso of ['2026-02-10T12:00:00Z', '2026-05-10T12:00:00Z', '2026-08-10T12:00:00Z', '2026-11-10T12:00:00Z']) {
      expect(seasonOf(new Date(iso), south).key).toBe(seasonOf(new Date(iso), UTC).key);
    }
  });

  it('names a stored key in either hemisphere, and falls back on a key it cannot read', () => {
    expect(seasonNameOfKey('quarter:2026-10-01')).toBe('Autumn');
    expect(seasonNameOfKey('quarter:2026-10-01', 'south')).toBe('Spring');
    expect(seasonNameOfKey('quarter:2026-01-01', 'south')).toBe('Summer');
    expect(seasonNameOfKey('nonsense', 'south', 'Winter')).toBe('Winter');
    expect(seasonNameFor(7, 'south')).toBe('Winter');
  });

  it('puts the usual southern zones in the south and everything else in the north', () => {
    for (const z of ['Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Africa/Johannesburg']) {
      expect(hemisphereOfZone(z)).toBe('south');
    }
    for (const z of ['Europe/London', 'America/New_York', 'Asia/Tokyo', 'UTC', 'Asia/Kolkata']) expect(hemisphereOfZone(z)).toBe('north');
  });

  it('presses a page whose key does not depend on the hemisphere', () => {
    const day = habit({ id: 'hd', title: 'Walk', period: 'day' });
    const occs = [ev('hd', 'logged', '2026-08-10T09:00:00.000Z')];
    const at = new Date('2026-08-20T00:00:00Z');
    const northPage = pressSeason([day], [], occs, seasonOf(at, UTC), UTC)!;
    const southPage = pressSeason([day], [], occs, seasonOf(at, south), south)!;
    expect(southPage.key).toBe(northPage.key);
    expect([northPage.name, southPage.name]).toEqual(['Summer', 'Winter']);
  });
});
