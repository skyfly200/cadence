/**
 * "Why now" on the device: the Now card always shows the template reason first; an
 * AI-polished line (POST /api/ai/why-now) is fetched in the background, cached by node
 * id plus template text, and picked up only when the card changes or the screen is
 * opened again, never while the user is looking at it. Framework-free so it can be
 * unit tested. Private items and AI-off never make a request.
 */
import { aiFetch } from '../ai-client';

const CACHE_KEY = 'cadence:whyNow';
const MAX_ENTRIES = 100;

export const whyNowKey = (nodeId: string, template: string): string => `${nodeId}|${template}`;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** line '' means "the AI had nothing better, keep the template" (so we do not ask again). */
export interface WhyNowCache {
  get(key: string): string | undefined;
  set(key: string, line: string): void;
}

export function createWhyNowCache(storage?: Store | null): WhyNowCache {
  const store = storage === undefined ? safeLocalStorage() : storage;
  let map = new Map<string, string>();
  try {
    const raw = JSON.parse(store?.getItem(CACHE_KEY) ?? '[]');
    if (Array.isArray(raw)) map = new Map(raw.filter((e): e is [string, string] => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string'));
  } catch { /* start empty */ }
  return {
    get: (key) => map.get(key),
    set(key, line) {
      map.delete(key);
      map.set(key, line);
      while (map.size > MAX_ENTRIES) map.delete(map.keys().next().value as string);
      try { store?.setItem(CACHE_KEY, JSON.stringify([...map])); } catch { /* storage blocked */ }
    },
  };
}

function safeLocalStorage(): Store | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

/** What to show: the cached polished line if there is one, otherwise the template. */
export function shownLine(cache: WhyNowCache, nodeId: string, template: string): string {
  return cache.get(whyNowKey(nodeId, template)) || template;
}

export interface WhyNowItem { nodeId: string; title: string; template: string; private: boolean }

/**
 * Ask for a polished line and remember the answer. Skips (no request) for a Private
 * item, an empty template, or a key already answered. Returns the line, or null.
 */
export async function fetchWhyNow(
  item: WhyNowItem,
  cache: WhyNowCache,
  opts: { accessToken: string | null | undefined; fetch?: typeof fetch; aiOn?: boolean },
): Promise<string | null> {
  if (item.private || !item.template) return null;
  const key = whyNowKey(item.nodeId, item.template);
  if (cache.get(key) !== undefined) return cache.get(key) || null;
  const r = await aiFetch<{ ok: true; line: string | null }>('/api/ai/why-now', { nodeId: item.nodeId, template: item.template }, opts);
  if (r.status !== 'ok') return null; // off, signed out or failed: keep the template, ask again another time
  cache.set(key, r.data.line ?? '');
  return r.data.line;
}
