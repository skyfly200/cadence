/**
 * Memory: short things Cadence remembers about the person ("Prefers mornings for deep work",
 * "Sam is my sister"), kept on this device and synced to the person's own account row.
 * Framework-free. The AI never reads the whole list: the browser picks the few that matter for a
 * turn (rankMemories) and sends only those. A forgotten memory stays as a tombstone (text emptied)
 * so the forget reaches the other devices instead of being merged back.
 */

/** stated: the person asked Cadence to remember it. proposed_accepted: Cadence offered it and the person kept it. */
export type MemoryOrigin = 'stated' | 'proposed_accepted';

export interface Memory {
  id: string;
  text: string;
  origin: MemoryOrigin;
  /** Never sent to the AI; it still shows in the list. */
  private: boolean;
  createdAt: string;
  updatedAt: string;
  /** Last time it was sent with a conversation turn (for ranking). */
  lastUsedAt?: string | null;
  /** Forgotten: the text is gone and it is never shown or sent. */
  deleted?: boolean;
}

export const MEMORY_KEY = 'cadence:memories';
/** The cadence_kv row the list syncs through. */
export const MEMORY_KV_KEY = 'memories';
export const MAX_MEMORY_TEXT = 300;

export function getMemories(): Memory[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(MEMORY_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter(isMemory) : [];
  } catch { return []; }
}

export function saveMemories(list: readonly Memory[]): void {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(MEMORY_KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
}

export function isMemory(v: unknown): v is Memory {
  const m = v as Memory | null;
  return !!m && typeof m.id === 'string' && typeof m.text === 'string' && typeof m.updatedAt === 'string';
}

/** The memories that still count (not forgotten). */
export const liveMemories = (list: readonly Memory[]): Memory[] => list.filter((m) => !m.deleted);

const clean = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY_TEXT);
const same = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

/** Add one memory, unless the same words are already remembered. Returns the new list and the memory (new or existing). */
export function addMemory(list: readonly Memory[], text: string, origin: MemoryOrigin, now: Date, id: string): { list: Memory[]; memory: Memory | null } {
  const t = clean(text);
  if (!t) return { list: [...list], memory: null };
  const existing = liveMemories(list).find((m) => same(m.text, t));
  if (existing) return { list: [...list], memory: existing };
  const at = now.toISOString();
  const memory: Memory = { id, text: t, origin, private: false, createdAt: at, updatedAt: at, lastUsedAt: null };
  return { list: [...list, memory], memory };
}

/** Change a memory's words or its Private flag. */
export function editMemory(list: readonly Memory[], id: string, change: { text?: string; private?: boolean }, now: Date): Memory[] {
  return list.map((m) => {
    if (m.id !== id || m.deleted) return m;
    const text = change.text === undefined ? m.text : clean(change.text);
    if (!text) return m;
    return { ...m, text, private: change.private ?? m.private, updatedAt: now.toISOString() };
  });
}

/** Forget one memory: the words are dropped at once, the tombstone carries the forget to other devices. */
export function forgetMemory(list: readonly Memory[], id: string, now: Date): Memory[] {
  return list.map((m) => (m.id === id ? { ...m, text: '', deleted: true, updatedAt: now.toISOString() } : m));
}

/** Mark the memories sent with a turn as used. Not a content change, so updatedAt (the sync clock) is left alone. */
export function markUsed(list: readonly Memory[], ids: readonly string[], now: Date): Memory[] {
  const set = new Set(ids);
  return list.map((m) => (set.has(m.id) ? { ...m, lastUsedAt: now.toISOString() } : m));
}

/** Merge two copies of the list by id: the newer updatedAt wins, ties keep `b` (the server's). */
export function mergeMemories(a: readonly Memory[], b: readonly Memory[]): Memory[] {
  const byId = new Map(a.map((m) => [m.id, m] as const));
  for (const m of b) {
    const mine = byId.get(m.id);
    if (!mine || m.updatedAt >= mine.updatedAt) byId.set(m.id, m);
  }
  return [...byId.values()].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
}

// ── relevance ────────────────────────────────────────────────

const STOP = new Set(('a an and are as at be but by do for from has have i if in into is it its me my of on or our so that the their them then there they this to was we what when where which who will with you your about just like can could would should im dont get got go going').split(' '));

/** Lower-case content words, without common filler and with a trailing plural s dropped. */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [])
    .map((w) => w.replace(/'s$|'/g, ''))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** How many of the query's words a text shares. */
export function overlap(query: readonly string[] | Set<string>, text: string): number {
  const q = query instanceof Set ? query : new Set(query);
  let n = 0;
  for (const w of new Set(words(text))) if (q.has(w)) n++;
  return n;
}

/**
 * The memories most worth sending with a turn: shared words with what is being talked about count
 * most; with no match, the most recently used or added fill the rest. Private and forgotten ones are
 * never returned.
 */
export function rankMemories(list: readonly Memory[], query: string, limit: number): Memory[] {
  const q = new Set(words(query));
  const recent = (m: Memory) => m.lastUsedAt ?? m.createdAt;
  return liveMemories(list)
    .filter((m) => !m.private)
    .map((m) => ({ m, score: overlap(q, m.text) }))
    .sort((a, b) => b.score - a.score || recent(b.m).localeCompare(recent(a.m)))
    .slice(0, limit)
    .map(({ m }) => m);
}

/** Memories that match a lookup; nothing when no words match. */
export function searchMemories(list: readonly Memory[], query: string, limit: number): Memory[] {
  const q = new Set(words(query));
  return liveMemories(list)
    .filter((m) => !m.private)
    .map((m) => ({ m, score: overlap(q, m.text) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ m }) => m);
}
