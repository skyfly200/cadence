/**
 * Pressed-book pages sync through the existing cadence_kv table, one row per season
 * (key `pressed:<season key>`, e.g. `pressed:quarter:2026-07-01`). A page is written once and
 * never changed, so the first page to reach the server wins: pushes use ON CONFLICT DO NOTHING,
 * and a pull replaces a local page of the same season with the server's. Pages that only exist on
 * this device are pushed up the next time it syncs, which is also how existing local books migrate.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PressedSeason } from '../domain/garden';
import { getPressedPages, isPage, replacePressedPages } from './garden-state';

export const PRESSED_PREFIX = 'pressed:';

export const pressedKey = (page: Pick<PressedSeason, 'key'>): string => `${PRESSED_PREFIX}${page.key}`;

/** The cadence_kv rows for these pages. */
export function pressedRows(userId: string, pages: readonly PressedSeason[]): { user_id: string; key: string; data: PressedSeason }[] {
  return pages.map((p) => ({ user_id: userId, key: pressedKey(p), data: p }));
}

/** The valid pages among kv rows (other keys and malformed data are ignored). */
export function pagesFromKv(rows: readonly { key: string; data: unknown }[]): PressedSeason[] {
  return rows.filter((r) => typeof r.key === 'string' && r.key.startsWith(PRESSED_PREFIX) && isPage(r.data)).map((r) => r.data as PressedSeason);
}

/** Local pages with the server's on top: a server page replaces the local page of the same season; new ones are added. */
export function mergeServerPages(local: readonly PressedSeason[], server: readonly PressedSeason[]): PressedSeason[] {
  const byKey = new Map(local.map((p) => [p.key, p] as const));
  for (const p of server) byKey.set(p.key, p);
  return [...byKey.values()];
}

/** Take pressed pages from rows already pulled from cadence_kv. */
export function applyServerPages(rows: readonly { key: string; data: unknown }[]): void {
  const server = pagesFromKv(rows);
  if (!server.length) return;
  replacePressedPages(mergeServerPages(getPressedPages(), server));
}

/** Push this device's pages; a season already on the server is left as it is. */
export async function pushPressed(sb: SupabaseClient, userId: string): Promise<void> {
  const rows = pressedRows(userId, getPressedPages());
  if (!rows.length) return;
  const { error } = await sb.from('cadence_kv').upsert(rows, { onConflict: 'user_id,key', ignoreDuplicates: true });
  if (error) throw error;
}
