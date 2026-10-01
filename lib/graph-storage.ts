/**
 * Local storage for the Life graph: Nodes, Links and the Occurrence log.
 * Same style as lib/local-storage.ts (cadence: keys, safe JSON), typed with the
 * framework-free domain types. Because every key starts with `cadence:`, these
 * collections are included in exportAllData / importAllData automatically.
 */
import type { Link, Node, Occurrence } from './domain';

const STORAGE_PREFIX = 'cadence:';

export const GRAPH_KEYS = {
  nodes: `${STORAGE_PREFIX}graphNodes`,
  links: `${STORAGE_PREFIX}graphLinks`,
  occurrences: `${STORAGE_PREFIX}graphOccurrences`,
} as const;

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key}:`, e);
  }
}

// ── Nodes ────────────────────────────────────────────────────

export function getGraphNodes(): Node[] {
  return load<Node[]>(GRAPH_KEYS.nodes, []);
}

export function saveGraphNodes(nodes: Node[]): void {
  save(GRAPH_KEYS.nodes, nodes);
}

// ── Links ────────────────────────────────────────────────────

export function getGraphLinks(): Link[] {
  return load<Link[]>(GRAPH_KEYS.links, []);
}

export function saveGraphLinks(links: Link[]): void {
  save(GRAPH_KEYS.links, links);
}

// ── Occurrences (append-only) ────────────────────────────────

export function getGraphOccurrences(): Occurrence[] {
  return load<Occurrence[]>(GRAPH_KEYS.occurrences, []);
}

/** Replace the whole log. Used by sync and import; the app itself should only append. */
export function saveGraphOccurrences(rows: Occurrence[]): void {
  save(GRAPH_KEYS.occurrences, rows);
}

/**
 * Append Occurrences. The log is immutable: an id that already exists is left
 * untouched (never overwritten), so a retry or a double call cannot change history.
 */
export function appendGraphOccurrences(added: Occurrence[]): Occurrence[] {
  const existing = getGraphOccurrences();
  const seen = new Set(existing.map((o) => o.id));
  const fresh: Occurrence[] = [];
  for (const o of added) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    fresh.push(o);
  }
  if (fresh.length) save(GRAPH_KEYS.occurrences, [...existing, ...fresh]);
  return fresh;
}
