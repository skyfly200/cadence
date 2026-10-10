/**
 * Working the Heap: search, sort, filter, tags and blocked items. Pure and framework-free.
 * "Blocked" means the item `requires` something that is not done yet.
 */
import { activeOccurrences } from '../domain';
import type { Link, Node, Occurrence } from '../domain';
import type { HeapItem } from './derive';

export type HeapSort = 'newest' | 'oldest' | 'az' | 'shortest' | 'longest' | 'tag' | 'blocked';
export type HeapStatus = 'all' | 'ready' | 'blocked' | 'backlog';

export interface HeapView { query: string; sort: HeapSort; tag: string; status: HeapStatus }
export const DEFAULT_HEAP_VIEW: HeapView = { query: '', sort: 'newest', tag: '', status: 'all' };

/**
 * The view that actually applies at a display density (0 Simple, 1 Balanced, 2 Rich). Controls the density
 * hides never filter: Simple is the plain list, Balanced adds search, Rich adds sort, filters and tags.
 */
export function heapViewFor(view: HeapView, density: 0 | 1 | 2): HeapView {
  if (density >= 2) return view;
  return { ...DEFAULT_HEAP_VIEW, query: density >= 1 ? view.query : '' };
}

export const HEAP_SORTS: { value: HeapSort; label: string }[] = [
  { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'az', label: 'A to Z' },
  { value: 'shortest', label: 'Shortest' }, { value: 'longest', label: 'Longest' }, { value: 'tag', label: 'Tag' }, { value: 'blocked', label: 'Blocked first' },
];

/** The open prerequisites of each node: `requires` targets that exist and are not done. */
export function openBlockers(nodes: readonly Node[], links: readonly Link[], occs: readonly Occurrence[]): Map<string, { id: string; title: string }[]> {
  const done = new Set(activeOccurrences(occs).filter((o) => o.type === 'done').map((o) => o.nodeId));
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const out = new Map<string, { id: string; title: string }[]>();
  for (const l of links) {
    if (l.type !== 'requires' || done.has(l.toId)) continue;
    const target = byId.get(l.toId);
    if (!target || !byId.has(l.fromId)) continue;
    out.set(l.fromId, [...(out.get(l.fromId) ?? []), { id: target.id, title: target.title }]);
  }
  return out;
}

/** The tags in use plus the user's own list, for the filter. */
export function tagOptions(items: readonly HeapItem[], own: readonly string[]): string[] {
  return [...new Set([...own, ...items.flatMap((i) => (i.category ? [i.category] : []))])];
}

/** Search, filter and sort the Heap. Backlogged items always stay below the rest, whatever the sort. */
export function viewHeap(items: readonly HeapItem[], view: HeapView): HeapItem[] {
  const q = view.query.trim().toLowerCase();
  const tag = view.tag.toLowerCase();
  const shown = items.filter((i) => {
    if (q && !`${i.title} ${i.category ?? ''}`.toLowerCase().includes(q)) return false;
    if (tag && (i.category ?? '').toLowerCase() !== tag) return false;
    if (view.status === 'blocked') return i.blockedBy.length > 0;
    if (view.status === 'ready') return i.blockedBy.length === 0 && !i.backlog;
    if (view.status === 'backlog') return i.backlog;
    return true;
  });
  const minutes = (i: HeapItem, none: number) => i.minutes ?? none;
  const cmp: Record<HeapSort, (a: HeapItem, b: HeapItem) => number> = {
    newest: (a, b) => b.at.localeCompare(a.at),
    oldest: (a, b) => a.at.localeCompare(b.at),
    az: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    shortest: (a, b) => minutes(a, Infinity) - minutes(b, Infinity) || 0,
    longest: (a, b) => minutes(b, -1) - minutes(a, -1) || 0,
    tag: (a, b) => (a.category ?? '￿').localeCompare(b.category ?? '￿'),
    blocked: (a, b) => b.blockedBy.length - a.blockedBy.length,
  };
  const order = (a: HeapItem, b: HeapItem) => Number(a.backlog) - Number(b.backlog) || cmp[view.sort](a, b) || b.at.localeCompare(a.at);
  return [...shown].sort(order);
}

/** The first tag whose name appears as a whole word in the text (case-insensitive), or null. */
export function matchTag(text: string, tags: readonly string[]): string | null {
  const words = new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const hit = tags.find((t) => { const w = t.trim().toLowerCase().split(/\s+/); return w.length > 0 && w.every((x) => words.has(x)); });
  return hit ?? null;
}

/** Add a tag to the user's list: one trimmed line of at most 24 characters, no duplicates (case-insensitive). */
export function addTag(tags: readonly string[], name: string): string[] {
  const t = name.replace(/\s+/g, ' ').trim().slice(0, 24);
  return !t || tags.some((x) => x.toLowerCase() === t.toLowerCase()) ? [...tags] : [...tags, t];
}
