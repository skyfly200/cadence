/**
 * Memories sync through the existing cadence_kv table as one row (key `memories`) holding the whole
 * list, tombstones included. Both directions merge by id (lib/home/memory.ts mergeMemories), and a
 * push reads the server's copy first, so two devices adding memories at once both keep theirs.
 * The row is the person's own under row-level security; no server route reads it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MEMORY_KV_KEY, getMemories, isMemory, mergeMemories, saveMemories, type Memory } from './memory';

/** The valid memories in a kv row's data (anything malformed is ignored). */
export function memoriesFromData(data: unknown): Memory[] {
  return Array.isArray(data) ? data.filter(isMemory) : [];
}

/** Take the memories from rows already pulled from cadence_kv. */
export function applyServerMemories(rows: readonly { key: string; data: unknown }[]): void {
  const row = rows.find((r) => r.key === MEMORY_KV_KEY);
  if (!row) return;
  saveMemories(mergeMemories(getMemories(), memoriesFromData(row.data)));
}

/** Merge with the server's copy, then write the merged list both here and there. */
export async function pushMemories(sb: SupabaseClient, userId: string): Promise<void> {
  const local = getMemories();
  const { data, error } = await sb.from('cadence_kv').select('data').eq('user_id', userId).eq('key', MEMORY_KV_KEY).maybeSingle();
  if (error) throw error;
  const server = memoriesFromData((data as { data?: unknown } | null)?.data);
  if (!local.length && !server.length) return;
  const merged = mergeMemories(local, server);
  saveMemories(merged);
  const { error: e2 } = await sb.from('cadence_kv').upsert({ user_id: userId, key: MEMORY_KV_KEY, data: merged }, { onConflict: 'user_id,key' });
  if (e2) throw e2;
}
