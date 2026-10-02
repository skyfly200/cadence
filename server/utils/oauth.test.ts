import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ACCESS_TTL_MS, CLAUDE_CALLBACK, CODE_TTL_MS, REFRESH_TTL_MS, TOUCH_EVERY_MS, authenticate, authorizationServerMetadata, configFrom, createMemoryOAuthStore,
  describeRequest, handleApprove, handleRegister, handleToken, listConnections, mcpUrl, parseScope, pkceMatches, protectedResourceMetadata,
  redirectAllowed, revokeConnection, sha256, bearerOf, wwwAuthenticate,
} from './oauth';

const T0 = Date.UTC(2026, 9, 2, 12, 0, 0);
let n = 0;
const mk = (now = T0) => { const store = createMemoryOAuthStore(); return { store, deps: { store, now: () => now, newId: () => `id${++n}` } }; };
type Deps = ReturnType<typeof mk>['deps'];
const verifier = 'v'.repeat(50);
const challenge = createHash('sha256').update(verifier).digest('base64url');

async function registered(deps: Deps) {
  const r = await handleRegister(deps, { redirect_uris: [CLAUDE_CALLBACK], client_name: 'Claude' });
  if (r.status !== 201) throw new Error('register failed');
  return r.body.client_id;
}
const request = (clientId: string, extra: Record<string, unknown> = {}) => ({
  client_id: clientId, redirect_uri: CLAUDE_CALLBACK, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', scope: 'read write', ...extra,
});
async function approved(deps: Deps, userId = 'u1', grantScope: unknown = 'read write') {
  const clientId = await registered(deps);
  const r = await handleApprove(deps, { userId, request: request(clientId), grantScope });
  if (r.status !== 200) throw new Error('approve failed');
  const url = new URL((r.body as { redirect: string }).redirect);
  return { clientId, code: url.searchParams.get('code')!, url };
}
const exchange = (deps: Deps, clientId: string, code: string, over: Record<string, unknown> = {}) =>
  handleToken(deps, { grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: CLAUDE_CALLBACK, code_verifier: verifier, ...over });

describe('metadata', () => {
  const c = configFrom('https://cadence.example.com/');
  it('names the resource exactly as the MCP url and lists our issuer first', () => {
    const m = protectedResourceMetadata(c);
    expect(m.resource).toBe(mcpUrl(c));
    expect(m.resource).toBe('https://cadence.example.com/mcp');
    expect(m.authorization_servers[0]).toBe('https://cadence.example.com');
  });
  it('advertises S256 only, public clients and every endpoint from the one issuer', () => {
    const m = authorizationServerMetadata(c);
    expect(m.code_challenge_methods_supported).toEqual(['S256']);
    expect(m.token_endpoint_auth_methods_supported).toContain('none');
    for (const u of [m.authorization_endpoint, m.token_endpoint, m.registration_endpoint]) expect(u.startsWith(m.issuer + '/')).toBe(true);
  });
});

describe('401 header', () => {
  const c = configFrom('https://cadence.example.com');
  it('points at the protected resource metadata, adding invalid_token for a bad token', () => {
    expect(wwwAuthenticate(c)).toBe('Bearer resource_metadata="https://cadence.example.com/.well-known/oauth-protected-resource/mcp"');
    expect(wwwAuthenticate(c, true)).toContain('error="invalid_token"');
  });
  it('reads a bearer token', () => {
    expect(bearerOf('Bearer abc')).toBe('abc');
    expect(bearerOf('bearer  abc ')).toBe('abc');
    expect(bearerOf('Basic abc')).toBeNull();
    expect(bearerOf(undefined)).toBeNull();
  });
});

describe('helpers', () => {
  it('checks PKCE S256', () => {
    expect(pkceMatches(verifier, challenge)).toBe(true);
    expect(pkceMatches('w'.repeat(50), challenge)).toBe(false);
    expect(pkceMatches('short', challenge)).toBe(false);
  });
  it('allows only the Claude callback and loopback redirects', () => {
    expect(redirectAllowed(CLAUDE_CALLBACK)).toBe(true);
    expect(redirectAllowed('http://localhost:54321/callback')).toBe(true);
    expect(redirectAllowed('http://127.0.0.1:8080/cb')).toBe(true);
    expect(redirectAllowed('https://evil.example.com/cb')).toBe(false);
    expect(redirectAllowed('http://example.com/cb')).toBe(false);
    expect(redirectAllowed('https://claude.ai/api/mcp/auth_callback/extra')).toBe(false);
    expect(redirectAllowed('not a url')).toBe(false);
  });
  it('parses scopes, defaulting to read and refusing unknown ones', () => {
    expect(parseScope(undefined)).toEqual(['read']);
    expect(parseScope('write read read')).toEqual(['write', 'read']);
    expect(parseScope('admin')).toBeNull();
    expect(parseScope(5)).toBeNull();
  });
});

