/**
 * Learned estimates for the Now card: how long something takes (from the
 * user's own history) and how long travel takes when offline. Pure and
 * deterministic; online routing is an injected provider elsewhere.
 *
 * Link direction used throughout (see ranking.ts): for `requires` and `at`,
 * `fromId` is the Commitment and `toId` is the prerequisite / the Place.
 */
import type { Commitment, Link, Node, Occurrence, Thing } from './types';

export const DEFAULT_DURATION_MIN = 30;
const MAX_DURATION_MIN = 8 * 60;

// ── occurrence helpers ──────────────────────────────────────────────────

/** Occurrences that still stand: 'undone' markers and the Occurrences they cancel are both removed. */
export function activeOccurrences(occs: readonly Occurrence[]): Occurrence[] {
  const cancelled = new Set<string>();
  for (const o of occs) if (o.type === 'undone' && o.undoes) cancelled.add(o.undoes);
  return occs.filter((o) => o.type !== 'undone' && !cancelled.has(o.id));
}

export function median(nums: readonly number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

// ── similarity ──────────────────────────────────────────────────────────

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'out', 'into', 'this', 'that', 'your', 'our']);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w)),
  );
}

/** Jaccard overlap of title tokens; two identical titles (even with no usable tokens) score 1. */
export function titleSimilarity(a: string, b: string): number {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return 1;
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

/** The Place a Commitment happens at: the target of its `at` Link that is a place Thing. */
export function placeOf(commitmentId: string, nodes: readonly Node[], links: readonly Link[]): Thing | null {
  for (const l of links) {
    if (l.type !== 'at' || l.fromId !== commitmentId) continue;
    const t = nodes.find((n) => n.id === l.toId);
    if (t && t.kind === 'thing' && t.thingType === 'place') return t;
  }
  return null;
}

// ── learned duration ────────────────────────────────────────────────────

export interface HistoryContext {
  nodes: readonly Node[];
  links: readonly Link[];
  occurrences: readonly Occurrence[];
}

/**
 * Median minutes from started to done across similar Commitments the user has
 * already finished (title similarity >= 0.5). When the Commitment has a Place
 * and similar items were done at that same Place, only those count (the Place
 * refines the estimate). Null when there is no history, so the caller falls
 * back to DEFAULT_DURATION_MIN.
 */
export function learnedDuration(c: Commitment, ctx: HistoryContext): number | null {
  const occs = activeOccurrences(ctx.occurrences);
  const myPlace = placeOf(c.id, ctx.nodes, ctx.links)?.id ?? null;
  const all: number[] = [];
  const samePlace: number[] = [];
  for (const other of ctx.nodes) {
    if (other.kind !== 'commitment' || other.id === c.id) continue;
    if (titleSimilarity(c.title, other.title) < 0.5) continue;
    const mine = occs.filter((o) => o.nodeId === other.id);
    const done = mine.filter((o) => o.type === 'done').map((o) => Date.parse(o.at)).sort((a, b) => b - a)[0];
    if (done === undefined) continue;
    const started = mine.filter((o) => o.type === 'started' && Date.parse(o.at) <= done)
      .map((o) => Date.parse(o.at)).sort((a, b) => b - a)[0];
    if (started === undefined) continue;
    const minutes = (done - started) / 60000;
    if (!(minutes > 0) || minutes > MAX_DURATION_MIN) continue;
    all.push(minutes);
    if (myPlace && placeOf(other.id, ctx.nodes, ctx.links)?.id === myPlace) samePlace.push(minutes);
  }
  const m = median(samePlace.length > 0 ? samePlace : all);
  return m === null ? null : Math.max(1, Math.round(m));
}

// ── offline travel ──────────────────────────────────────────────────────

export type TravelMode = 'drive' | 'walk' | 'cycle' | 'transit';

/** Typical door-to-door speeds used offline, in km/h (straight-line distance is scaled by CIRCUITY). */
export const TYPICAL_SPEED_KMH: Record<TravelMode, number> = { drive: 40, walk: 5, cycle: 15, transit: 25 };
export const CIRCUITY = 1.3;

export interface LatLon { lat: number; lon: number }

export function haversineKm(a: LatLon, b: LatLon): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Offline travel estimate in whole minutes (rounded up), scaled by a learned correction ratio. */
export function estimateTravelMinutes(from: LatLon, to: LatLon, mode: TravelMode = 'drive', correction = 1): number {
  const km = haversineKm(from, to) * CIRCUITY;
  return Math.ceil((km / TYPICAL_SPEED_KMH[mode]) * 60 * correction);
}

export interface TravelSample { estimatedMin: number; actualMin: number }

/**
 * The correction ratio learned from past actual travel: the median of
 * actual / estimated, clamped to [0.5, 3]; 1 when there is no usable sample.
 * Callers build the samples from the log (a trip's estimate vs the actual time).
 */
export function travelCorrection(samples: readonly TravelSample[]): number {
  const ratios = samples.filter((s) => s.estimatedMin > 0 && s.actualMin > 0).map((s) => s.actualMin / s.estimatedMin);
  const m = median(ratios);
  return m === null ? 1 : Math.min(3, Math.max(0.5, m));
}
