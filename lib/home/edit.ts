/**
 * Pure functions for editing and deleting Commitments and Ideas.
 * No Vue, no Pinia, no side effects.
 */
import type { Commitment, Habit, Idea, Link, Node, Occurrence, Period, Thing } from '../domain';
import { nodeState } from './derive';
import { localParts } from '../domain';

// ── Cycle detection ──────────────────────────────────────────────

/**
 * True if setting `fromId` -> `toId` in the requires graph would create a cycle.
 * Self-dependency (fromId === toId) counts as a cycle.
 */
export function wouldCreateCycle(links: readonly Link[], fromId: string, toId: string): boolean {
  if (fromId === toId) return true;
  // Follow requires links transitively from toId; if we reach fromId, it's a cycle.
  const visited = new Set<string>();
  const queue = [toId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === fromId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const l of links) {
      if (l.type === 'requires' && l.fromId === current && !visited.has(l.toId)) {
        queue.push(l.toId);
      }
    }
  }
  return false;
}

// ── Date and time input ──────────────────────────────────────────

/** An instant as the text a datetime-local input wants: 'YYYY-MM-DDTHH:mm' in the user's own zone (the device's unless given). */
export function toDatetimeLocal(iso: string, timeZone?: string): string {
  const p = localParts(new Date(iso), timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${two(p.m)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}`;
}

// ── Dependency options ───────────────────────────────────────────

export interface DependencyOption { id: string; title: string; done: boolean }

/**
 * The Commitments this one could depend on: not itself and not one that would
 * make a loop. Open ones come first in their own order; finished ones come last
 * (they can still be picked, e.g. to keep a record of what came before).
 */
export function dependencyOptions(nodeId: string, nodes: readonly Node[], links: readonly Link[], occs: readonly Occurrence[]): DependencyOption[] {
  const all = nodes
    .filter((n): n is Commitment => n.kind === 'commitment' && n.id !== nodeId && !wouldCreateCycle(links, nodeId, n.id))
    .map((n) => ({ id: n.id, title: n.title, done: nodeState(n.id, occs).done }));
  return [...all.filter((o) => !o.done), ...all.filter((o) => o.done)];
}

// ── Place reuse ──────────────────────────────────────────────────

/**
 * Find a place Thing by name (case-insensitive), or create one if missing.
 * Returns the Thing id (existing or new).
 */
export function getOrCreatePlace(
  placeName: string,
  nodes: readonly Node[],
  onCreateNode: (node: Thing) => void,
  coords?: { lat: number; lon: number } | null,
): string {
  const trimmed = placeName.trim();
  if (!trimmed) throw new Error('Place name cannot be empty');

  // Look for existing place with matching name (case-insensitive)
  for (const n of nodes) {
    if (n.kind === 'thing' && n.thingType === 'place' && n.title.toLowerCase() === trimmed.toLowerCase()) {
      return n.id;
    }
  }

  // Create a new place Thing
  const newPlace: Thing = {
    id: globalThis.crypto.randomUUID(),
    kind: 'thing',
    thingType: 'place',
    title: trimmed,
    private: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lat: coords?.lat ?? null,
    lon: coords?.lon ?? null,
  };
  onCreateNode(newPlace);
  return newPlace.id;
}

// ── Edit and delete ──────────────────────────────────────────────

export interface EditInput {
  title?: string;
  fixedTime?: string | null;  // ISO datetime or null to clear
  deadline?: string | null;
  durationMinutes?: number | null;
  location?: string | null;  // place name or null to clear the 'at' link
  locationCoords?: { lat: number; lon: number } | null;  // where a newly named place is, when known (from a search or the device)
  dependencyId?: string | null;  // commitment id or null to clear
  recurrence?: { period: Period; target: number };  // a Habit: how often
  weekdays?: number[] | null;  // a Habit: pin to these weekdays (0 = Sunday), or null to clear
  link?: string | null;  // an https link to open for a Commitment or Habit, or null to clear
}

export interface EditResult {
  nodes: Node[];
  links: Link[];
}

/**
 * Apply edits to a Commitment or Idea, returning the modified nodes and links.
 * Handles location (at link) and dependency (requires link) creation/update/removal.
 * onCreateNode and onCreateLink are callbacks for creating new Nodes/Links when needed.
 */
export function applyEdit(
  nodeId: string,
  input: EditInput,
  nodes: readonly Node[],
  links: readonly Link[],
  onCreateNode: (node: Node) => void,
  onCreateLink: (link: Link) => void,
): EditResult {
  let node = nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found`);

  const now = new Date().toISOString();

  // Update the node
  const updatedNode = { ...node, updatedAt: now };
  if (input.title !== undefined) updatedNode.title = input.title;

  if (node.kind === 'commitment') {
    const c = updatedNode as Commitment;
    if (input.fixedTime !== undefined) c.fixedTime = input.fixedTime;
    if (input.deadline !== undefined) c.deadline = input.deadline;
    if (input.durationMinutes !== undefined) c.durationMinutes = input.durationMinutes;
  }

  if (input.link !== undefined && (node.kind === 'commitment' || node.kind === 'habit')) {
    (updatedNode as Commitment | Habit).link = input.link;
  }
  if (node.kind === 'habit') {
    const h = updatedNode as Habit;
    if (input.recurrence) h.recurrence = { period: input.recurrence.period, target: Math.max(1, Math.round(input.recurrence.target) || 1) };
    if (input.weekdays !== undefined) {
      const days = [...new Set(input.weekdays ?? [])].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
      const { weekdays: _drop, ...rest } = h.pin ?? {};
      h.pin = days.length > 0 || Object.keys(rest).length > 0 ? { ...rest, ...(days.length > 0 ? { weekdays: days } : {}) } : null;
    }
  }

  let newNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));
  let newLinks = [...links];

  // Handle location (at link)
  if (input.location !== undefined) {
    // Remove old 'at' link if present
    newLinks = newLinks.filter((l) => !(l.type === 'at' && l.fromId === nodeId));

    if (input.location) {
      // Create new place and link
      const placeId = getOrCreatePlace(input.location, newNodes, (place) => {
        newNodes = [...newNodes, place]; // the link must point at a node that exists in the result
        onCreateNode(place);
      }, input.locationCoords);
      const newLink: Link = {
        id: globalThis.crypto.randomUUID(),
        type: 'at',
        fromId: nodeId,
        toId: placeId,
        origin: 'stated',
        confidence: 1,
        evidence: [],
        createdAt: now,
        updatedAt: now,
      };
      onCreateLink(newLink);
      newLinks.push(newLink);
    }
  }

  // Handle dependency (requires link)
  if (input.dependencyId !== undefined) {
    // Remove old 'requires' link if present
    newLinks = newLinks.filter((l) => !(l.type === 'requires' && l.fromId === nodeId));

    if (input.dependencyId && input.dependencyId !== nodeId) {
      if (wouldCreateCycle(newLinks, nodeId, input.dependencyId)) {
        throw new Error('Cannot create a cycle');
      }
      const newLink: Link = {
        id: globalThis.crypto.randomUUID(),
        type: 'requires',
        fromId: nodeId,
        toId: input.dependencyId,
        origin: 'stated',
        confidence: 1,
        evidence: [],
        createdAt: now,
        updatedAt: now,
      };
      onCreateLink(newLink);
      newLinks.push(newLink);
    }
  }

  return { nodes: newNodes, links: newLinks };
}

/**
 * Delete a node and all links that touch it (fromId or toId).
 * Returns the modified nodes and links.
 */
export function deleteNode(
  nodeId: string,
  nodes: readonly Node[],
  links: readonly Link[],
): EditResult {
  const newNodes = nodes.filter((n) => n.id !== nodeId);
  const newLinks = links.filter((l) => l.fromId !== nodeId && l.toId !== nodeId);
  return { nodes: newNodes, links: newLinks };
}
