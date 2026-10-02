/**
 * The Garden and the Pressed book, derived from the Occurrence log (SPEC section 7, ticket 17).
 * Pure and deterministic: the same nodes, links, log and clock always give the same garden, so
 * it can be recomputed on any device and an undone log undoes its growth.
 *
 * - Habits become plants (the species follows the period), kept periods become blooms, Goals
 *   become trees. Growth is a count of kept things; nothing here can wilt, shrink or show neglect.
 * - A Season is a calendar quarter. A new season starts with a light garden because the
 *   season-scoped plants (day, week and month habits) count only that season's logs; goals and
 *   longer-period habits are perennials and keep all their growth.
 * - Each past season has a Pressed book page: the few plants that grew most that season.
 * - Positions come from a hash of the node id, so a layout is stable and adding a plant never
 *   moves another one.
 */
import type { Goal, Habit, Link, Node, Occurrence, Period } from './types';
import { activeOccurrences } from './estimates';
import { childrenOf, descendants } from './goals';
import { activeLogs } from './habits';
import { inWindow, localParts, periodWindow, previousWindow, type PeriodOptions, type PeriodWindow } from './periods';
import { keptInWindow } from './tally';

// ── the art set ─────────────────────────────────────────────────

/** Seven plants (one per period), three trees, four small ground pieces: 14 placeable pieces, plus the bloom drawn on a plant. */
export type PieceKind =
  | 'sprout' | 'fern' | 'lavender' | 'tulip' | 'sunflower' | 'foxglove' | 'iris'
  | 'oak' | 'birch' | 'pine'
  | 'mushroom' | 'stone' | 'clover' | 'lantern';

export const PLANT_FOR_PERIOD: Record<Period, PieceKind> = {
  day: 'sprout', week: 'fern', month: 'lavender', quarter: 'tulip', four_months: 'sunflower', six_months: 'foxglove', year: 'iris',
};
export const TREE_KINDS: readonly PieceKind[] = ['oak', 'birch', 'pine'];
export const GROUND_KINDS: readonly PieceKind[] = ['mushroom', 'stone', 'clover', 'lantern'];
export const PIECE_KINDS: readonly PieceKind[] = [...Object.values(PLANT_FOR_PERIOD), ...TREE_KINDS, ...GROUND_KINDS];

/** Habits with these periods outlast a season: their plants keep all their growth. */
export const PERENNIAL_PERIODS: readonly Period[] = ['quarter', 'four_months', 'six_months', 'year'];

/** Kept counts at which a plant or tree reaches stage 1 to 4. Stage 0 is a seedling or sapling. */
export const STAGE_AT = [1, 3, 8, 20] as const;
export const MAX_BLOOMS = 5;
export const MAX_GROUND = 12;
export const PRESS_PLANTS = 5;
/** The first days of a season are shown as "resting", by the calendar alone. */
export const RESTING_DAYS = 3;
const MAX_WINDOWS = 400;
const MAX_SEASONS = 80;

export type Stage = 0 | 1 | 2 | 3 | 4;

export function stageOf(count: number): Stage {
  return STAGE_AT.filter((t) => count >= t).length as Stage;
}

// ── seasons ─────────────────────────────────────────────────────

export type SeasonName = 'Winter' | 'Spring' | 'Summer' | 'Autumn';

export interface Season {
  /** The quarter window key, e.g. 'quarter:2026-10-01'. */
  key: string;
  name: SeasonName;
  year: number;
  start: Date;
  end: Date;
}

export type Hemisphere = 'north' | 'south';

/** Period options plus the hemisphere the season names follow (default north). Names only: the quarter windows and keys never change. */
export interface GardenOptions extends PeriodOptions { hemisphere?: Hemisphere }

const NAMES: Record<Hemisphere, Record<number, SeasonName>> = {
  north: { 1: 'Winter', 4: 'Spring', 7: 'Summer', 10: 'Autumn' },
  south: { 1: 'Summer', 4: 'Autumn', 7: 'Winter', 10: 'Spring' },
};

/** The season name for a quarter that starts in `month` (1, 4, 7 or 10). */
export function seasonNameFor(month: number, hemisphere: Hemisphere = 'north'): SeasonName {
  return NAMES[hemisphere][month] ?? 'Winter';
}

