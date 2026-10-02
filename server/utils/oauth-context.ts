/**
 * Nitro glue for the connector routes: the stores and config, built from runtime config.
 * Kept thin; the logic that needs testing lives in oauth.ts and mcp.ts.
 */
import type { H3Event } from 'h3';
import { createServiceClient, createSupabaseCaptureStore } from './capture';
import { createSupabaseMcpStore, type McpDeps } from './mcp';
import { bearerOf, authenticate, configFrom, createSupabaseOAuthStore, wwwAuthenticate, type AssistantAuth, type OAuthConfig, type OAuthDeps } from './oauth';

export interface ConnectorContext { config: OAuthConfig; oauth: OAuthDeps; mcp: McpDeps }

/** The deps for the connector routes, or the names of what is missing (so a route can answer calmly). */
export function connectorContext(event: H3Event): { ok: true; ctx: ConnectorContext } | { ok: false; missing: string[] } {
  const cfg = useRuntimeConfig(event);
  // Read at runtime too: Nuxt bakes process.env into runtimeConfig at build time (see gcal-context.ts).
  const serviceRoleKey = String(cfg.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabaseUrl = String(cfg.public.supabaseUrl || '');
  const missing: string[] = [];
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl) missing.push('NUXT_PUBLIC_SUPABASE_URL');
  if (missing.length) return { ok: false, missing };
  const db = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    ok: true,
    ctx: {
      // The one config value every connector URL comes from: the site URL the app already uses.
      config: configFrom(String(cfg.public.siteUrl || '')),
      oauth: { store: createSupabaseOAuthStore(db) },
      mcp: { store: createSupabaseMcpStore(db), capture: createSupabaseCaptureStore(db) },
    },
  };
}

/** The assistant behind this request's bearer token, or a 401 that tells the assistant where to sign in. */
export async function requireAssistant(event: H3Event, ctx: ConnectorContext): Promise<AssistantAuth> {
  const bearer = bearerOf(getHeader(event, 'authorization'));
  const auth = await authenticate(ctx.oauth, bearer);
  if (!auth) {
    setResponseHeader(event, 'WWW-Authenticate', wwwAuthenticate(ctx.config, bearer !== null));
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  return auth;
}