describe('handleRegister', () => {
  it('registers a public client with an allowed redirect', async () => {
    const { deps, store } = mk();
    const r = await handleRegister(deps, { redirect_uris: [CLAUDE_CALLBACK], client_name: '  Claude  ' });
    expect(r.status).toBe(201);
    if (r.status !== 201) return;
    expect(r.body).toMatchObject({ client_name: 'Claude', token_endpoint_auth_method: 'none', redirect_uris: [CLAUDE_CALLBACK] });
    expect(store.clients.has(r.body.client_id)).toBe(true);
  });
  it('refuses missing, too many and disallowed redirects', async () => {
    const { deps } = mk();
    const bodies = [null, {}, { redirect_uris: [] }, { redirect_uris: ['https://evil.example.com/cb'] }, { redirect_uris: [CLAUDE_CALLBACK, 5] }, { redirect_uris: Array(6).fill(CLAUDE_CALLBACK) }];
    for (const body of bodies) {
      const r = await handleRegister(deps, body);
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ error: 'invalid_redirect_uri' });
    }
  });
  it('answers 503 when the store fails', async () => {
    const { deps, store } = mk();
    store.failNext = true;
    expect((await handleRegister(deps, { redirect_uris: [CLAUDE_CALLBACK] })).status).toBe(503);
  });
});

describe('describeRequest and handleApprove', () => {
  it('describes who is asking without creating anything', async () => {
    const { deps, store } = mk();
    const clientId = await registered(deps);
    const r = await describeRequest(deps, request(clientId));
    expect(r).toEqual({ status: 200, body: { clientName: 'Claude', scope: ['read', 'write'] } });
    expect(store.grants.size).toBe(0);
  });
  it('rejects bad requests: unknown client, wrong redirect, plain PKCE, no PKCE, unknown scope', async () => {
    const { deps } = mk();
    const clientId = await registered(deps);
    const bads: [Record<string, unknown>, string][] = [
      [{ client_id: 'nope' }, 'invalid_client'],
      [{ redirect_uri: 'https://claude.ai/other' }, 'invalid_redirect_uri'],
      [{ code_challenge_method: 'plain' }, 'invalid_request'],
      [{ code_challenge: undefined }, 'invalid_request'],
      [{ response_type: 'token' }, 'unsupported_response_type'],
      [{ scope: 'admin' }, 'invalid_scope'],
    ];
    for (const [over, error] of bads) {
      const r = await handleApprove(deps, { userId: 'u1', request: request(clientId, over), grantScope: 'read' });
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ error });
    }
  });
  it('redirects back with a code and the state, and stores only the code hash', async () => {
    const { deps, store } = mk();
    const { url, code } = await approved(deps);
    expect(url.origin + url.pathname).toBe(CLAUDE_CALLBACK);
    expect(url.searchParams.get('state')).toBe('xyz');
    expect(store.codes.has(sha256(code))).toBe(true);
    expect(store.codes.has(code)).toBe(false);
  });
  it('lets the user grant less than was asked, never more', async () => {
    const { deps, store } = mk();
    const clientId = await registered(deps);
    const less = await handleApprove(deps, { userId: 'u1', request: request(clientId), grantScope: 'read' });
    expect(less.status).toBe(200);
    expect([...store.grants.values()][0]!.scope).toBe('read');
    const more = await handleApprove(deps, { userId: 'u1', request: request(clientId, { scope: 'read' }), grantScope: 'read write' });
    expect(more.status).toBe(400);
    expect(more.body).toMatchObject({ error: 'invalid_scope' });
  });
});

describe('handleToken: authorization_code', () => {
  it('exchanges a code for rotating tokens with the right lifetimes, stored hashed', async () => {
    const { deps, store } = mk();
    const { clientId, code } = await approved(deps);
    const r = await exchange(deps, clientId, code);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.body).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'read write' });
    const access = store.tokens.get(sha256(r.body.access_token))!;
    const refresh = store.tokens.get(sha256(r.body.refresh_token))!;
    expect(Date.parse(access.expiresAt) - T0).toBe(ACCESS_TTL_MS);
    expect(Date.parse(refresh.expiresAt) - T0).toBe(REFRESH_TTL_MS);
    expect(store.tokens.has(r.body.access_token)).toBe(false);
  });
  it('accepts a code only once', async () => {
    const { deps } = mk();
    const { clientId, code } = await approved(deps);
    expect((await exchange(deps, clientId, code)).status).toBe(200);
    const again = await exchange(deps, clientId, code);
    expect(again.status).toBe(400);
    expect(again.body).toMatchObject({ error: 'invalid_grant' });
  });
  it('refuses a wrong verifier, client or redirect, and an expired code', async () => {
    const wrongs: Record<string, unknown>[] = [{ code_verifier: 'x'.repeat(50) }, { client_id: 'cl_other' }, { redirect_uri: 'http://localhost:1/cb' }, { code_verifier: undefined }];
    for (const over of wrongs) {
      const { deps } = mk();
      const { clientId, code } = await approved(deps);
      const r = await exchange(deps, clientId, code, over);
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ error: 'invalid_grant' });
    }
    const a = mk();
    const { clientId, code } = await approved(a.deps);
    const late = await exchange({ ...a.deps, now: () => T0 + CODE_TTL_MS + 1 }, clientId, code);
    expect(late.body).toMatchObject({ error: 'invalid_grant' });
  });
  it('refuses unknown grant types', async () => {
    const r = await handleToken(mk().deps, { grant_type: 'password' });
    expect(r.body).toMatchObject({ error: 'unsupported_grant_type' });
  });
});

