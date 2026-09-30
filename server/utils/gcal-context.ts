/**
 * Nitro glue for the Google Calendar routes: runtime config, the token vault,
 * the signed-in user, and the public origin. Kept thin; the logic that needs
 * testing lives in google-tokens.ts, google-oauth.ts and supabase-auth.ts.
 */
import type { H3Event } from 'h3';
import { createSupabaseTokenStore, createTokenVault, parseKey, type TokenVault } from './google-tokens';
import { verifyUser } from './supabase-auth';

export interface GcalContext {
  clientId: string;
  clientSecret: string;
  key: Buffer;
  vault: TokenVault;
}

/** Everything the server needs, or the list of what is missing (so a route can say so calmly). */
export function gcalContext(event: H3Event): { ok: true; ctx: GcalContext } | { ok: false; missing: string[] } {
  const cfg = useRuntimeConfig(event);
  const missing: string[] = [];
  // Env vars are also read at runtime: Nuxt bakes process.env into runtimeConfig at build time, so a variable
  // added in Vercel after the last build would otherwise be missed until a rebuild.
  const clientId = String(cfg.googleClientId || process.env.GOOGLE_CLIENT_ID || '');
  const clientSecret = String(cfg.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '');
  const serviceRoleKey = String(cfg.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabaseUrl = String(cfg.public.supabaseUrl || '');
  if (!clientId || !clientSecret) missing.push('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  let key: Buffer | null = null;
  try { key = parseKey(String(cfg.cadenceTokenKey || process.env.CADENCE_TOKEN_KEY || '')); } catch { missing.push('CADENCE_TOKEN_KEY'); }
  if (missing.length || !key) return { ok: false, missing };
  return { ok: true, ctx: { clientId, clientSecret, key, vault: createTokenVault(createSupabaseTokenStore(supabaseUrl, serviceRoleKey), key) } };
}

/** The signed-in user's id, verified with Supabase Auth; otherwise a 401. */
export async function requireUser(event: H3Event): Promise<string> {
  const cfg = useRuntimeConfig(event);
  const uid = await verifyUser({
    fetch,
    supabaseUrl: String(cfg.public.supabaseUrl || ''),
    anonKey: String(cfg.public.supabaseAnonKey || ''),
    authorization: getHeader(event, 'authorization'),
  });
  if (!uid) throw createError({ statusCode: 401, statusMessage: 'Sign in required' });
  return uid;
}

/**
 * The public origin the browser used. Behind a proxy the raw request is often
 * http:// on an internal host, but the redirect_uri must byte-match what the
 * browser used (https://<public-host>/...) or Google returns redirect_uri_mismatch.
 */
export function requestOrigin(event: H3Event): string {
  const reqUrl = getRequestURL(event);
  const host = getHeader(event, 'x-forwarded-host') || getHeader(event, 'host') || reqUrl.host;
  const proto = getHeader(event, 'x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export const CALLBACK_PATH = '/api/google-calendar/callback';
