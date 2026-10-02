/**
 * The capture path: raw text in, an Idea out. Framework-free (no Nitro globals)
 * so it can be unit tested with an in-memory store.
 *
 * Rules (from the capture ticket): the raw text lands as an Idea plus a
 * 'captured' Occurrence tagged with its source; the reply is short, plain and
 * spoken-friendly; nothing is classified here (extraction happens later, and
 * never with AI on this path); captured text is data, never instructions; the
 * text itself is never logged.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Idea, OccurrenceSource } from '../../lib/domain/types';

// ── limits ─────────────────────────────────────────────────────

/** Longest capture we accept. A Capture is a thought, not a document. */
export const MAX_TEXT_LENGTH = 4000;
/** Identical text from the same source inside this window counts once. */
export const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
/**
 * Per-user rate limit: at most this many captures in a sliding window. It is
 * counted from the 'captured' Occurrences already in the database, so it holds
 * across serverless instances (an in-memory counter would reset per instance).
 */
export const RATE_LIMIT_COUNT = 20;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RETRY_AFTER_SECONDS = 30;

/** The reply in the coach voice: plain, one short line, no formatting. */
export const REPLY = 'Got it, parked.';

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

// ── store ──────────────────────────────────────────────────────

/** What a stored capture points back to (enough to answer a replay). */
export interface CaptureRecord {
  nodeId: string;
  createdAt: string;
}

/** Everything the store needs to write one capture (an Idea node and its 'captured' Occurrence). */
export interface NewCapture {
  userId: string;
  nodeId: string;
  occurrenceId: string;
  text: string;
  createdAt: string;
  source: OccurrenceSource;
  /** SHA-256 of the normalised text, for the duplicate window (never the text itself). */
  hash: string;
  idempotencyKey?: string;
  /** Saved as a Private Idea (never sent to the AI). The client sets it for crisis language. */
  private?: boolean;
}

export interface CaptureStore {
  findByIdempotencyKey(userId: string, key: string): Promise<CaptureRecord | null>;
  findRecentDuplicate(userId: string, source: OccurrenceSource, hash: string, sinceIso: string): Promise<CaptureRecord | null>;
  /** How many 'captured' Occurrences this user has at or after sinceIso. */
  countRecent(userId: string, sinceIso: string): Promise<number>;
  create(capture: NewCapture): Promise<void>;
}

/** The Idea's `data` JSON: the domain Idea plus the capture bookkeeping used for replays and duplicates. */
export type IdeaData = Idea & { captureSource: OccurrenceSource; captureHash: string; captureKey?: string };

export function buildIdeaData(c: NewCapture): IdeaData {
  const data: IdeaData = {
    id: c.nodeId,
    kind: 'idea',
    title: c.text,
    notes: null,
    private: c.private === true,
    createdAt: c.createdAt,
    updatedAt: c.createdAt,
    captureSource: c.source,
    captureHash: c.hash,
  };
  if (c.idempotencyKey) data.captureKey = c.idempotencyKey;
  return data;
}

// ── handler ────────────────────────────────────────────────────

export type CaptureError = 'bad_request' | 'empty' | 'too_long' | 'rate_limited' | 'unavailable';

export type CaptureResult =
  | { status: 200; body: { ok: true; reply: string; id: string; duplicate: boolean } }
  | { status: 400 | 429 | 503; body: { ok: false; error: CaptureError; message: string; retryAfterSeconds?: number } };

const fail = (status: 400 | 429 | 503, error: CaptureError, message: string, retryAfterSeconds?: number): CaptureResult => ({
  status,
  body: { ok: false, error, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) },
});

/** Normalise for the duplicate check only: trim, collapse whitespace, ignore case. */
export function hashText(text: string): string {
  return createHash('sha256').update(text.trim().replace(/\s+/g, ' ').toLowerCase(), 'utf8').digest('hex');
}

export interface CaptureDeps {
  store: CaptureStore;
  now?: () => number;
  newId?: () => string;
}

/**
 * Handle one capture for an already-authenticated user. The caller decides the
 * source (the browser route always says 'app'); the body is untrusted data.
 */
export async function handleCapture(
  deps: CaptureDeps,
  input: { userId: string; source: OccurrenceSource; body: unknown },
): Promise<CaptureResult> {
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? randomUUID;

  const body = input.body as { text?: unknown; idempotencyKey?: unknown; private?: unknown } | null | undefined;
  if (!body || typeof body !== 'object' || typeof body.text !== 'string') {
    return fail(400, 'bad_request', 'Send the thought as text.');
  }
  const key = body.idempotencyKey;
  if (key !== undefined && (typeof key !== 'string' || !KEY_PATTERN.test(key))) {
    return fail(400, 'bad_request', 'That request could not be read.');
  }
  if (body.private !== undefined && typeof body.private !== 'boolean') return fail(400, 'bad_request', 'That request could not be read.');
  const text = body.text.trim();
  if (!text) return fail(400, 'empty', 'There was nothing to save yet.');
  if (text.length > MAX_TEXT_LENGTH) return fail(400, 'too_long', 'That is a bit long to capture in one go. Try a shorter piece.');

  const ok = (r: CaptureRecord, duplicate: boolean): CaptureResult => ({ status: 200, body: { ok: true, reply: REPLY, id: r.nodeId, duplicate } });
  const hash = hashText(text);
  const t = now();

  try {
    // Replays and duplicates return the original reply and are never rate limited: they create nothing.
    if (key) {
      const seen = await deps.store.findByIdempotencyKey(input.userId, key);
      if (seen) return ok(seen, true);
    }
    const dup = await deps.store.findRecentDuplicate(input.userId, input.source, hash, new Date(t - DUPLICATE_WINDOW_MS).toISOString());
    if (dup) return ok(dup, true);

    const recent = await deps.store.countRecent(input.userId, new Date(t - RATE_LIMIT_WINDOW_MS).toISOString());
    if (recent >= RATE_LIMIT_COUNT) return fail(429, 'rate_limited', 'That is a lot at once. Give it a moment and try again.', RETRY_AFTER_SECONDS);

    const createdAt = new Date(t).toISOString();
    const capture: NewCapture = {
      userId: input.userId,
      nodeId: `idea_${newId()}`,
      occurrenceId: `occ_${newId()}`,
      text,
      createdAt,
      source: input.source,
      hash,
      ...(key ? { idempotencyKey: key } : {}),
      ...(body.private === true ? { private: true } : {}),
    };
    await deps.store.create(capture);
    return ok({ nodeId: capture.nodeId, createdAt }, false);
  } catch (e) {
    // Never log the text or the store's error message (it may echo row data): only the error's class.
    console.error('capture store failed:', e instanceof Error ? e.name : 'unknown');
    return fail(503, 'unavailable', 'Could not save that just now. Please try again in a moment.');
  }
}

