/**
 * Where each piece stands in the garden scene. Pure and framework-free.
 *
 * Every piece gets its own spot: it keeps the place the domain gave it (`x`, `y` in a unit square)
 * unless that would crowd a neighbour, and then it moves to the nearest free spot. When the garden
 * is too full for the space, the scene grows taller until everything fits.
 */
import { GROUND_KINDS, type GardenPiece } from '../domain';

export const SCENE_W = 480;
/** Where the planting band starts (the horizon), and how large pieces are drawn compared with their own units. */
export const TOP = 150;
export const ZOOM = 2.2;
export const PAD = 36;
const BASE_BAND = 130;
const BOTTOM_MARGIN = 28;
const GROW_BY = 40;
const MAX_GROWTHS = 80;

/** Half the drawn width of each piece at full size, in the piece's own units (leaves, blooms and companions included). */
const HALF_WIDTH: Partial<Record<GardenPiece['kind'], number>> = {
  fern: 27, oak: 21, birch: 15, pine: 17, mushroom: 14, stone: 15, clover: 14, lantern: 8,
};

const isGround = (p: Pick<GardenPiece, 'kind'>) => GROUND_KINDS.includes(p.kind);

/** How much of the scene a piece fills sideways, in scene units (plants and trees grow with their stage). */
export function radiusOf(p: Pick<GardenPiece, 'kind' | 'stage' | 'scale'>): number {
  const grow = isGround(p) ? 1 : 0.5 + p.stage * 0.125;
  return (HALF_WIDTH[p.kind] ?? 19) * (p.scale ?? 1) * grow * ZOOM;
}

export interface PlacedPiece { id: string; x: number; y: number }
export interface GardenLayout { width: number; height: number; band: number; placed: PlacedPiece[] }

/** True when two pieces would stand too close: wider apart sideways than front to back, since tall things hide what is behind them. */
export function crowded(a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }): boolean {
  const s = a.r + b.r;
  return ((a.x - b.x) / (0.85 * s)) ** 2 + ((a.y - b.y) / (1.2 * s)) ** 2 < 1;
}

function tryLayout(pieces: readonly GardenPiece[], band: number): PlacedPiece[] | null {
  const placed: (PlacedPiece & { r: number })[] = [];
  const ordered = [...pieces].sort((a, b) => radiusOf(b) - radiusOf(a) || a.id.localeCompare(b.id)); // big ones first, ties by id
  for (const p of ordered) {
    const r = radiusOf(p);
    const wantX = PAD + p.x * (SCENE_W - 2 * PAD);
    const wantY = TOP + p.y * band;
    const free = (x: number, y: number) => !placed.some((q) => crowded({ x, y, r }, q));
    let spot: { x: number; y: number } | null = free(wantX, wantY) ? { x: wantX, y: wantY } : null;
    if (!spot) {
      let best = Infinity;
      for (let y = TOP; y <= TOP + band; y += 8) {
        for (let x = PAD; x <= SCENE_W - PAD; x += 8) {
          const d = (x - wantX) ** 2 + (y - wantY) ** 2;
          if (d < best && free(x, y)) { best = d; spot = { x, y }; }
        }
      }
    }
    if (!spot) return null;
    placed.push({ id: p.id, ...spot, r });
  }
  return placed.map(({ id, x, y }) => ({ id, x, y }));
}

/** The layout for these pieces: the scene gets taller (more planting depth) until nothing is crowded. */
export function layoutGarden(pieces: readonly GardenPiece[]): GardenLayout {
  let band = BASE_BAND;
  for (let i = 0; i <= MAX_GROWTHS; i++, band += GROW_BY) {
    const placed = tryLayout(pieces, band);
    if (placed) return { width: SCENE_W, height: TOP + band + BOTTOM_MARGIN, band, placed };
  }
  // Unreachable in practice (80 growths is room for thousands of pieces); show them where the domain put them.
  const band2 = BASE_BAND + GROW_BY * MAX_GROWTHS;
  return { width: SCENE_W, height: TOP + band2 + BOTTOM_MARGIN, band: band2, placed: pieces.map((p) => ({ id: p.id, x: PAD + p.x * (SCENE_W - 2 * PAD), y: TOP + p.y * band2 })) };
}
