/**
 * Sync planned nudges to the nudge_queue table (Supabase).
 * Upserts only future nudges; idempotent by nudge id.
 * Skips sync if the id set hasn't changed since the last sync.
 */

import type { Nudge } from '~/lib/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

interface NudgeQueueRow {
  user_id?: string; // Set by RLS on insert; client rows don't include it
  id: string;
  kind: string;
  title: string;
  body: string;
  tag: string;
  fire_at: string;
  drop_after: string;
}

/**
 * Filter planned nudges to only future ones (fire_at >= now).
 */
function futureNudges(nudges: Nudge[], now: Date): Nudge[] {
  const nowMs = now.getTime();
  return nudges.filter((n) => new Date(n.fireAt).getTime() >= nowMs);
}

/**
 * Build nudge_queue rows from planned nudges (without user_id; RLS adds it).
 */
function buildRows(nudges: Nudge[]): NudgeQueueRow[] {
  return nudges.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    tag: n.tag,
    fire_at: n.fireAt,
    drop_after: n.dropAfter,
  }));
}

/**
 * Extract and deduplicate nudge ids.
 */
function nudgeIds(nudges: Nudge[]): Set<string> {
  return new Set(nudges.map((n) => n.id));
}

/**
 * Sync planned nudges to nudge_queue. Only syncs if the id set changed.
 * Returns true if sync occurred, false if skipped (no change or not signed in).
 */
export async function syncNudgesToQueue(
  nudges: Nudge[],
  supabase: any, // SupabaseClient
  now: Date = new Date(),
  lastSyncedIds: Set<string> = new Set()
): Promise<boolean> {
  if (!supabase) return false;

  // Get user from session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const future = futureNudges(nudges, now);
  const currentIds = nudgeIds(future);

  // Skip if id set hasn't changed
  if (
    currentIds.size === lastSyncedIds.size &&
    Array.from(currentIds).every((id) => lastSyncedIds.has(id))
  ) {
    return false;
  }

  // Upsert rows: ON CONFLICT DO NOTHING so existing rows (already sent) are not re-sent
  const rows = buildRows(future);
  if (rows.length === 0) return false;

  const { error } = await supabase
    .from('nudge_queue')
    .upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true });

  if (error) {
    console.warn('nudge_queue sync failed:', error.message);
    return false;
  }

  return true;
}
