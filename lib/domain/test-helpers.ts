// Test-only builders. Not exported from index.ts.
import type { Commitment, Goal, Habit, Link, LinkType, Occurrence, OccurrenceType, Period, Thing } from './types';

export const at = (iso: string) => new Date(iso);
export const iso = (d: Date) => d.toISOString();
export const UTC = { timeZone: 'UTC' } as const;

export function habit(over: Partial<Habit> & { period?: Period; target?: number } = {}): Habit {
  const { period, target, ...rest } = over;
  return {
    id: 'h1', kind: 'habit', title: 'Stretch', private: false, quiet: false,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    recurrence: { period: period ?? 'day', target: target ?? 1 },
    ...rest,
  };
}

let seq = 0;
export function occ(type: OccurrenceType, when: string, extra: Partial<Occurrence> = {}): Occurrence {
  seq += 1;
  return { id: `o${seq}`, nodeId: 'h1', type, at: when, source: 'app', ...extra };
}

/** Deterministic id generator for habitTap. */
export function counter(prefix = 'n') {
  let n = 0;
  return () => `${prefix}${++n}`;
}

// ── builders for ranking tests ──────────────────────────────────────────

const STAMP = '2026-01-01T00:00:00.000Z';

export function commitment(id: string, over: Partial<Commitment> = {}): Commitment {
  return { id, kind: 'commitment', title: id, private: false, createdAt: STAMP, updatedAt: STAMP, slog: false, quiet: false, ...over };
}

export function goal(id: string, over: Partial<Goal> = {}): Goal {
  return { id, kind: 'goal', title: id, private: false, createdAt: STAMP, updatedAt: STAMP, finishLine: false, checkpoint: false, ...over };
}

export function place(id: string, lat = 0, lon = 0): Thing {
  return { id, kind: 'thing', thingType: 'place', title: id, private: false, createdAt: STAMP, updatedAt: STAMP, lat, lon };
}

export function link(type: LinkType, fromId: string, toId: string): Link {
  return { id: `${type}:${fromId}>${toId}`, type, fromId, toId, origin: 'stated', confidence: 1, evidence: [], createdAt: STAMP, updatedAt: STAMP };
}

/** An Occurrence on a given node. */
export function ev(nodeId: string, type: OccurrenceType, when: string, extra: Partial<Occurrence> = {}): Occurrence {
  return occ(type, when, { nodeId, ...extra });
}

/** Recursively freeze, so a test fails if the code under test mutates its input. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}
