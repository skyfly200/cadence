/**
 * Nitro glue for the capture route: the store, built from runtime config.
 * Kept thin; the logic that needs testing lives in capture.ts.
 */
import type { H3Event } from 'h3';
import { createServiceClient, createSupabaseCaptureStore, type CaptureStore } from './capture';

/** The capture store, or the names of what is missing (so the route can answer calmly). */
export function captureStore(event: H3Event): { ok: true; store: CaptureStore } | { ok: false; missing: string[] } {
  const cfg = useRuntimeConfig(event);
  // Read at runtime too: Nuxt bakes process.env into runtimeConfig at build time (see gcal-context.ts).
  const serviceRoleKey = String(cfg.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabaseUrl = String(cfg.public.supabaseUrl || '');
  const missing: string[] = [];
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl) missing.push('NUXT_PUBLIC_SUPABASE_URL');
  if (missing.length) return { ok: false, missing };
  return { ok: true, store: createSupabaseCaptureStore(createServiceClient(supabaseUrl, serviceRoleKey)) };
}
