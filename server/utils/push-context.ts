/**
 * Nitro glue for the push routes: the service-role client and runtime config.
 * Kept thin; the logic that needs testing lives in push.ts and nudges.ts.
 */
import type { H3Event } from 'h3';
import { createServiceClient, type SupabaseLike } from './push';

/** Everything the push routes need, or the names of what is missing. */
export function pushContext(event: H3Event): { ok: true; supabase: SupabaseLike } | { ok: false; missing: string[] } {
  const cfg = useRuntimeConfig(event);
  const serviceRoleKey = String(cfg.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabaseUrl = String(cfg.public.supabaseUrl || '');
  const missing: string[] = [];
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl) missing.push('NUXT_PUBLIC_SUPABASE_URL');
  if (missing.length) return { ok: false, missing };
  return { ok: true, supabase: createServiceClient(supabaseUrl, serviceRoleKey) };
}
