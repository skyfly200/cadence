/**
 * The slog (ticket 17): something draining or boring the user tags, or that Cadence notices has been
 * put off often and offers to tag. A slog earns a bigger reward (see rewards.ts) and a two-minute
 * "just start" ritual. Pure and framework-free.
 */
import type { Occurrence } from '../domain/types';
import { activeOccurrences } from '../domain/estimates';

/** Postponements (Not now or sent to the heap) of one item before the slog tag is offered. */
export const SLOG_OFFER_AT = 3;

/** Active (not undone) 'moved' and 'parked' Occurrences on an item. */
export function postponeCount(nodeId: string, occs: readonly Occurrence[]): number {
  return activeOccurrences(occs).filter((o) => o.nodeId === nodeId && (o.type === 'moved' || o.type === 'parked')).length;
}

/** Offer the slog tag once an untagged item has been put off SLOG_OFFER_AT times, unless the user already said no. */
export function shouldOfferSlog(nodeId: string, isSlog: boolean, occs: readonly Occurrence[], dismissed: readonly string[]): boolean {
  return !isSlog && !dismissed.includes(nodeId) && postponeCount(nodeId, occs) >= SLOG_OFFER_AT;
}

// ── the two-minute ritual ───────────────────────────────────

export const RITUAL_MS = 2 * 60 * 1000;

export interface RitualState {
  /** Whole seconds left of the two minutes, never below 0. */
  remainingSec: number;
  /** The two minutes are up: keep going or stop here, either is fine. */
  over: boolean;
}

export function ritualState(startedAtMs: number, nowMs: number): RitualState {
  const left = Math.max(0, RITUAL_MS - Math.max(0, nowMs - startedAtMs));
  return { remainingSec: Math.ceil(left / 1000), over: left === 0 };
}

/** m:ss for the countdown. */
export function ritualClock(remainingSec: number): string {
  const s = Math.max(0, Math.round(remainingSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const RITUAL_INTRO = 'Just two minutes. Start, and you are allowed to stop after.';
export const RITUAL_OVER = 'Two minutes in. Keep going, or stop here. Either is fine.';
