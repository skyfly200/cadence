/**
 * The thin OAuth authorization server for assistant connectors (ticket 11).
 * Framework-free (no Nitro globals): the store and the clock are injected, so it is
 * unit tested with an in-memory store.
 *
 * What it implements (what a Claude custom connector needs):
 *  - RFC 9728 protected resource metadata and RFC 8414 authorization server metadata;
 *  - RFC 7591 dynamic client registration (public clients, no secret);
 *  - authorization code + PKCE (S256 only), one-time codes;
 *  - rotating refresh tokens; access tokens last 1 hour, refresh tokens 30 days;
 *  - tokens are random, shown once and stored only as SHA-256 hashes.
 * The consent screen (a page) signs the user in with the app's own Supabase session and
 * posts to `handleApprove`, which is why approving needs a signed-in user id.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

// ── limits and constants ───────────────────────────────────────

export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CODE_TTL_MS = 5 * 60 * 1000;
/** `last_used_at` is refreshed at most this often, so reading does not write on every call. */
export const TOUCH_EVERY_MS = 60 * 1000;
export const MAX_REDIRECT_URIS = 5;

export type Scope = 'read' | 'write';
export const SCOPES: readonly Scope[] = ['read', 'write'];
export const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

// ── config: every URL comes from one value ─────────────────────

export interface OAuthConfig {
  /** The public origin (the app's siteUrl), no trailing slash. */
  issuer: string;
}
export const configFrom = (siteUrl: string): OAuthConfig => ({ issuer: siteUrl.replace(/\/+$/, '') });
export const mcpUrl = (c: OAuthConfig) => `${c.issuer}/mcp`;
export const resourceMetadataUrl = (c: OAuthConfig) => `${c.issuer}/.well-known/oauth-protected-resource/mcp`;

/** RFC 9728. `resource` must equal the URL the user enters in Claude, exactly. */
export function protectedResourceMetadata(c: OAuthConfig) {
  return {
    resource: mcpUrl(c),
    authorization_servers: [c.issuer],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Cadence',
  };
}

/**
 * The header that tells an assistant where to sign in. A 200 would not start the sign-in, so an
 * unauthenticated call must answer 401 with this. `invalid` adds the RFC 6750 error for a bad token.
 */
export function wwwAuthenticate(c: OAuthConfig, invalid = false): string {
  return `Bearer ${invalid ? 'error="invalid_token", ' : ''}resource_metadata="${resourceMetadataUrl(c)}"`;
}

/** The token from an Authorization header, or null. */
export function bearerOf(header: string | undefined | null): string | null {
  const m = header ? /^Bearer\s+(\S+)$/i.exec(header.trim()) : null;
  return m ? m[1]! : null;
}

