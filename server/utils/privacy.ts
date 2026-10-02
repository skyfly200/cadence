/**
 * Account privacy controls: the server-side AI switch and "Delete everything" with a
 * 7-day undo window. Framework-free (no Nitro globals) so it can be unit tested with
 * an in-memory store.
 *
 * Delete everything removes the user's data from every user-owned table but keeps the
 * sign-in account (the auth user). A request is a row in `deletion_requests`; sync
 * sees it (lib/deletion.ts) and stops pushing. After the window the purge runs from
 * the every-minute dispatch route; the row stays, stamped `purged_at`, so a device
 * that was offline the whole time still wipes its old cache instead of re-uploading it.
 */
import { secretEquals } from './nudges';

export const DELETION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Every table holding a user's data, each keyed by user_id. The auth user itself is kept. */
export const USER_DATA_TABLES = [
  'cadence_tasks', 'cadence_projects', 'cadence_time_blocks', 'cadence_timer_sessions',
  'cadence_capacity', 'cadence_gamification', 'cadence_trips', 'cadence_habits', 'cadence_brain_dump', 'cadence_kv',
  'cadence_nodes', 'cadence_links', 'cadence_occurrences',
  'cadence_google_tokens', 'push_subscriptions', 'nudge_queue',
  'ai_usage', 'ai_settings',
  'oauth_grants', 'oauth_codes', 'oauth_tokens',
] as const;

export interface DeletionRecord { requestedAt: string; purgedAt: string | null }

export interface PrivacyStore {
  /** The user's server-side AI switch. On unless they turned it off. */
  getAiEnabled(userId: string): Promise<boolean>;
  setAiEnabled(userId: string, enabled: boolean, atIso: string): Promise<void>;
  getDeletion(userId: string): Promise<DeletionRecord | null>;
  /** Start a request (replacing a purged one). */
  requestDeletion(userId: string, atIso: string): Promise<void>;
  /** Withdraw a pending request. */
  cancelDeletion(userId: string): Promise<void>;
  /** Up to `limit` users with a pending request made at or before beforeIso, oldest first. */
  dueDeletions(beforeIso: string, limit: number): Promise<string[]>;
  /** Delete the user's rows from every table in USER_DATA_TABLES, then stamp the request purged. */
  purgeUser(userId: string, atIso: string): Promise<void>;
}

export interface PrivacyDeps { store: PrivacyStore; now?: () => number }

export interface DeletionState { pending: boolean; requestedAt: string | null; purgeAt: string | null }

const stateOf = (r: DeletionRecord | null): DeletionState =>
  r && !r.purgedAt
    ? { pending: true, requestedAt: r.requestedAt, purgeAt: new Date(Date.parse(r.requestedAt) + DELETION_WINDOW_MS).toISOString() }
    : { pending: false, requestedAt: null, purgeAt: null };

type Result<T> = { status: 200; body: T } | { status: 400 | 503; body: { ok: false; error: string; message: string } };
const bad = (status: 400 | 503, error: string, message: string) => ({ status, body: { ok: false as const, error, message } });

export async function handleSetAi(deps: PrivacyDeps, input: { userId: string; body: unknown }): Promise<Result<{ ok: true; enabled: boolean }>> {
  const enabled = (input.body as { enabled?: unknown } | null)?.enabled;
  if (typeof enabled !== 'boolean') return bad(400, 'bad_request', 'Say whether AI should be on or off.');
  try {
    await deps.store.setAiEnabled(input.userId, enabled, new Date((deps.now ?? Date.now)()).toISOString());
  } catch {
    return bad(503, 'unavailable', 'Could not save that just now. Please try again in a moment.');
  }
  return { status: 200, body: { ok: true, enabled } };
}

export async function handleGetAi(deps: PrivacyDeps, input: { userId: string }): Promise<Result<{ ok: true; enabled: boolean }>> {
  try {
    return { status: 200, body: { ok: true, enabled: await deps.store.getAiEnabled(input.userId) } };
  } catch {
    return bad(503, 'unavailable', 'Could not read that just now. Please try again in a moment.');
  }
}

export async function handleDeletion(deps: PrivacyDeps, input: { userId: string; body: unknown }): Promise<Result<{ ok: true } & DeletionState>> {
  const action = (input.body as { action?: unknown } | null)?.action;
  if (action !== 'request' && action !== 'cancel' && action !== 'status') return bad(400, 'bad_request', 'Unknown action.');
  try {
    if (action === 'request') {
      const existing = await deps.store.getDeletion(input.userId);
      // Asking twice must not push the deadline back.
      if (!existing || existing.purgedAt) await deps.store.requestDeletion(input.userId, new Date((deps.now ?? Date.now)()).toISOString());
    } else if (action === 'cancel') {
      const existing = await deps.store.getDeletion(input.userId);
      if (existing && !existing.purgedAt) await deps.store.cancelDeletion(input.userId);
    }
    return { status: 200, body: { ok: true, ...stateOf(await deps.store.getDeletion(input.userId)) } };
  } catch {
    return bad(503, 'unavailable', 'Could not do that just now. Please try again in a moment.');
  }
}

/** Most users purged per call, so one call stays short however many are due; the rest wait for the next minute. */
export const PURGE_BATCH = 3;