/** The season name for a stored quarter key such as 'quarter:2026-10-01', in the given hemisphere. */
export function seasonNameOfKey(key: string, hemisphere: Hemisphere = 'north', fallback: SeasonName = 'Winter'): SeasonName {
  const m = /(\d{4})-(\d{2})-\d{2}$/.exec(key);
  return m ? seasonNameFor(Number(m[2]), hemisphere) : fallback;
}

// A heuristic, not a map: the zones whose cities lie mostly south of the equator. The Settings override covers the rest.
const SOUTH_PREFIXES = ['Australia/', 'Antarctica/', 'America/Argentina/'];
const SOUTH_ZONES = new Set([
  'Pacific/Auckland', 'Pacific/Chatham', 'Pacific/Fiji', 'Pacific/Tongatapu', 'Pacific/Apia', 'Pacific/Tahiti', 'Pacific/Port_Moresby', 'Pacific/Noumea', 'Pacific/Norfolk',
  'America/Sao_Paulo', 'America/Santiago', 'America/Lima', 'America/La_Paz', 'America/Asuncion', 'America/Montevideo', 'America/Bahia', 'America/Fortaleza', 'America/Recife', 'America/Manaus', 'America/Cuiaba', 'America/Campo_Grande', 'America/Belem',
  'Africa/Johannesburg', 'Africa/Maputo', 'Africa/Harare', 'Africa/Lusaka', 'Africa/Luanda', 'Africa/Windhoek', 'Africa/Gaborone', 'Africa/Maseru', 'Africa/Mbabane', 'Africa/Lubumbashi', 'Africa/Blantyre', 'Africa/Dar_es_Salaam',
  'Indian/Antananarivo', 'Indian/Mauritius', 'Indian/Reunion', 'Asia/Jakarta', 'Asia/Makassar', 'Atlantic/Stanley', 'Atlantic/South_Georgia',
]);

/** Which hemisphere a time zone is in, for naming the seasons. */
export function hemisphereOfZone(timeZone: string): Hemisphere {
  return SOUTH_ZONES.has(timeZone) || SOUTH_PREFIXES.some((p) => timeZone.startsWith(p)) ? 'south' : 'north';
}