/** RFC 8414. */
export function authorizationServerMetadata(c: OAuthConfig) {
  return {
    issuer: c.issuer,
    authorization_endpoint: `${c.issuer}/oauth/authorize`,
    token_endpoint: `${c.issuer}/oauth/token`,
    registration_endpoint: `${c.issuer}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...SCOPES],
  };
}

// ── helpers ────────────────────────────────────────────────────

export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
/** A fresh opaque secret, URL safe. */
export const newSecret = (prefix: string) => `${prefix}_${randomBytes(32).toString('base64url')}`;

/** S256: BASE64URL(SHA256(verifier)) must equal the challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash('sha256').update(verifier, 'utf8').digest('base64url') === challenge;
}

/** Claude's callback exactly, or a loopback address (Claude Code uses any port). */
export function redirectAllowed(uri: string): boolean {
  if (uri === CLAUDE_CALLBACK) return true;
  try {
    const u = new URL(uri);
    return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '[::1]') && !u.hash;
  } catch { return false; }
}

export const parseScope = (raw: unknown): Scope[] | null => {
  if (raw === undefined || raw === null || raw === '') return ['read'];
  if (typeof raw !== 'string') return null;
  const parts = [...new Set(raw.split(/\s+/).filter(Boolean))];
  if (!parts.length || !parts.every((p): p is Scope => (SCOPES as readonly string[]).includes(p))) return null;
  return parts as Scope[];
};
export const scopeString = (s: readonly Scope[]) => SCOPES.filter((x) => s.includes(x)).join(' ');

// ── store ──────────────────────────────────────────────────────

export interface OAuthClient { clientId: string; clientName: string; redirectUris: string[] }

export interface Grant {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CodeRecord {
  codeHash: string; grantId: string; userId: string; clientId: string; redirectUri: string;
  challenge: string; scope: string; expiresAt: string; usedAt: string | null;
}

export type TokenKind = 'access' | 'refresh';
export interface TokenRecord {
  tokenHash: string; kind: TokenKind; grantId: string; userId: string; expiresAt: string; replacedAt: string | null;
}

export interface OAuthStore {
  saveClient(c: OAuthClient, atIso: string): Promise<void>;
  getClient(clientId: string): Promise<OAuthClient | null>;
  saveGrant(g: Grant): Promise<void>;
  getGrant(grantId: string): Promise<Grant | null>;
  saveCode(c: CodeRecord): Promise<void>;
  /** Mark the code used and return it; null when unknown or already used (one time only). */
  takeCode(codeHash: string, atIso: string): Promise<CodeRecord | null>;
  saveToken(t: TokenRecord): Promise<void>;
  getToken(tokenHash: string): Promise<TokenRecord | null>;
  /** Mark a refresh token replaced (rotated). */
  markReplaced(tokenHash: string, atIso: string): Promise<void>;
  touchGrant(grantId: string, atIso: string): Promise<void>;
  listGrants(userId: string): Promise<Grant[]>;
  /** Revoke one of the user's grants; false when it is not theirs. */
  revokeGrant(userId: string, grantId: string, atIso: string): Promise<boolean>;
}

export interface OAuthDeps { store: OAuthStore; now?: () => number; newId?: () => string }
const clock = (d: OAuthDeps) => d.now ?? Date.now;
const idOf = (d: OAuthDeps) => d.newId ?? randomUUID;
const iso = (ms: number) => new Date(ms).toISOString();

// ── errors ─────────────────────────────────────────────────────

export interface OAuthErrorBody { error: string; error_description?: string }
type Res<T> = { status: 200 | 201; body: T } | { status: 400 | 401 | 503; body: OAuthErrorBody };
const err = (status: 400 | 401 | 503, error: string, error_description?: string) => ({ status, body: { error, ...(error_description ? { error_description } : {}) } });

// ── dynamic client registration (RFC 7591) ─────────────────────

export async function handleRegister(deps: OAuthDeps, body: unknown): Promise<Res<{
  client_id: string; client_name: string; redirect_uris: string[]; token_endpoint_auth_method: 'none';
  grant_types: string[]; response_types: string[]; client_id_issued_at: number;
}>> {
  const b = body as { redirect_uris?: unknown; client_name?: unknown } | null;
  const uris = b?.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > MAX_REDIRECT_URIS || !uris.every((u) => typeof u === 'string')) {
    return err(400, 'invalid_redirect_uri', 'Send one or more redirect_uris.');
  }
  if (!(uris as string[]).every(redirectAllowed)) return err(400, 'invalid_redirect_uri', 'That redirect address is not allowed.');
  const name = typeof b?.client_name === 'string' && b.client_name.trim() ? b.client_name.trim().slice(0, 60) : 'An assistant';
  const now = clock(deps)();
  const client: OAuthClient = { clientId: `cl_${idOf(deps)()}`, clientName: name, redirectUris: uris as string[] };
  try { await deps.store.saveClient(client, iso(now)); } catch { return err(503, 'server_error'); }
  return {
    status: 201,
    body: {
      client_id: client.clientId, client_name: name, redirect_uris: client.redirectUris, token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], client_id_issued_at: Math.floor(now / 1000),
    },
  };
}

// ── consent: what the signed-in page needs to show, and approval ──

export interface AuthRequest {
  client_id?: unknown; redirect_uri?: unknown; response_type?: unknown; scope?: unknown;
  state?: unknown; code_challenge?: unknown; code_challenge_method?: unknown;
}

type Checked = { ok: true; client: OAuthClient; redirectUri: string; scope: Scope[]; challenge: string; state: string | null } | { ok: false; error: string };

async function checkRequest(deps: OAuthDeps, r: AuthRequest): Promise<Checked> {
  if (typeof r.client_id !== 'string') return { ok: false, error: 'invalid_request' };
  const client = await deps.store.getClient(r.client_id);
  if (!client) return { ok: false, error: 'invalid_client' };
  if (typeof r.redirect_uri !== 'string' || !client.redirectUris.includes(r.redirect_uri) || !redirectAllowed(r.redirect_uri)) {
    return { ok: false, error: 'invalid_redirect_uri' };
  }
  if (r.response_type !== 'code') return { ok: false, error: 'unsupported_response_type' };
  if (typeof r.code_challenge !== 'string' || !/^[A-Za-z0-9\-._~]{43,128}$/.test(r.code_challenge) || r.code_challenge_method !== 'S256') {
    return { ok: false, error: 'invalid_request' };
  }
  const scope = parseScope(r.scope);
  if (!scope) return { ok: false, error: 'invalid_scope' };
  const state = typeof r.state === 'string' ? r.state.slice(0, 500) : null;
  return { ok: true, client, redirectUri: r.redirect_uri, scope, challenge: r.code_challenge, state };
}

/** What the consent page shows: which assistant is asking, and for what. Nothing is created. */
export async function describeRequest(deps: OAuthDeps, r: AuthRequest): Promise<Res<{ clientName: string; scope: Scope[] }>> {
  try {
    const c = await checkRequest(deps, r);
    if (!c.ok) return err(400, c.error);
    return { status: 200, body: { clientName: c.client.clientName, scope: c.scope } };
  } catch { return err(503, 'server_error'); }
}

/**
 * The signed-in user said yes. `grantScope` is what they chose (it may be narrower than what was asked).
 * Answers with the URL to send the browser to (the client's redirect with `code` and `state`).
 */
export async function handleApprove(
  deps: OAuthDeps, input: { userId: string; request: AuthRequest; grantScope: unknown },
): Promise<Res<{ redirect: string }>> {
  try {
    const c = await checkRequest(deps, input.request);
    if (!c.ok) return err(400, c.error);
    const chosen = parseScope(input.grantScope);
    if (!chosen || !chosen.every((s) => c.scope.includes(s))) return err(400, 'invalid_scope', 'That is more than was asked for.');
    const now = clock(deps)();
    const grant: Grant = {
      id: `gr_${idOf(deps)()}`, userId: input.userId, clientId: c.client.clientId, clientName: c.client.clientName,
      scope: scopeString(chosen), createdAt: iso(now), lastUsedAt: null, revokedAt: null,
    };
    await deps.store.saveGrant(grant);
    const code = newSecret('cc');
    await deps.store.saveCode({
      codeHash: sha256(code), grantId: grant.id, userId: input.userId, clientId: c.client.clientId, redirectUri: c.redirectUri,
      challenge: c.challenge, scope: grant.scope, expiresAt: iso(now + CODE_TTL_MS), usedAt: null,
    });
    const url = new URL(c.redirectUri);
    url.searchParams.set('code', code);
    if (c.state !== null) url.searchParams.set('state', c.state);
    return { status: 200, body: { redirect: url.toString() } };
  } catch { return err(503, 'server_error'); }
}

// ── token endpoint ─────────────────────────────────────────────

export interface TokenResponse { access_token: string; token_type: 'Bearer'; expires_in: number; refresh_token: string; scope: string }

async function issue(deps: OAuthDeps, grant: { id: string; userId: string; scope: string }, now: number): Promise<TokenResponse> {
  const access = newSecret('at');
  const refresh = newSecret('rt');
  await deps.store.saveToken({ tokenHash: sha256(access), kind: 'access', grantId: grant.id, userId: grant.userId, expiresAt: iso(now + ACCESS_TTL_MS), replacedAt: null });
  await deps.store.saveToken({ tokenHash: sha256(refresh), kind: 'refresh', grantId: grant.id, userId: grant.userId, expiresAt: iso(now + REFRESH_TTL_MS), replacedAt: null });
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_MS / 1000, refresh_token: refresh, scope: grant.scope };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export async function handleToken(deps: OAuthDeps, form: unknown): Promise<Res<TokenResponse>> {
  const f = (form && typeof form === 'object' ? form : {}) as Record<string, unknown>;
  const now = clock(deps)();
  try {
    if (f.grant_type === 'authorization_code') {
      const code = await deps.store.takeCode(sha256(str(f.code)), iso(now));
      if (!code || Date.parse(code.expiresAt) < now) return err(400, 'invalid_grant', 'That code is not valid.');
      if (code.clientId !== str(f.client_id) || code.redirectUri !== str(f.redirect_uri) || !pkceMatches(str(f.code_verifier), code.challenge)) {
        return err(400, 'invalid_grant', 'That code does not match.');
      }
      const grant = await deps.store.getGrant(code.grantId);
      if (!grant || grant.revokedAt) return err(400, 'invalid_grant', 'That connection was revoked.');
      return { status: 200, body: await issue(deps, grant, now) };
    }
    if (f.grant_type === 'refresh_token') {
      const hash = sha256(str(f.refresh_token));
      const tok = await deps.store.getToken(hash);
      if (!tok || tok.kind !== 'refresh' || tok.replacedAt || Date.parse(tok.expiresAt) < now) return err(400, 'invalid_grant', 'That refresh token is not valid.');
      const grant = await deps.store.getGrant(tok.grantId);
      if (!grant || grant.revokedAt) return err(400, 'invalid_grant', 'That connection was revoked.');
      if (f.client_id !== undefined && str(f.client_id) !== grant.clientId) return err(400, 'invalid_grant', 'That token belongs to another client.');
      await deps.store.markReplaced(hash, iso(now));
      return { status: 200, body: await issue(deps, grant, now) };
    }
    return err(400, 'unsupported_grant_type');
  } catch { return err(503, 'server_error'); }
}

// ── authenticating an MCP call ─────────────────────────────────

export interface AssistantAuth { userId: string; scope: Scope[]; grantId: string; clientName: string }

/** The assistant behind a bearer token, or null (unknown, expired, replaced, revoked). Bumps last-used, at most once a minute. */
export async function authenticate(deps: OAuthDeps, bearer: string | null | undefined): Promise<AssistantAuth | null> {
  if (!bearer) return null;
  const now = clock(deps)();
  try {
    const tok = await deps.store.getToken(sha256(bearer));
    if (!tok || tok.kind !== 'access' || Date.parse(tok.expiresAt) < now) return null;
    const grant = await deps.store.getGrant(tok.grantId);
    if (!grant || grant.revokedAt) return null;
    if (!grant.lastUsedAt || now - Date.parse(grant.lastUsedAt) >= TOUCH_EVERY_MS) await deps.store.touchGrant(grant.id, iso(now));
    return { userId: grant.userId, scope: parseScope(grant.scope) ?? [], grantId: grant.id, clientName: grant.clientName };
  } catch { return null; }
}

// ── the Settings list ──────────────────────────────────────────

export interface Connection { id: string; name: string; scope: string; connectedAt: string; lastUsedAt: string | null }

export async function listConnections(deps: OAuthDeps, userId: string): Promise<Res<{ ok: true; connections: Connection[] }> | { status: 503; body: OAuthErrorBody }> {
  try {
    const grants = await deps.store.listGrants(userId);
    return {
      status: 200,
      body: {
        ok: true,
        connections: grants.filter((g) => !g.revokedAt).map((g) => ({ id: g.id, name: g.clientName, scope: g.scope, connectedAt: g.createdAt, lastUsedAt: g.lastUsedAt })),
      },
    };
  } catch { return err(503, 'server_error'); }
}

export async function revokeConnection(deps: OAuthDeps, userId: string, body: unknown): Promise<Res<{ ok: true }>> {
  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || !id) return err(400, 'invalid_request', 'Say which connection to revoke.');
  try {
    const done = await deps.store.revokeGrant(userId, id, iso(clock(deps)()));
    return done ? { status: 200, body: { ok: true } } : err(400, 'not_found', 'That connection was not found.');
  } catch { return err(503, 'server_error'); }
}

// ── stores ─────────────────────────────────────────────────────

/** In-memory store for tests. */
export function createMemoryOAuthStore() {
  const clients = new Map<string, OAuthClient>();
  const grants = new Map<string, Grant>();
  const codes = new Map<string, CodeRecord>();
  const tokens = new Map<string, TokenRecord>();
  const store: OAuthStore & { clients: typeof clients; grants: typeof grants; codes: typeof codes; tokens: typeof tokens; touches: number; failNext?: boolean } = {
    clients, grants, codes, tokens, touches: 0,
    async saveClient(c) { if (store.failNext) throw new Error('boom'); clients.set(c.clientId, c); },
    async getClient(id) { return clients.get(id) ?? null; },
    async saveGrant(g) { grants.set(g.id, { ...g }); },
    async getGrant(id) { const g = grants.get(id); return g ? { ...g } : null; },
    async saveCode(c) { codes.set(c.codeHash, { ...c }); },
    async takeCode(hash, at) {
      const c = codes.get(hash);
      if (!c || c.usedAt) return null;
      c.usedAt = at;
      return { ...c };
    },
    async saveToken(t) { tokens.set(t.tokenHash, { ...t }); },
    async getToken(h) { const t = tokens.get(h); return t ? { ...t } : null; },
    async markReplaced(h, at) { const t = tokens.get(h); if (t) t.replacedAt = at; },
    async touchGrant(id, at) { const g = grants.get(id); if (g) { g.lastUsedAt = at; store.touches++; } },
    async listGrants(userId) { return [...grants.values()].filter((g) => g.userId === userId).map((g) => ({ ...g })); },
    async revokeGrant(userId, id, at) {
      const g = grants.get(id);
      if (!g || g.userId !== userId) return false;
      g.revokedAt = at;
      return true;
    },
  };
  return store;
}

/** The slice of the Supabase client the store uses (so tests can fake it). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OAuthDb = { from(table: string): any };

const fail = (what: string, e: { code?: string } | null) => { if (e) throw new Error(`${what} failed: ${e.code ?? 'error'}`); };

const grantOf = (r: Record<string, unknown>): Grant => ({
  id: String(r.id), userId: String(r.user_id), clientId: String(r.client_id), clientName: String(r.client_name), scope: String(r.scope),
  createdAt: String(r.created_at), lastUsedAt: (r.last_used_at as string | null) ?? null, revokedAt: (r.revoked_at as string | null) ?? null,
});

/** Backed by the tables in supabase/drafts/0008_connectors.sql, written with the service role. */
export function createSupabaseOAuthStore(db: OAuthDb): OAuthStore {
  return {
    async saveClient(c, at) {
      const { error } = await db.from('oauth_clients').insert({ client_id: c.clientId, client_name: c.clientName, redirect_uris: c.redirectUris, created_at: at });
      fail('oauth client write', error);
    },
    async getClient(id) {
      const { data, error } = await db.from('oauth_clients').select('client_id,client_name,redirect_uris').eq('client_id', id).maybeSingle();
      fail('oauth client read', error);
      return data ? { clientId: data.client_id, clientName: data.client_name, redirectUris: data.redirect_uris } : null;
    },
    async saveGrant(g) {
      const { error } = await db.from('oauth_grants').insert({
        id: g.id, user_id: g.userId, client_id: g.clientId, client_name: g.clientName, scope: g.scope, created_at: g.createdAt,
      });
      fail('oauth grant write', error);
    },
    async getGrant(id) {
      const { data, error } = await db.from('oauth_grants').select('*').eq('id', id).maybeSingle();
      fail('oauth grant read', error);
      return data ? grantOf(data) : null;
    },
    async saveCode(c) {
      const { error } = await db.from('oauth_codes').insert({
        code_hash: c.codeHash, grant_id: c.grantId, user_id: c.userId, client_id: c.clientId, redirect_uri: c.redirectUri,
        challenge: c.challenge, scope: c.scope, expires_at: c.expiresAt,
      });
      fail('oauth code write', error);
    },
    async takeCode(hash, at) {
      // One statement: only an unused row matches, so two racing exchanges cannot both win.
      const { data, error } = await db.from('oauth_codes').update({ used_at: at }).eq('code_hash', hash).is('used_at', null).select('*').maybeSingle();
      fail('oauth code read', error);
      return data ? {
        codeHash: data.code_hash, grantId: data.grant_id, userId: data.user_id, clientId: data.client_id, redirectUri: data.redirect_uri,
        challenge: data.challenge, scope: data.scope, expiresAt: data.expires_at, usedAt: data.used_at,
      } : null;
    },
    async saveToken(t) {
      const { error } = await db.from('oauth_tokens').insert({
        token_hash: t.tokenHash, kind: t.kind, grant_id: t.grantId, user_id: t.userId, expires_at: t.expiresAt,
      });
      fail('oauth token write', error);
    },
    async getToken(h) {
      const { data, error } = await db.from('oauth_tokens').select('*').eq('token_hash', h).maybeSingle();
      fail('oauth token read', error);
      return data ? { tokenHash: data.token_hash, kind: data.kind, grantId: data.grant_id, userId: data.user_id, expiresAt: data.expires_at, replacedAt: data.replaced_at ?? null } : null;
    },
    async markReplaced(h, at) {
      const { error } = await db.from('oauth_tokens').update({ replaced_at: at }).eq('token_hash', h);
      fail('oauth token write', error);
    },
    async touchGrant(id, at) {
      const { error } = await db.from('oauth_grants').update({ last_used_at: at }).eq('id', id);
      fail('oauth grant write', error);
    },
    async listGrants(userId) {
      const { data, error } = await db.from('oauth_grants').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      fail('oauth grant read', error);
      return (data as Record<string, unknown>[] ?? []).map(grantOf);
    },
    async revokeGrant(userId, id, at) {
      const { data, error } = await db.from('oauth_grants').update({ revoked_at: at }).eq('id', id).eq('user_id', userId).is('revoked_at', null).select('id');
      fail('oauth grant write', error);
      return Array.isArray(data) && data.length > 0;
    },
  };
}
