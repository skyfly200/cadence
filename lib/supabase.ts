/**
 * Supabase client singleton (browser-only).
 *
 * The publishable/anon key is safe to ship to the client — every table is
 * protected by row-level security scoped to auth.uid(), so a signed-in user
 * can only ever read or write their own rows. When no URL/key is configured
 * the app stays fully local-first (getSupabase returns null everywhere).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (client) return client;
  const cfg = useRuntimeConfig();
  const url = cfg.public.supabaseUrl as string;
  const key = cfg.public.supabaseAnonKey as string;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Keep the auth token under the app's namespace in localStorage.
      storageKey: 'cadence:supabase-auth',
      flowType: 'pkce',
    },
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  const cfg = useRuntimeConfig();
  return !!(cfg.public.supabaseUrl && cfg.public.supabaseAnonKey);
}
