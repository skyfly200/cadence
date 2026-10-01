/**
 * Web push dispatch: claim nudges from the queue and send them.
 * Framework-free so it can be unit tested.
 *
 * Rules:
 *  * The cron job calls this with a secret header; the secret must match.
 *  * Atomically claim a batch of rows with sent_at is null and fire_at <= now.
 *  * Rows past drop_after are not sent, but are still marked sent.
 *  * Send in parallel to each subscription, with a per-send timeout.
 *  * Delete subscriptions that answer 404/410; don't retry or escalate any error.
 *  * Idempotent: once sent_at is set, a rerun sees nothing to send.
 *  * Must complete well within 2 seconds (the scheduler's timeout).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { createHash } from 'crypto';

// ── store ──────────────────────────────────────────────────────

export interface QueuedNudge {
  userId: string;
  id: string;
  kind: string;
  title: string;
  body: string;
  tag: string;
  fireAt: string;
  dropAfter: string;
}

export interface PushSubscriptionRow {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface DispatchStore {
  /** Claim a batch of due nudges and mark them sent. */
  claimDue(batchSize: number): Promise<QueuedNudge[]>;
  /** Fetch subscriptions for a user. */
  getSubscriptions(userId: string): Promise<PushSubscriptionRow[]>;
  /** Delete a subscription by endpoint. */
  deleteSubscription(userId: string, endpoint: string): Promise<void>;
}

// ── handler ────────────────────────────────────────────────────

export type DispatchError = 'unauthorized' | 'unavailable';

export type DispatchResult = { status: 202; body: { ok: true; sent: number } } | { status: 401 | 503; body: { ok: false; error: DispatchError; message: string } };

const fail = (status: 401 | 503, error: DispatchError, message: string): DispatchResult => ({
  status,
  body: { ok: false, error, message },
});

/** Constant-time secret comparison. */
function secretEquals(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  try {
    const pBuf = Buffer.from(provided, 'utf8');
    const eBuf = Buffer.from(expected, 'utf8');
    // Hash both to avoid timing leaks on length mismatches.
    const pHash = createHash('sha256').update(pBuf).digest();
    const eHash = createHash('sha256').update(eBuf).digest();
    return timingSafeEqual(pHash, eHash);
  } catch {
    return false;
  }
}

export interface DispatchDeps {
  store: DispatchStore;
  /** Sends one web push; rejects with a `statusCode` on a push-service error. The route injects web-push. */
  send: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, ttlSeconds: number) => Promise<unknown>;
  nudgeCronSecret: string;
  sendTimeout?: number;
  now?: () => Date;
}

/** Compute the TTL in seconds for a nudge that expires at dropAfter. */
function computeTtl(dropAfter: string, now: Date): number {
  const dropMs = new Date(dropAfter).getTime();
  const nowMs = now.getTime();
  return Math.max(0, Math.floor((dropMs - nowMs) / 1000));
}

/** Handle the dispatch request from the cron job. */
export async function handleDispatch(deps: DispatchDeps, input: { secret: string | null }): Promise<DispatchResult> {
  if (!deps.nudgeCronSecret) {
    return fail(503, 'unavailable', 'Nudge delivery is not configured.');
  }
  if (!secretEquals(input.secret, deps.nudgeCronSecret)) {
    return fail(401, 'unauthorized', 'Invalid secret.');
  }
  const timeout = deps.sendTimeout ?? 1000;
  const now = (deps.now ?? (() => new Date))();
  let sent = 0;

  try {
    const nudges = await deps.store.claimDue(50);
    for (const nudge of nudges) {
      const ttl = computeTtl(nudge.dropAfter, now);
      if (ttl <= 0) {
        // Row is past drop_after; skip sending but it's already marked sent.
        continue;
      }
      const subscriptions = await deps.store.getSubscriptions(nudge.userId);
      if (subscriptions.length === 0) continue;

      const payload = JSON.stringify({
        title: nudge.title,
        body: nudge.body,
        tag: nudge.tag,
        data: { id: nudge.id },
      });

      // Send in parallel with a timeout per subscription.
      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const racePromise = Promise.race([
            deps.send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, ttl),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
          ]);

          try {
            await racePromise;
            return { ok: true as const };
          } catch (e) {
            const err = e as { statusCode?: number; message?: string; name?: string };
            if (err.statusCode === 404 || err.statusCode === 410) {
              await deps.store.deleteSubscription(nudge.userId, sub.endpoint);
            }
            return { ok: false as const };
          }
        }),
      );

      // Count successful sends (note: timeout and 5xx are counted as failures, not retried).
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
      if (successful > 0) sent += 1;
    }
    return { status: 202, body: { ok: true, sent } };
  } catch (e) {
    console.error('nudge dispatch failed:', e instanceof Error ? e.name : 'unknown');
    return fail(503, 'unavailable', 'Dispatch encountered an error.');
  }
}

// ── stores ─────────────────────────────────────────────────────

/** In-memory store for tests. */
export function createMemoryDispatchStore() {
  const nudges: QueuedNudge[] = [];
  const claimedIds = new Set<string>();
  const subscriptions: PushSubscriptionRow[] = [];

  const store: DispatchStore & { nudges: typeof nudges; subscriptions: typeof subscriptions; failNext?: boolean } = {
    nudges,
    subscriptions,
    async claimDue(batchSize) {
      if (store.failNext) throw new Error('boom: store error');
      const claimed = this.nudges.filter((n) => !claimedIds.has(`${n.userId}|${n.id}`)).slice(0, batchSize);
      for (const n of claimed) claimedIds.add(`${n.userId}|${n.id}`);
      return claimed;
    },
    async getSubscriptions(userId) {
      return this.subscriptions.filter((s) => s.userId === userId);
    },
    async deleteSubscription(userId, endpoint) {
      const idx = this.subscriptions.findIndex((s) => s.userId === userId && s.endpoint === endpoint);
      if (idx >= 0) this.subscriptions.splice(idx, 1);
    },
  };
  return store;
}

/** The slice of the Supabase client the store uses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = SupabaseClient<any, 'public', any>;

/** Supabase-backed store using the service role. */
export function createSupabaseDispatchStore(sb: SupabaseLike): DispatchStore {
  return {
    async claimDue(batchSize) {
      const { data, error } = await sb.rpc('claim_due_nudges', { batch: batchSize });
      if (error) throw new Error(`claim failed: ${error.code ?? 'error'}`);
      // Map the returned rows to our interface (camelCase).
      return (data as Array<{ user_id: string; id: string; kind: string; title: string; body: string; tag: string; fire_at: string; drop_after: string }>)
        .map((row) => ({
          userId: row.user_id,
          id: row.id,
          kind: row.kind,
          title: row.title,
          body: row.body,
          tag: row.tag,
          fireAt: row.fire_at,
          dropAfter: row.drop_after,
        }));
    },
    async getSubscriptions(userId) {
      const { data, error } = await sb.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', userId);
      if (error) throw new Error(`subscriptions failed: ${error.code ?? 'error'}`);
      return (data as Array<{ endpoint: string; p256dh: string; auth: string }>).map((row) => ({
        userId,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      }));
    },
    async deleteSubscription(userId, endpoint) {
      const { error } = await sb.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
      if (error) throw new Error(`delete subscription failed: ${error.code ?? 'error'}`);
    },
  };
}

export function createServiceClient(url: string, serviceRoleKey: string): SupabaseLike {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
