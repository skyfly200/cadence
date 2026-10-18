/**
 * Server-side, encrypted storage for outside services' access tokens (GitHub now; Vercel and
 * Netlify next). The same AES-256-GCM scheme as the Google tokens (google-tokens.ts), with
 * "<user id>:<service>" bound in as additional authenticated data, so a blob moved to another
 * user or another service fails to decrypt. Tokens never go back to the browser.
 *
 * Framework-free on purpose (no Nitro globals) so it can be unit tested.
 */
import { createClient } from '@supabase/supabase-js';
import { decryptJson, encryptJson } from './google-tokens';

export type Service = 'github' | 'vercel' | 'netlify';

export interface ServiceToken {
  token: string;
  /** The account the token belongs to (a login or name). Not secret. */
  label: string;
}

export interface ServiceTokenRow { blob: string; label: string | null }

export interface ServiceTokenStore {
  get(userId: string, service: Service): Promise<ServiceTokenRow | null>;
  put(userId: string, service: Service, row: ServiceTokenRow): Promise<void>;
  delete(userId: string, service: Service): Promise<void>;
}

export interface ServiceVault {
  save(userId: string, service: Service, value: ServiceToken): Promise<void>;
  load(userId: string, service: Service): Promise<ServiceToken | null>;
  status(userId: string, service: Service): Promise<{ connected: boolean; label: string | null }>;
  remove(userId: string, service: Service): Promise<void>;
}

const aad = (userId: string, service: Service) => `${userId}:${service}`;

export function createServiceVault(store: ServiceTokenStore, key: Buffer): ServiceVault {
  return {
    async save(userId, service, value) {
      await store.put(userId, service, { blob: encryptJson(key, aad(userId, service), value), label: value.label || null });
    },
    async load(userId, service) {
      const row = await store.get(userId, service);
      return row ? decryptJson<ServiceToken>(key, aad(userId, service), row.blob) : null;
    },
    async status(userId, service) {
      const row = await store.get(userId, service);
      return { connected: !!row, label: row?.label ?? null };
    },
    async remove(userId, service) {
      await store.delete(userId, service);
    },
  };
}

export function createMemoryServiceTokenStore(): ServiceTokenStore & { rows: Map<string, ServiceTokenRow> } {
  const rows = new Map<string, ServiceTokenRow>();
  const k = (u: string, s: Service) => `${u}:${s}`;
  return {
    rows,
    async get(u, s) { return rows.get(k(u, s)) ?? null; },
    async put(u, s, row) { rows.set(k(u, s), { ...row }); },
    async delete(u, s) { rows.delete(k(u, s)); },
  };
}

/** Supabase-backed store using the service role (bypasses RLS; clients have no access). */
export function createSupabaseServiceTokenStore(url: string, serviceRoleKey: string): ServiceTokenStore {
  const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const table = 'cadence_service_tokens';
  return {
    async get(userId, service) {
      const { data, error } = await sb.from(table).select('blob,label').eq('user_id', userId).eq('service', service).maybeSingle();
      if (error) throw new Error(`service token read failed: ${error.message}`);
      return data ? { blob: data.blob as string, label: (data.label as string | null) ?? null } : null;
    },
    async put(userId, service, row) {
      const { error } = await sb.from(table).upsert(
        { user_id: userId, service, blob: row.blob, label: row.label, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,service' },
      );
      if (error) throw new Error(`service token write failed: ${error.message}`);
    },
    async delete(userId, service) {
      const { error } = await sb.from(table).delete().eq('user_id', userId).eq('service', service);
      if (error) throw new Error(`service token delete failed: ${error.message}`);
    },
  };
}
