// Test-only builders. Not exported from index.ts.
import type { Habit, Occurrence, OccurrenceType, Period } from './types';

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
