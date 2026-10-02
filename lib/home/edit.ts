/**
 * Pure functions for editing and deleting Commitments and Ideas.
 * No Vue, no Pinia, no side effects.
 */
import type { Commitment, Habit, Idea, Link, Node, Thing } from '../domain';

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

// ── Place reuse ──────────────────────────────────────────────────

/**
 * Find a place Thing by name (case-insensitive), or create one if missing.
 * Returns the Thing id (existing or new).
 */
export function getOrCreatePlace(
  placeName: string,
  nodes: readonly Node[],
  onCreateNode: (node: Thing) => void,
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
    lat: null,
    lon: null,
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
  dependencyId?: string | null;  // commitment id or null to clear
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

  const newNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));
  let newLinks = [...links];

  // Handle location (at link)
  if (input.location !== undefined) {
    // Remove old 'at' link if present
    newLinks = newLinks.filter((l) => !(l.type === 'at' && l.fromId === nodeId));

    if (input.location) {
      // Create new place and link
      const placeId = getOrCreatePlace(input.location, newNodes, onCreateNode);
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
