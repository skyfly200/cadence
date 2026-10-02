/**
 * Nitro glue for AI routes: the provider and store, built from runtime config.
 * Kept thin; the logic that needs testing lives in ai.ts.
 */
import type { H3Event } from 'h3';
import {
  DEFAULT_DAILY_CALL_CAP, createAnthropicProvider, createOpenAiCompatProvider, createSupabaseAiStore,
  type AiDeps, type AiProvider,
} from './ai';
import { createServiceClient } from './capture';

/** The deps for runAi, or the names of what is missing (so the route can answer calmly). */
export function aiDeps(event: H3Event): { ok: true; deps: AiDeps } | { ok: false; missing: string[] } {
  const cfg = useRuntimeConfig(event);
  // Read at runtime too: Nuxt bakes process.env into runtimeConfig at build time (see gcal-context.ts).
  const env = process.env;
  const serviceRoleKey = String(cfg.supabaseServiceRoleKey || env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabaseUrl = String(cfg.public.supabaseUrl || '');
  const missing: string[] = [];
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl) missing.push('NUXT_PUBLIC_SUPABASE_URL');
  if (missing.length) return { ok: false, missing };

  const fast = env.AI_MODEL_FAST;
  const strong = env.AI_MODEL_STRONG;
  let provider: AiProvider | null = null;
  if (env.AI_BASE_URL && fast && strong) {
    provider = createOpenAiCompatProvider({ baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, models: { fast, strong } });
  } else if (env.ANTHROPIC_API_KEY) {
    provider = createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, models: { ...(fast ? { fast } : {}), ...(strong ? { strong } : {}) } });
  }
  const cap = Number(env.AI_DAILY_CALL_CAP);
  return {
    ok: true,
    deps: {
      provider,
      store: createSupabaseAiStore(createServiceClient(supabaseUrl, serviceRoleKey)),
      dailyCap: Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_DAILY_CALL_CAP,
    },
  };
}

/** The service-role client the AI routes read nodes with (call after aiDeps has confirmed the config). */
export function aiServiceClient(event: H3Event) {
  const cfg = useRuntimeConfig(event);
  return createServiceClient(String(cfg.public.supabaseUrl || ''), String(cfg.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || ''));
}