// ── stores ─────────────────────────────────────────────────────

/** In-memory store for tests (and local experiments). */
export function createMemoryCaptureStore() {
  const nodes: { userId: string; id: string; updatedAt: string; data: IdeaData }[] = [];
  const occurrences: { userId: string; id: string; nodeId: string; type: 'captured'; at: string; source: OccurrenceSource }[] = [];
  const store: CaptureStore & { nodes: typeof nodes; occurrences: typeof occurrences; failNext?: boolean } = {
    nodes,
    occurrences,
    async findByIdempotencyKey(userId, key) {
      if (store.failNext) throw new Error('boom: secret row data');
      const n = nodes.find((x) => x.userId === userId && x.data.captureKey === key);
      return n ? { nodeId: n.id, createdAt: n.data.createdAt } : null;
    },
    async findRecentDuplicate(userId, source, hash, sinceIso) {
      const n = nodes.find((x) => x.userId === userId && x.data.captureSource === source && x.data.captureHash === hash && x.updatedAt >= sinceIso);
      return n ? { nodeId: n.id, createdAt: n.data.createdAt } : null;
    },
    async countRecent(userId, sinceIso) {
      return occurrences.filter((o) => o.userId === userId && o.type === 'captured' && o.at >= sinceIso).length;
    },
    async create(c) {
      if (store.failNext) throw new Error('boom: secret row data');
      nodes.push({ userId: c.userId, id: c.nodeId, updatedAt: c.createdAt, data: buildIdeaData(c) });
      occurrences.push({ userId: c.userId, id: c.occurrenceId, nodeId: c.nodeId, type: 'captured', at: c.createdAt, source: c.source });
    },
  };
  return store;
}

/** The slice of the Supabase client the store uses (so tests can fake it). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = SupabaseClient<any, 'public', any>;

/** Supabase-backed store using the service role (as google-tokens.ts does); rows are always scoped by user_id. */
export function createSupabaseCaptureStore(sb: SupabaseLike): CaptureStore {
  const nodeRow = (r: { id: string; data: unknown } | null): CaptureRecord | null =>
    r ? { nodeId: r.id, createdAt: String((r.data as IdeaData).createdAt) } : null;
  return {
    async findByIdempotencyKey(userId, key) {
      const { data, error } = await sb.from('cadence_nodes').select('id,data')
        .eq('user_id', userId).eq('kind', 'idea').eq('data->>captureKey', key).limit(1).maybeSingle();
      if (error) throw new Error(`capture read failed: ${error.code ?? 'error'}`);
      return nodeRow(data as { id: string; data: unknown } | null);
    },
    async findRecentDuplicate(userId, source, hash, sinceIso) {
      const { data, error } = await sb.from('cadence_nodes').select('id,data')
        .eq('user_id', userId).eq('kind', 'idea').eq('data->>captureHash', hash).eq('data->>captureSource', source)
        .gte('updated_at', sinceIso).limit(1).maybeSingle();
      if (error) throw new Error(`capture read failed: ${error.code ?? 'error'}`);
      return nodeRow(data as { id: string; data: unknown } | null);
    },
    async countRecent(userId, sinceIso) {
      const { count, error } = await sb.from('cadence_occurrences').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('type', 'captured').gte('at', sinceIso);
      if (error) throw new Error(`capture count failed: ${error.code ?? 'error'}`);
      return count ?? 0;
    },
    async create(c) {
      const { error: nodeErr } = await sb.from('cadence_nodes').insert({
        user_id: c.userId, id: c.nodeId, kind: 'idea', data: buildIdeaData(c), updated_at: c.createdAt,
      });
      if (nodeErr) throw new Error(`capture write failed: ${nodeErr.code ?? 'error'}`);
      const { error: occErr } = await sb.from('cadence_occurrences').insert({
        user_id: c.userId, id: c.occurrenceId, node_id: c.nodeId, type: 'captured', at: c.createdAt, source: c.source,
      });
      if (occErr) {
        // Best effort: do not leave an Idea without its 'captured' Occurrence.
        await sb.from('cadence_nodes').delete().eq('user_id', c.userId).eq('id', c.nodeId);
        throw new Error(`capture write failed: ${occErr.code ?? 'error'}`);
      }
    },
  };
}

export function createServiceClient(url: string, serviceRoleKey: string): SupabaseLike {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