describe('handleToken: refresh_token', () => {
  async function tokens(m: ReturnType<typeof mk>) {
    const { clientId, code } = await approved(m.deps);
    const r = await exchange(m.deps, clientId, code);
    if (r.status !== 200) throw new Error('exchange failed');
    return { clientId, ...r.body };
  }
  it('rotates: a new pair comes back and the old refresh token stops working', async () => {
    const m = mk();
    const t = await tokens(m);
    const next = await handleToken(m.deps, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
    expect(next.status).toBe(200);
    if (next.status !== 200) return;
    expect(next.body.refresh_token).not.toBe(t.refresh_token);
    const reuse = await handleToken(m.deps, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
    expect(reuse.status).toBe(400);
    expect(reuse.body).toMatchObject({ error: 'invalid_grant' });
  });
  it('answers invalid_grant for a bad, expired or access token', async () => {
    const m = mk();
    const t = await tokens(m);
    for (const refresh_token of ['rt_nonsense', t.access_token]) {
      expect((await handleToken(m.deps, { grant_type: 'refresh_token', refresh_token })).body).toMatchObject({ error: 'invalid_grant' });
    }
    const late = await handleToken({ ...m.deps, now: () => T0 + REFRESH_TTL_MS + 1 }, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
    expect(late.body).toMatchObject({ error: 'invalid_grant' });
  });
  it('stops working once the connection is revoked', async () => {
    const m = mk();
    const t = await tokens(m);
    await revokeConnection(m.deps, 'u1', { id: [...m.store.grants.keys()][0] });
    expect((await handleToken(m.deps, { grant_type: 'refresh_token', refresh_token: t.refresh_token })).body).toMatchObject({ error: 'invalid_grant' });
  });
});

describe('authenticate', () => {
  it('recognises a live access token and its scope, and touches last-used at most once a minute', async () => {
    const { deps, store } = mk();
    const { clientId, code } = await approved(deps, 'u1', 'read');
    const t = await exchange(deps, clientId, code);
    if (t.status !== 200) throw new Error('x');
    expect(await authenticate(deps, t.body.access_token)).toMatchObject({ userId: 'u1', scope: ['read'], clientName: 'Claude' });
    expect(store.touches).toBe(1);
    await authenticate(deps, t.body.access_token);
    expect(store.touches).toBe(1);
    await authenticate({ ...deps, now: () => T0 + TOUCH_EVERY_MS }, t.body.access_token);
    expect(store.touches).toBe(2);
  });
  it('refuses nothing, junk, a refresh token, an expired token and a revoked connection', async () => {
    const { deps, store } = mk();
    const { clientId, code } = await approved(deps);
    const t = await exchange(deps, clientId, code);
    if (t.status !== 200) throw new Error('x');
    expect(await authenticate(deps, null)).toBeNull();
    expect(await authenticate(deps, 'at_junk')).toBeNull();
    expect(await authenticate(deps, t.body.refresh_token)).toBeNull();
    expect(await authenticate({ ...deps, now: () => T0 + ACCESS_TTL_MS + 1 }, t.body.access_token)).toBeNull();
    store.grants.forEach((g) => { g.revokedAt = new Date(T0).toISOString(); });
    expect(await authenticate(deps, t.body.access_token)).toBeNull();
  });
});

describe('connections list and revoke', () => {
  it('lists only the user\'s live connections with name and last used', async () => {
    const { deps } = mk();
    await approved(deps, 'u1');
    await approved(deps, 'u2');
    const r = await listConnections(deps, 'u1');
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.body.connections).toHaveLength(1);
    expect(r.body.connections[0]).toMatchObject({ name: 'Claude', scope: 'read write', lastUsedAt: null });
  });
  it('revokes the user\'s own connection only', async () => {
    const { deps, store } = mk();
    await approved(deps, 'u1');
    const id = [...store.grants.keys()][0]!;
    expect((await revokeConnection(deps, 'u2', { id })).status).toBe(400);
    expect((await revokeConnection(deps, 'u1', { id })).status).toBe(200);
    const r = await listConnections(deps, 'u1');
    expect(r.status === 200 && r.body.connections).toEqual([]);
    expect((await revokeConnection(deps, 'u1', {})).status).toBe(400);
  });
});