/** Purge users whose 7 days are up, at most PURGE_BATCH per call. One user failing does not stop the rest. */
export async function purgeDueDeletions(deps: PrivacyDeps, batch: number = PURGE_BATCH): Promise<{ purged: number }> {
  const now = (deps.now ?? Date.now)();
  const due = await deps.store.dueDeletions(new Date(now - DELETION_WINDOW_MS).toISOString(), batch);
  let purged = 0;
  for (const userId of due) {
    try { await deps.store.purgeUser(userId, new Date(now).toISOString()); purged++; } catch { /* retried next minute */ }
  }
  return { purged };
}

export type PurgeRunResult =
  | { status: 200; body: { ok: true; purged: number } }
  | { status: 401 | 503; body: { ok: false; error: 'unauthorized' | 'unavailable'; message: string } };

/** The cron-called purge: checks the shared cron secret, then purges one bounded batch. Needs no web push config. */
export async function handlePurgeRun(deps: PrivacyDeps & { cronSecret: string }, input: { secret: string | null }): Promise<PurgeRunResult> {
  if (!deps.cronSecret || !secretEquals(input.secret, deps.cronSecret)) return { status: 401, body: { ok: false, error: 'unauthorized', message: 'Invalid secret.' } };
  try {
    return { status: 200, body: { ok: true, ...(await purgeDueDeletions(deps)) } };
  } catch {
    return { status: 503, body: { ok: false, error: 'unavailable', message: 'Could not purge just now.' } };
  }
}

// ── stores ────────────────────────────────────────────────────

/** In-memory store for tests. `tables` maps a table name to the user ids that own a row in it. */
export function createMemoryPrivacyStore(seed: { tables?: Record<string, string[]> } = {}) {
  const tables: Record<string, string[]> = { ...Object.fromEntries(USER_DATA_TABLES.map((t) => [t, [] as string[]])), ...seed.tables };
  const deletions = new Map<string, DeletionRecord>();
  const aiEnabled = new Map<string, boolean>();
  const store: PrivacyStore & { tables: typeof tables; deletions: typeof deletions; aiEnabled: typeof aiEnabled } = {
    tables, deletions, aiEnabled,
    async getAiEnabled(userId) { return aiEnabled.get(userId) ?? true; },
    async setAiEnabled(userId, enabled) { aiEnabled.set(userId, enabled); },
    async getDeletion(userId) { return deletions.get(userId) ?? null; },
    async requestDeletion(userId, atIso) { deletions.set(userId, { requestedAt: atIso, purgedAt: null }); },
    async cancelDeletion(userId) { deletions.delete(userId); },
    async dueDeletions(beforeIso, limit) { return [...deletions].filter(([, r]) => !r.purgedAt && r.requestedAt <= beforeIso).sort((a, b) => (a[1].requestedAt < b[1].requestedAt ? -1 : 1)).slice(0, limit).map(([id]) => id); },
    async purgeUser(userId, atIso) {
      for (const t of USER_DATA_TABLES) tables[t] = (tables[t] ?? []).filter((id) => id !== userId);
      aiEnabled.delete(userId);
      const r = deletions.get(userId);
      if (r) deletions.set(userId, { ...r, purgedAt: atIso });
    },
  };
  return store;
}

/** The slice of the Supabase client the store uses, so it can be faked in tests. */
export interface PrivacySupabaseLike {
  from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Backed by `deletion_requests` and `ai_settings` (supabase/drafts/0005_privacy.sql), written with the service role. */
export function createSupabasePrivacyStore(db: PrivacySupabaseLike): PrivacyStore {
  return {
    async getAiEnabled(userId) {
      const { data, error } = await db.from('ai_settings').select('ai_enabled').eq('user_id', userId).maybeSingle();
      if (error) throw new Error('ai_settings read failed');
      return data ? data.ai_enabled !== false : true;
    },
    async setAiEnabled(userId, enabled, atIso) {
      const { error } = await db.from('ai_settings').upsert({ user_id: userId, ai_enabled: enabled, updated_at: atIso }, { onConflict: 'user_id' });
      if (error) throw new Error('ai_settings write failed');
    },
    async getDeletion(userId) {
      const { data, error } = await db.from('deletion_requests').select('requested_at,purged_at').eq('user_id', userId).maybeSingle();
      if (error) throw new Error('deletion_requests read failed');
      return data ? { requestedAt: data.requested_at, purgedAt: data.purged_at ?? null } : null;
    },
    async requestDeletion(userId, atIso) {
      const { error } = await db.from('deletion_requests').upsert({ user_id: userId, requested_at: atIso, purged_at: null }, { onConflict: 'user_id' });
      if (error) throw new Error('deletion_requests write failed');
    },
    async cancelDeletion(userId) {
      const { error } = await db.from('deletion_requests').delete().eq('user_id', userId).is('purged_at', null);
      if (error) throw new Error('deletion_requests delete failed');
    },
    async dueDeletions(beforeIso, limit) {
      const { data, error } = await db.from('deletion_requests').select('user_id').is('purged_at', null).lte('requested_at', beforeIso).order('requested_at', { ascending: true }).limit(limit);
      if (error) throw new Error('deletion_requests read failed');
      return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
    },
    async purgeUser(userId, atIso) {
      for (const t of USER_DATA_TABLES) {
        const { error } = await db.from(t).delete().eq('user_id', userId);
        if (error) throw new Error(`purge of ${t} failed`);
      }
      const { error } = await db.from('deletion_requests').update({ purged_at: atIso }).eq('user_id', userId);
      if (error) throw new Error('deletion_requests stamp failed');
    },
  };
}
