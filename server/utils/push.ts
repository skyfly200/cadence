/**
 * Web push subscription management: subscribe and unsubscribe.
 * Framework-free (no Nitro globals) so it can be unit tested.
 *
 * Rules:
 *  * A subscription is identified by (user_id, endpoint). The endpoint is a
 *    capability URL issued by the push service, so it must be https:// and is
 *    not under the app's control.
 *  * Clients can only subscribe/unsubscribe their own rows.
 *  * A subscription is never revealed to a client (the server keeps it).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

// ── limits ─────────────────────────────────────────────────────

/** Maximum endpoint URL length (most are ~500 bytes; 2KB is conservative). */
export const MAX_ENDPOINT_LENGTH = 2048;
/** Minimum endpoint length to reject obviously malformed subscriptions. */
export const MIN_ENDPOINT_LENGTH = 20;

// ── store ──────────────────────────────────────────────────────

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SubscribeStore {
  subscribe(userId: string, subscription: PushSubscription): Promise<void>;
  unsubscribe(userId: string, endpoint: string): Promise<void>;
}

// ── handler ────────────────────────────────────────────────────

export type PushError = 'bad_request' | 'unavailable';

export type SubscribeResult = { status: 200; body: { ok: true } } | { status: 400 | 503; body: { ok: false; error: PushError; message: string } };

const fail = (status: 400 | 503, error: PushError, message: string): SubscribeResult => ({
  status,
  body: { ok: false, error, message },
});

/** Validate a subscription object from PushSubscription.toJSON(). */
export function validateSubscription(body: unknown): PushSubscription | null {
  if (!body || typeof body !== 'object') return null;
  const sub = body as { endpoint?: unknown; keys?: unknown };
  if (typeof sub.endpoint !== 'string') return null;
  if (!sub.keys || typeof sub.keys !== 'object') return null;
  const keys = sub.keys as { p256dh?: unknown; auth?: unknown };
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  return { endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

export interface PushDeps {
  store: SubscribeStore;
}

/** Handle a subscribe request for an already-authenticated user. */
export async function handleSubscribe(deps: PushDeps, input: { userId: string; body: unknown }): Promise<SubscribeResult> {
  const sub = validateSubscription(input.body);
  if (!sub) {
    return fail(400, 'bad_request', 'Send a valid subscription object.');
  }
  if (!sub.endpoint.startsWith('https://')) {
    return fail(400, 'bad_request', 'Subscription endpoint must be https://.');
  }
  if (sub.endpoint.length < MIN_ENDPOINT_LENGTH || sub.endpoint.length > MAX_ENDPOINT_LENGTH) {
    return fail(400, 'bad_request', 'Subscription endpoint length is out of bounds.');
  }
  if (!sub.p256dh || !sub.auth) {
    return fail(400, 'bad_request', 'Subscription keys are incomplete.');
  }
  try {
    await deps.store.subscribe(input.userId, sub);
    return { status: 200, body: { ok: true } };
  } catch (e) {
    console.error('push subscribe failed:', e instanceof Error ? e.name : 'unknown');
    return fail(503, 'unavailable', 'Could not save that subscription just now.');
  }
}

/** Handle an unsubscribe request for an already-authenticated user. */
export async function handleUnsubscribe(deps: PushDeps, input: { userId: string; body: unknown }): Promise<SubscribeResult> {
  const body = input.body as { endpoint?: unknown } | null | undefined;
  if (!body || typeof body.endpoint !== 'string' || !body.endpoint) {
    return fail(400, 'bad_request', 'Send an endpoint to unsubscribe.');
  }
  try {
    await deps.store.unsubscribe(input.userId, body.endpoint);
    return { status: 200, body: { ok: true } };
  } catch (e) {
    console.error('push unsubscribe failed:', e instanceof Error ? e.name : 'unknown');
    return fail(503, 'unavailable', 'Could not remove that subscription just now.');
  }
}

// ── stores ─────────────────────────────────────────────────────

/** In-memory store for tests. */
export function createMemoryPushStore() {
  const subscriptions: { userId: string; endpoint: string; p256dh: string; auth: string }[] = [];
  const store: SubscribeStore = {
    async subscribe(userId, sub) {
      const idx = subscriptions.findIndex((s) => s.userId === userId && s.endpoint === sub.endpoint);
      if (idx >= 0) {
        subscriptions[idx] = { userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth };
      } else {
        subscriptions.push({ userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth });
      }
    },
    async unsubscribe(userId, endpoint) {
      const idx = subscriptions.findIndex((s) => s.userId === userId && s.endpoint === endpoint);
      if (idx >= 0) subscriptions.splice(idx, 1);
    },
  };
  return { subscriptions, store };
}

/** The slice of the Supabase client the store uses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = SupabaseClient<any, 'public', any>;

/** Supabase-backed store using the service role. */
export function createSupabasePushStore(sb: SupabaseLike): SubscribeStore {
  return {
    async subscribe(userId, sub) {
      const { error } = await sb.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      });
      if (error) throw new Error(`push subscribe failed: ${error.code ?? 'error'}`);
    },
    async unsubscribe(userId, endpoint) {
      const { error } = await sb.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
      if (error) throw new Error(`push unsubscribe failed: ${error.code ?? 'error'}`);
    },
  };
}

export function createServiceClient(url: string, serviceRoleKey: string): SupabaseLike {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
