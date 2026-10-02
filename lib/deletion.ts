/**
 * Client side of "Delete everything". The server keeps one row per user in
 * `deletion_requests` ({ requested_at, purged_at }, readable by its owner). Sync asks
 * `deletionSyncPlan` what to do before every pull and push, so a second device (or a
 * stale local cache) cannot put deleted data back:
 *
 *   pending (requested, not yet purged)  -> wipe the local cache, hold: no pull, no push
 *   purged and this device has not yet acknowledged that purge
 *                                        -> wipe the local cache once, acknowledge, carry on
 *   otherwise                            -> carry on
 *
 * The purge row stays (with purged_at) so a device that was offline for the whole
 * window still wipes its old cache the next time it syncs, instead of re-uploading it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DeletionRow { requested_at: string; purged_at: string | null }
export type DeletionPlan = { wipe: boolean; hold: boolean; acknowledge: string | null };

export function deletionSyncPlan(row: DeletionRow | null, acknowledgedPurge: string | null): DeletionPlan {
  if (!row) return { wipe: false, hold: false, acknowledge: null };
  if (!row.purged_at) return { wipe: true, hold: true, acknowledge: null };
  if (row.purged_at !== acknowledgedPurge) return { wipe: true, hold: false, acknowledge: row.purged_at };
  return { wipe: false, hold: false, acknowledge: null };
}

const ACK_KEY = 'cadence:purgeAck';
const KEEP_KEYS = new Set([ACK_KEY]);

/** Remove every cadence: key from this device (the data, not the sign-in session), then tell the app to reload. */
export function wipeLocalCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cadence:') && !KEEP_KEYS.has(key)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('cadence:hydrated'));
}

function readAck(): string | null { try { return localStorage.getItem(ACK_KEY); } catch { return null; } }
function writeAck(v: string): void { try { localStorage.setItem(ACK_KEY, v); } catch { /* storage blocked */ } }

/** True when sync must not pull or push now. Wipes the local cache when the plan says so. A failed check lets sync proceed as before. */
export async function deletionHold(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await sb.from('deletion_requests').select('requested_at,purged_at').eq('user_id', userId).maybeSingle();
  if (error) return false;
  const plan = deletionSyncPlan((data as DeletionRow | null) ?? null, readAck());
  if (plan.wipe) wipeLocalCache();
  if (plan.acknowledge) writeAck(plan.acknowledge);
  return plan.hold;
}
