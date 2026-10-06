/**
 * Goals: progress through their part-of tree, and each Goal's next step.
 * Pure (no Vue, no Pinia). The next-step walk here is the one the Now card's
 * tier 4 uses (ranking.ts), so the Goals lens and Now never disagree.
 */
import type { Commitment, Goal, Link, Node, Occurrence } from './types';
import { activeOccurrences } from './estimates';
import { inTimeWindow } from './periods';
import { isParked } from './shelf';

const byOrder = (a: Goal, b: Goal) => (a.order ?? Infinity) - (b.order ?? Infinity) || byAge(a, b);
const byAge = (a: Node, b: Node) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : 1);

/** part-of children by parent id (a Link runs child -> parent). */
export function childrenOf(links: readonly Link[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const l of links) if (l.type === 'part_of') (children.get(l.toId) ?? children.set(l.toId, []).get(l.toId)!).push(l.fromId);
  return children;
}

/** Every node id below `rootId` through part-of Links, in walk order. A cycle is visited once and never loops. */
export function descendants(rootId: string, children: Map<string, string[]>): string[] {
  const seen = new Set<string>([rootId]);
  const out: string[] = [];
  const walk = (id: string) => {
    for (const child of children.get(id) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push(child);
      walk(child);
    }
  };
  walk(rootId);
  return out;
}

/**
 * The next step per Goal: the oldest eligible Commitment below it, and the first
 * Goal (oldest first) to claim a Commitment wins it. Returns commitment id -> goal id.
 */
export function goalNextSteps(nodes: readonly Node[], links: readonly Link[], eligible: readonly Commitment[]): Map<string, string> {
  const children = childrenOf(links);
  const eligibleById = new Map(eligible.map((c) => [c.id, c] as const));
  const claimed = new Map<string, string>();
  for (const g of nodes.filter((n) => n.kind === 'goal').sort(byAge)) {
    const found = descendants(g.id, children).flatMap((id) => eligibleById.get(id) ?? []).sort(byAge);
    const step = found.find((c) => !claimed.has(c.id));
    if (step) claimed.set(step.id, g.id);
  }
  return claimed;
}

export interface GoalProgress {
  done: number;
  total: number;
  /** 0..1; 0 when the Goal has no Commitments yet. */
  fraction: number;
}

export interface MilestoneRow extends GoalProgress { goal: Goal }

export interface GoalRow extends GoalProgress {
  goal: Goal;
  /** Child Goals (milestones), each with its own progress. */
  milestones: MilestoneRow[];
  /** The open, ready Commitment that is this Goal's next step (what the Now card would call it). */
  next: Commitment | null;
}

/** Done / total Commitments below a Goal (any depth); a Commitment counts as done unless its 'done' was undone. */
function progressOf(id: string, byId: Map<string, Node>, children: Map<string, string[]>, doneIds: Set<string>): GoalProgress {
  const cs = descendants(id, children).flatMap((d) => { const n = byId.get(d); return n?.kind === 'commitment' ? [n] : []; });
  const done = cs.filter((c) => doneIds.has(c.id)).length;
  return { done, total: cs.length, fraction: cs.length ? done / cs.length : 0 };
}

/** One row per Goal that is not itself a milestone of another Goal, in the user's order (then oldest first). */
export function goalRows(
  nodes: readonly Node[], links: readonly Link[], occurrences: readonly Occurrence[],
  now: Date = new Date(), timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): GoalRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const children = childrenOf(links);
  const doneIds = new Set(activeOccurrences(occurrences).filter((o) => o.type === 'done').map((o) => o.nodeId));
  const prereqs = new Map<string, string[]>();
  for (const l of links) if (l.type === 'requires') (prereqs.get(l.fromId) ?? prereqs.set(l.fromId, []).get(l.fromId)!).push(l.toId);
  const ready = (c: Commitment) => (prereqs.get(c.id) ?? []).every((id) => { const t = byId.get(id); return !t || t.kind !== 'commitment' || doneIds.has(id); });
  const open = nodes.filter((n): n is Commitment => n.kind === 'commitment' && !doneIds.has(n.id) && !isParked(n.id, occurrences) && ready(n) && inTimeWindow(n.windowStart, n.windowEnd, now, timeZone));
  const nextByGoal = new Map<string, Commitment>();
  for (const [cid, gid] of goalNextSteps(nodes, links, open)) nextByGoal.set(gid, byId.get(cid) as Commitment);

  const isMilestone = new Set(links.filter((l) => l.type === 'part_of' && byId.get(l.fromId)?.kind === 'goal' && byId.get(l.toId)?.kind === 'goal').map((l) => l.fromId));
  return nodes.filter((n): n is Goal => n.kind === 'goal' && !isMilestone.has(n.id)).sort(byOrder).map((goal) => ({
    goal,
    ...progressOf(goal.id, byId, children, doneIds),
    milestones: (children.get(goal.id) ?? []).flatMap((id) => {
      const m = byId.get(id);
      return m?.kind === 'goal' ? [{ goal: m, ...progressOf(m.id, byId, children, doneIds) }] : [];
    }),
    next: nextByGoal.get(goal.id) ?? null,
  }));
}
