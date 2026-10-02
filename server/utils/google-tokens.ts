/**
 * Server-side, encrypted storage for Google Calendar tokens.
 *
 * Tokens never live in the browser: they are encrypted with AES-256-GCM using
 * a key from CADENCE_TOKEN_KEY (32 bytes, base64) and kept in a table that
 * clients cannot read (the server uses the Supabase service role).
 *
 * Framework-free on purpose (no Nitro globals) so it can be unit tested.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
  email: string;
  /** The scopes Google granted (space-separated). Absent on tokens saved before imports existed: calendar only. */
  scope?: string;
}

/** What the store holds: an opaque ciphertext plus the (non-secret) email. */
export interface TokenRow {
  blob: string;
  email: string | null;
}

export interface TokenStore {
  get(userId: string): Promise<TokenRow | null>;
  put(userId: string, row: TokenRow): Promise<void>;
  delete(userId: string): Promise<void>;
}

// ── key handling ───────────────────────────────────────────────

/** Parse CADENCE_TOKEN_KEY (base64 of exactly 32 bytes). Throws with a helpful message. */
export function parseKey(value: string | undefined | null): Buffer {
  if (!value) throw new Error('CADENCE_TOKEN_KEY is not set');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('CADENCE_TOKEN_KEY must be 32 bytes, base64-encoded');
  return key;
}

// ── AES-256-GCM ────────────────────────────────────────────────

const VERSION = 'v1';
const b64 = (b: Buffer) => b.toString('base64url');

/**
 * Encrypt a JSON value. The user id is bound in as additional authenticated
 * data so a ciphertext copied to another user's row fails to decrypt.
 */
export function encryptJson(key: Buffer, userId: string, value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(userId, 'utf8'));
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(ct)].join('.');
}

/** Decrypt; throws if the key, user id or any part of the blob is wrong or modified. */
export function decryptJson<T>(key: Buffer, userId: string, blob: string): T {
  const [version, iv, tag, ct] = blob.split('.');
  if (version !== VERSION || !iv || !tag || !ct) throw new Error('Unsupported token blob');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(userId, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}

// ── vault: encrypt/decrypt on top of any store ─────────────────

export interface TokenVault {
  save(userId: string, tokens: GoogleTokens): Promise<void>;
  load(userId: string): Promise<GoogleTokens | null>;
  status(userId: string): Promise<{ connected: boolean; email: string | null }>;
  /** The scopes this user's stored tokens were granted (decrypts); empty if not connected. Old tokens count as calendar only. */
  scopes(userId: string): Promise<string[]>;
  remove(userId: string): Promise<void>;
}

export function createTokenVault(store: TokenStore, key: Buffer): TokenVault {
  return {
    async save(userId, tokens) {
      await store.put(userId, { blob: encryptJson(key, userId, tokens), email: tokens.email || null });
    },
    async load(userId) {
      const row = await store.get(userId);
      return row ? decryptJson<GoogleTokens>(key, userId, row.blob) : null;
    },
    async status(userId) {
      const row = await store.get(userId);
      return { connected: !!row, email: row?.email ?? null };
    },
    async scopes(userId) {
      const row = await store.get(userId);
      if (!row) return [];
      const t = decryptJson<GoogleTokens>(key, userId, row.blob);
      return (t.scope ?? 'https://www.googleapis.com/auth/calendar.readonly').split(/\s+/).filter(Boolean);
    },
    async remove(userId) {
      await store.delete(userId);
    },
  };
}

// ── stores ─────────────────────────────────────────────────────

export function createMemoryTokenStore(): TokenStore & { rows: Map<string, TokenRow> } {
  const rows = new Map<string, TokenRow>();
  return {
    rows,
    async get(userId) { return rows.get(userId) ?? null; },
    async put(userId, row) { rows.set(userId, { ...row }); },
    async delete(userId) { rows.delete(userId); },
  };
}

/** Supabase-backed store using the service role (bypasses RLS; clients have no access). */
export function createSupabaseTokenStore(url: string, serviceRoleKey: string): TokenStore {
  const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const table = 'cadence_google_tokens';
  return {
    async get(userId) {
      const { data, error } = await sb.from(table).select('blob,email').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(`token store read failed: ${error.message}`);
      return data ? { blob: data.blob as string, email: (data.email as string | null) ?? null } : null;
    },
    async put(userId, row) {
      const { error } = await sb.from(table).upsert(
        { user_id: userId, blob: row.blob, email: row.email, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
      if (error) throw new Error(`token store write failed: ${error.message}`);
    },
    async delete(userId) {
      const { error } = await sb.from(table).delete().eq('user_id', userId);
      if (error) throw new Error(`token store delete failed: ${error.message}`);
    },
  };
}

// ── signed OAuth state (binds the redirect from Google to the user) ──

const STATE_TTL_MS = 10 * 60 * 1000;
const stateKey = (key: Buffer) => createHmac('sha256', key).update('cadence-gcal-state-v1').digest();

/**
 * The Google redirect is a plain browser navigation with no session, so the
 * user is carried in a short-lived, HMAC-signed `state` created by an
 * authenticated route. It also protects the callback against CSRF.
 */
export function signState(key: Buffer, userId: string, now = Date.now()): string {
  const payload = b64(Buffer.from(JSON.stringify({ u: userId, n: randomBytes(8).toString('hex'), e: now + STATE_TTL_MS })));
  const sig = b64(createHmac('sha256', stateKey(key)).update(payload).digest());
  return `${payload}.${sig}`;
}

/** Returns the user id, or null if the state is malformed, forged or expired. */
export function verifyState(key: Buffer, state: string | undefined | null, now = Date.now()): string | null {
  if (!state) return null;
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', stateKey(key)).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u?: string; e?: number };
    if (!u || typeof e !== 'number' || now > e) return null;
    return u;
  } catch {
    return null;
  }
}
