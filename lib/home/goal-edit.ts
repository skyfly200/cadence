/**
 * Pure builders for the Goals lens: new Goals, milestones and steps, and the
 * stated part-of Links that tie them together. No Vue, no Pinia, no side effects.
 */
import type { Commitment, Goal, Link, Node } from '../domain';

/** A new Goal or milestone (a Goal marked as a checkpoint). Null for an empty title. */
export function newGoal(title: string, now: Date, id: string, checkpoint = false): Goal | null {
  const t = title.trim();
  if (!t) return null;
  const stamp = now.toISOString();
  return { id, kind: 'goal', title: t, private: false, createdAt: stamp, updatedAt: stamp, finishLine: false, checkpoint };
}

/** A new open Commitment to hang under a Goal. Null for an empty title. */
export function newStep(title: string, now: Date, id: string): Commitment | null {
  const t = title.trim();
  if (!t) return null;
  const stamp = now.toISOString();
  return { id, kind: 'commitment', title: t, private: false, createdAt: stamp, updatedAt: stamp, slog: false, quiet: false };
}

/**
 * The stated part-of Link "child is part of parent", or null when it already
 * exists, would nest something in itself, or would close a loop.
 */
export function partOf(links: readonly Link[], childId: string, parentId: string, now: Date, id: string): Link | null {
  if (childId === parentId) return null;
  if (links.some((l) => l.type === 'part_of' && l.fromId === childId && l.toId === parentId)) return null;
  // a loop exists if the parent is already somewhere below the child
  const seen = new Set<string>();
  const stack = [childId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === parentId) return null;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const l of links) if (l.type === 'part_of' && l.toId === cur) stack.push(l.fromId);
  }
  const stamp = now.toISOString();
  return { id, type: 'part_of', fromId: childId, toId: parentId, origin: 'stated', confidence: 1, evidence: [], createdAt: stamp, updatedAt: stamp };
}

/** Open Commitments not yet under this Goal or milestone: what "Attach" can offer. */
export function attachable(nodes: readonly Node[], links: readonly Link[], parentId: string, doneIds: ReadonlySet<string>): Commitment[] {
  return nodes.filter((n): n is Commitment => n.kind === 'commitment' && !doneIds.has(n.id)
    && !links.some((l) => l.type === 'part_of' && l.fromId === n.id && l.toId === parentId));
}

/** The new `order` for each goal id once `id` moves one place up or down in `ids` (the list as shown); empty if it cannot move. */
export function movedOrder(ids: readonly string[], id: string, dir: -1 | 1): Map<string, number> {
  const at = ids.indexOf(id);
  const to = at + dir;
  if (at < 0 || to < 0 || to >= ids.length) return new Map();
  const next = [...ids];
  [next[at], next[to]] = [next[to]!, next[at]!];
  return new Map(next.map((x, i) => [x, i] as const));
}