function zoneOf(opts: PeriodOptions): string {
  return opts.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function seasonFrom(w: PeriodWindow, opts: GardenOptions): Season {
  const p = localParts(w.start, zoneOf(opts));
  return { key: w.key, name: seasonNameFor(p.m, opts.hemisphere), year: p.y, start: w.start, end: w.end };
}

/** The season (calendar quarter) containing `at`. Names follow `opts.hemisphere` (north by default). */
export function seasonOf(at: Date, opts: GardenOptions = {}): Season {
  return seasonFrom(periodWindow('quarter', at, opts), opts);
}

// ── stable placement ────────────────────────────────────────────

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** A stable number in [0, 1) from an id and a salt. */
export function unit(id: string, salt: string): number {
  return (hash(`${id}:${salt}`) % 10000) / 10000;
}

// ── the garden ──────────────────────────────────────────────────

export interface GardenPiece {
  id: string;
  kind: PieceKind;
  stage: Stage;
  /** Kept periods shown as blooms on a plant, 0 to MAX_BLOOMS. */
  blooms: number;
  /** Position in a unit square: x left to right, y back (0) to front (1). */
  x: number;
  y: number;
  /** 0.8 to 1.2, a little variety. */
  scale: number;
  nodeId?: string;
  title?: string;
}

export interface GardenState {
  season: Season;
  pieces: GardenPiece[];
  /** Things kept this season (done, logged, started; undone ones excluded). */
  kept: number;
  /** The first days of a new season: shown as resting, never because of activity. */
  resting: boolean;
  empty: boolean;
}

function place(id: string, band: [number, number]): Pick<GardenPiece, 'x' | 'y' | 'scale'> {
  return { x: 0.06 + 0.88 * unit(id, 'x'), y: band[0] + (band[1] - band[0]) * unit(id, 'y'), scale: 0.8 + 0.4 * unit(id, 's') };
}

const isPerennial = (h: Habit) => PERENNIAL_PERIODS.includes(h.recurrence.period);

/** How many periods of the habit were met, among the windows from the one containing `from` up to `to`. */
function metPeriods(habit: Habit, occs: readonly Occurrence[], from: Date, to: Date, opts: PeriodOptions): number {
  const logs = activeLogs(habit.id, occs).map((o) => new Date(o.at).getTime()).sort((a, b) => a - b);
  const target = Math.max(1, habit.recurrence.target);
  let w = periodWindow(habit.recurrence.period, from, opts);
  let met = 0;
  for (let i = 0; i < MAX_WINDOWS && w.start.getTime() < to.getTime(); i++, w = periodWindow(habit.recurrence.period, w.end, opts)) {
    const n = logs.filter((t) => t >= w.start.getTime() && t < w.end.getTime()).length;
    if (n >= target) met++;
  }
  return met;
}

interface Growth { count: number; blooms: number }

/** A habit's growth in a scope: a season for day, week and month habits, everything up to `until` for perennials. */
function habitGrowth(h: Habit, occs: readonly Occurrence[], season: Season, until: Date, opts: PeriodOptions): Growth {
  const from = isPerennial(h) ? new Date(0) : season.start;
  const to = isPerennial(h) ? until : season.end;
  const count = activeLogs(h.id, occs).filter((o) => { const t = new Date(o.at).getTime(); return t >= from.getTime() && t < to.getTime() && t <= until.getTime(); }).length;
  const start = isPerennial(h) ? new Date(h.createdAt) : season.start;
  const blooms = Math.min(MAX_BLOOMS, count ? metPeriods(h, occs, start, to, opts) : 0);
  return { count, blooms };
}

/** Top-level Goals: those that are not a part of another Goal. */
function topGoals(nodes: readonly Node[], links: readonly Link[]): Goal[] {
  const goalIds = new Set(nodes.filter((n) => n.kind === 'goal').map((n) => n.id));
  const nested = new Set(links.filter((l) => l.type === 'part_of' && goalIds.has(l.toId)).map((l) => l.fromId));
  return nodes.filter((n): n is Goal => n.kind === 'goal' && !nested.has(n.id));
}

/** Done Commitments below a Goal, optionally only those done inside a window (an undone 'done' never counts). */
function goalDone(goal: Goal, nodes: readonly Node[], children: Map<string, string[]>, active: readonly Occurrence[], window?: PeriodWindow): number {
  const ids = new Set(descendants(goal.id, children).filter((id) => nodes.find((n) => n.id === id)?.kind === 'commitment'));
  const done = new Set<string>();
  for (const o of active) if (o.type === 'done' && ids.has(o.nodeId) && (!window || inWindow(window, new Date(o.at)))) done.add(o.nodeId);
  return done.size;
}

/** The garden for the season containing `now`. */
export function gardenState(
  nodes: readonly Node[], links: readonly Link[], occurrences: readonly Occurrence[], now: Date, opts: GardenOptions = {},
): GardenState {
  const window = periodWindow('quarter', now, opts);
  const season = seasonFrom(window, opts);
  const active = activeOccurrences(occurrences);
  const pieces: GardenPiece[] = [];

  for (const h of nodes.filter((n): n is Habit => n.kind === 'habit')) {
    const g = habitGrowth(h, occurrences, season, now, opts);
    if (g.count < 1) continue;
    pieces.push({ id: h.id, kind: PLANT_FOR_PERIOD[h.recurrence.period], stage: stageOf(g.count), blooms: g.blooms, ...place(h.id, [0.4, 0.85]), nodeId: h.id, title: h.title });
  }

  const children = childrenOf(links);
  for (const goal of topGoals(nodes, links)) {
    pieces.push({
      id: goal.id, kind: TREE_KINDS[hash(goal.id) % TREE_KINDS.length]!, stage: stageOf(goalDone(goal, nodes, children, active)), blooms: 0,
      ...place(goal.id, [0.2, 0.45]), nodeId: goal.id, title: goal.title,
    });
  }

  // Small things kept (commitments done or started) scatter ground pieces: a mushroom, a stone, clover, a lantern.
  const habitIds = new Set(nodes.filter((n) => n.kind === 'habit').map((n) => n.id));
  const others = active.filter((o) => (o.type === 'done' || o.type === 'started') && !habitIds.has(o.nodeId) && inWindow(window, new Date(o.at))).length;
  for (let i = 0; i < Math.min(MAX_GROUND, Math.floor(others / 2)); i++) {
    const id = `ground:${season.key}:${i}`;
    pieces.push({ id, kind: GROUND_KINDS[hash(id) % GROUND_KINDS.length]!, stage: 1, blooms: 0, ...place(id, [0.65, 0.95]) });
  }

  pieces.sort((a, b) => a.y - b.y || (a.id < b.id ? -1 : 1)); // back to front, for painting
  return {
    season, pieces, kept: keptInWindow(occurrences, window),
    resting: now.getTime() - season.start.getTime() < RESTING_DAYS * 86_400_000,
    empty: pieces.length === 0,
  };
}

// ── the Pressed book ────────────────────────────────────────────

export interface PressedPlant {
  nodeId: string;
  title: string;
  kind: PieceKind;
  stage: Stage;
  /** Logs (habit) or steps done (goal) that season. */
  count: number;
}

export interface PressedSeason {
  key: string;
  name: SeasonName;
  year: number;
  plants: PressedPlant[];
  kept: number;
}

/** One past season's page: the few plants that grew most, or null if nothing was kept that season. */
export function pressSeason(
  nodes: readonly Node[], links: readonly Link[], occurrences: readonly Occurrence[], season: Season, opts: GardenOptions = {},
): PressedSeason | null {
  const window = periodWindow('quarter', season.start, opts);
  const kept = keptInWindow(occurrences, window);
  if (kept === 0) return null;
  const active = activeOccurrences(occurrences);
  const children = childrenOf(links);
  const candidates: PressedPlant[] = [];
  for (const h of nodes.filter((n): n is Habit => n.kind === 'habit' && !isPerennial(n))) {
    const count = activeLogs(h.id, occurrences).filter((o) => inWindow(window, new Date(o.at))).length;
    if (count > 0) candidates.push({ nodeId: h.id, title: h.title, kind: PLANT_FOR_PERIOD[h.recurrence.period], stage: stageOf(count), count });
  }
  for (const g of topGoals(nodes, links)) {
    const count = goalDone(g, nodes, children, active, window);
    if (count > 0) candidates.push({ nodeId: g.id, title: g.title, kind: TREE_KINDS[hash(g.id) % TREE_KINDS.length]!, stage: stageOf(count), count });
  }
  candidates.sort((a, b) => b.count - a.count || (a.nodeId < b.nodeId ? -1 : 1));
  return { key: season.key, name: season.name, year: season.year, plants: candidates.slice(0, PRESS_PLANTS), kept };
}

/**
 * A page for a season with the plants of `earlier` (a rolling draft kept while the season ran) whose
 * node has since been deleted: deleting a habit never erases it from the book.
 */
export function keepDeleted(page: PressedSeason | null, earlier: PressedSeason | undefined, nodes: readonly Node[]): PressedSeason | null {
  if (!earlier || (page && page.key !== earlier.key)) return page;
  const live = new Set(nodes.map((n) => n.id));
  const gone = earlier.plants.filter((p) => !live.has(p.nodeId));
  if (!gone.length) return page;
  const base: PressedSeason = page ?? { key: earlier.key, name: earlier.name, year: earlier.year, plants: [], kept: earlier.kept };
  const plants = [...base.plants, ...gone].sort((a, b) => b.count - a.count || (a.nodeId < b.nodeId ? -1 : 1)).slice(0, PRESS_PLANTS);
  return { ...base, plants, kept: Math.max(base.kept, earlier.kept) };
}

export interface PressedBook {
  /** Newest first. A stored page always wins over a recomputed one. */
  seasons: PressedSeason[];
  /** Pages computed now that were not in `stored`: the caller keeps them so deleted items still appear. */
  fresh: PressedSeason[];
}

/** Every past season that had something kept. The current season is never pressed; it is still growing. */
export function pressedBook(
  nodes: readonly Node[], links: readonly Link[], occurrences: readonly Occurrence[], now: Date,
  stored: readonly PressedSeason[] = [], opts: GardenOptions = {}, draft?: PressedSeason,
): PressedBook {
  const storedByKey = new Map(stored.map((s) => [s.key, s] as const));
  const earliest = occurrences.reduce((m, o) => Math.min(m, new Date(o.at).getTime()), Infinity);
  const seasons: PressedSeason[] = [];
  const fresh: PressedSeason[] = [];
  let w = previousWindow(periodWindow('quarter', now, opts), opts);
  for (let i = 0; i < MAX_SEASONS && w.end.getTime() > earliest; i++, w = previousWindow(w, opts)) {
    const kept = storedByKey.get(w.key);
    if (kept) { seasons.push(kept); continue; }
    const page = keepDeleted(pressSeason(nodes, links, occurrences, seasonFrom(w, opts), opts), draft?.key === w.key ? draft : undefined, nodes);
    if (page) { seasons.push(page); fresh.push(page); }
  }
  return { seasons, fresh };
}
