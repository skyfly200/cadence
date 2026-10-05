/**
 * The optional Eisenhower view ("Go deeper"). Quadrants are derived, never asked for:
 * - **Urgent**: a deadline or fixed time within URGENT_HOURS from now (or already past).
 * - **Important**: part of a Goal (a part-of path leads to one), or tagged as a slog.
 * Done and parked items are left out. Pure and framework-free.
 */
import { activeOccurrences } from './estimates';
import { isParked } from './shelf';
import type { Commitment, Link, Node, Occurrence } from './types';

export const URGENT_HOURS = 48;

export type Quadrant = 'do' | 'plan' | 'quick' | 'later';
export const QUADRANTS: readonly Quadrant[] = ['do', 'plan', 'quick', 'later'];

export interface QuadrantItem { id: string; title: string; quadrant: Quadrant; }

/** Commitments by quadrant, soonest-dated first within each; undated ones keep their creation order. */
export function eisenhower(nodes: readonly Node[], links: readonly Link[], occs: readonly Occurrence[], now: Date): Record<Quadrant, QuadrantItem[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parents = new Map<string, string[]>();
  for (const l of links) if (l.type === 'part_of') (parents.get(l.fromId) ?? parents.set(l.fromId, []).get(l.fromId)!).push(l.toId);
  const underGoal = (id: string): boolean => {
    const seen = new Set<string>([id]);
    const stack = [...(parents.get(id) ?? [])];
    while (stack.length) {
      const p = stack.pop()!;
      if (seen.has(p)) continue;
      seen.add(p);
      if (byId.get(p)?.kind === 'goal') return true;
      stack.push(...(parents.get(p) ?? []));
    }
    return false;
  };
  const done = new Set(activeOccurrences(occs).filter((o) => o.type === 'done').map((o) => o.nodeId));
  const horizon = now.getTime() + URGENT_HOURS * 3600_000;
  const when = (c: Commitment): number => {
    const t = [c.fixedTime, c.deadline].filter((x): x is string => !!x).map(Date.parse);
    return t.length ? Math.min(...t) : Infinity;
  };

  const out: Record<Quadrant, (QuadrantItem & { t: number; made: string })[]> = { do: [], plan: [], quick: [], later: [] };
  for (const n of nodes) {
    if (n.kind !== 'commitment' || done.has(n.id) || isParked(n.id, occs)) continue;
    const t = when(n);
    const urgent = t <= horizon;
    const important = n.slog || underGoal(n.id);
    const quadrant: Quadrant = urgent ? (important ? 'do' : 'quick') : (important ? 'plan' : 'later');
    out[quadrant].push({ id: n.id, title: n.title, quadrant, t, made: n.createdAt });
  }
  const sorted = {} as Record<Quadrant, QuadrantItem[]>;
  for (const q of QUADRANTS) {
    sorted[q] = out[q]
      .sort((a, b) => (a.t === b.t ? a.made.localeCompare(b.made) : a.t - b.t))
      .map(({ t: _t, made: _m, ...item }) => item);
  }
  return sorted;
}
