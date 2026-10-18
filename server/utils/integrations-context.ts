/**
 * Nitro glue for the outside-service routes (GitHub now; Vercel and Netlify next): the token
 * vault built from runtime config. Kept thin; the logic that needs testing lives in
 * service-tokens.ts and github.ts.
 */
import type { H3Event } from 'h3';
import { parseKey } from './google-tokens';
import { createServiceVault, createSupabaseServiceTokenStore, type ServiceVault } from './service-tokens';

/** The vault, or the list of what is missing (so a route can say so calmly). */
export function serviceVault(event: H3Event): { ok: true; vault: ServiceVault } | { ok: false; missing: string[] } {
  const cfg = useRuntimeConfig(event);
  // Read at runtime too: Nuxt bakes process.env into runtimeConfig at build time (see gcal-context.ts).
  const serviceRoleKey = String(cfg.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabaseUrl = String(cfg.public.supabaseUrl || '');
  const missing: string[] = [];
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  let key: Buffer | null = null;
  try { key = parseKey(String(cfg.cadenceTokenKey || process.env.CADENCE_TOKEN_KEY || '')); } catch { missing.push('CADENCE_TOKEN_KEY'); }
  if (missing.length || !key) return { ok: false, missing };
  return { ok: true, vault: createServiceVault(createSupabaseServiceTokenStore(supabaseUrl, serviceRoleKey), key) };
}
