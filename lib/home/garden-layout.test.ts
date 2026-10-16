import { describe, expect, it } from 'vitest';
import type { GardenPiece, PieceKind } from '../domain';
import { PAD, SCENE_W, TOP, crowded, layoutGarden, radiusOf } from './garden-layout';

const KINDS: PieceKind[] = ['sprout', 'fern', 'tulip', 'oak', 'pine', 'mushroom', 'stone', 'lantern', 'sunflower', 'birch'];
const piece = (i: number, over: Partial<GardenPiece> = {}): GardenPiece => ({
  id: `p${i}`, kind: KINDS[i % KINDS.length]!, stage: ((i * 3) % 5) as GardenPiece['stage'], blooms: 0,
  x: ((i * 37) % 100) / 100, y: ((i * 53) % 100) / 100, scale: 0.8 + ((i * 7) % 5) / 10, ...over,
});
const many = (n: number) => Array.from({ length: n }, (_, i) => piece(i));
const anyCrowded = (pieces: GardenPiece[]) => {
  const l = layoutGarden(pieces);
  const at = new Map(l.placed.map((p) => [p.id, p]));
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = at.get(pieces[i]!.id)!, b = at.get(pieces[j]!.id)!;
    if (crowded({ ...a, r: radiusOf(pieces[i]!) }, { ...b, r: radiusOf(pieces[j]!) })) return true;
  }
  return false;
};

describe('layoutGarden', () => {
  it('places every piece, none crowding another, at any count', () => {
    for (const n of [0, 1, 5, 12, 30, 60]) {
      const pieces = many(n);
      expect(layoutGarden(pieces).placed).toHaveLength(n);
      expect(anyCrowded(pieces)).toBe(false);
    }
  });
  it('separates two pieces that were given the same spot', () => {
    const l = layoutGarden([piece(0, { x: 0.5, y: 0.5 }), piece(1, { x: 0.5, y: 0.5 })]);
    expect(l.placed[0]!.x === l.placed[1]!.x && l.placed[0]!.y === l.placed[1]!.y).toBe(false);
  });
  it('leaves a piece where it was given when nothing is near', () => {
    const [p] = layoutGarden([piece(0, { x: 0.5, y: 0.5 })]).placed;
    expect(p!.x).toBeCloseTo(PAD + 0.5 * (SCENE_W - 2 * PAD));
  });
  it('grows the scene taller as the garden fills, and keeps pieces inside it', () => {
    const small = layoutGarden(many(3));
    const big = layoutGarden(many(60));
    expect(big.height).toBeGreaterThan(small.height);
    for (const p of big.placed) {
      expect(p.x).toBeGreaterThanOrEqual(PAD);
      expect(p.x).toBeLessThanOrEqual(SCENE_W - PAD);
      expect(p.y).toBeGreaterThanOrEqual(TOP);
      expect(p.y).toBeLessThanOrEqual(big.height);
    }
  });
  it('is the same every time for the same pieces', () => {
    expect(layoutGarden(many(25))).toEqual(layoutGarden(many(25)));
  });
});
