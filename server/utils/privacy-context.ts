/**
 * Nitro glue for the account routes: the store, built from runtime config.
 * Kept thin; the logic that needs testing lives in privacy.ts.
 */
import type { H3Event } from 'h3';
import { createServiceClient } from './capture';
import { createSupabasePrivacyStore, type PrivacyStore } from './privacy';

/** The privacy store, or the names of what is missing (so the route can answer calmly). */
export function privacyStore(event: H3Event): { ok: true; store: PrivacyStore } | { ok: false; missing: string[] } {
  const cfg = useRuntimeConfig(event);
  // Read at runtime too: Nuxt bakes process.env into runtimeConfig at build time (see gcal-context.ts).
  const serviceRoleKey = String(cfg.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabaseUrl = String(cfg.public.supabaseUrl || '');
  const missing: string[] = [];
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl) missing.push('NUXT_PUBLIC_SUPABASE_URL');
  if (missing.length) return { ok: false, missing };
  return { ok: true, store: createSupabasePrivacyStore(createServiceClient(supabaseUrl, serviceRoleKey)) };
}
