import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { DRIVE_FILE_SCOPE, buildAuthUrl, exchangeCode } from './google-oauth';
import { createMemoryTokenStore, createTokenVault, type GoogleTokens, type TokenVault } from './google-tokens';
import { MAX_DOC_CHARS, handleCapabilities, handleDoc, type ImportDeps } from './google-import';

const CAL = 'https://www.googleapis.com/auth/calendar.readonly';
const key = randomBytes(32);
const FUTURE = Date.now() + 3600_000;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function setup(tokens: Partial<GoogleTokens> | null, route: (url: string) => Response | Promise<Response>) {
  const vault: TokenVault = createTokenVault(createMemoryTokenStore(), key);
  if (tokens) await vault.save('u1', { accessToken: 'at', refreshToken: 'rt', expiresAt: FUTURE, email: 'me@example.com', ...tokens });
  const f = vi.fn(async (url: string | URL | Request) => route(String(url)));
  const deps: ImportDeps = { vault, fetch: f as unknown as typeof fetch, clientId: 'cid', clientSecret: 'sec' };
  return { deps, f };
}
const urlsCalled = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => String(c[0]));
const GRANTED = `${CAL} ${DRIVE_FILE_SCOPE}`;

describe('scopes', () => {
  it('asks Google for Drive per-file access as well as Calendar', () => {
    const scope = new URL(buildAuthUrl({ clientId: 'c', redirectUri: 'https://x/cb', state: 's' })).searchParams.get('scope') ?? '';
    expect(scope.split(' ')).toEqual(expect.arrayContaining([CAL, DRIVE_FILE_SCOPE]));
  });

  it('records the scopes Google granted, and tokens saved before imports count as calendar only', async () => {
    const f = (async () => json({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: GRANTED })) as unknown as typeof fetch;
    const r = await exchangeCode({ fetch: f, clientId: 'c', clientSecret: 's', redirectUri: 'https://x/cb', code: 'code' });
    expect(r.ok && r.tokens.scope).toBe(GRANTED);

    const vault = createTokenVault(createMemoryTokenStore(), key);
    await vault.save('new', r.ok ? r.tokens : (undefined as never));
    await vault.save('old', { accessToken: 'a', refreshToken: 'r', expiresAt: FUTURE, email: '' });
    expect(await vault.scopes('new')).toEqual(GRANTED.split(' '));
    expect(await vault.scopes('old')).toEqual([CAL]);
    expect(await vault.scopes('nobody')).toEqual([]);
  });

  it('reports what can be imported without exposing a token', async () => {
    const { deps } = await setup({ scope: CAL }, () => json({}));
    expect(await handleCapabilities(deps, 'u1')).toEqual({ connected: true, email: 'me@example.com', canImportDocs: false });
    const { deps: none } = await setup(null, () => json({}));
    expect(await handleCapabilities(none, 'u1')).toEqual({ connected: false, email: null, canImportDocs: false });
  });
});

describe('handleDoc', () => {
  const ID = 'abcDEF123456_-xyz';
  const doc = (text: string) => (url: string) => (url.includes(`/files/${ID}/export`) ? new Response(text) : json({}, 404));

  it('reads one picked document as plain text through the Drive export, read-only', async () => {
    const { deps, f } = await setup({ scope: GRANTED }, doc('  Plan the trip.\nBook the flights.  '));
    const r = await handleDoc(deps, { userId: 'u1', body: { fileId: ID }, maxChars: 4000 });
    expect(r).toEqual({ status: 200, body: { ok: true, text: 'Plan the trip.\nBook the flights.', truncated: false } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://www.googleapis.com/drive/v3/files/${ID}/export?mimeType=text%2Fplain`);
    expect(init.method).toBeUndefined();
  });

  it('says so when the text is longer than extraction takes, rather than silently cutting it', async () => {
    const { deps } = await setup({ scope: GRANTED }, doc('x'.repeat(5000)));
    const r = await handleDoc(deps, { userId: 'u1', body: { fileId: ID }, maxChars: 4000 });
    expect(r.status === 200 && r.body.text.length).toBe(4000);
    expect(r.status === 200 && r.body.truncated).toBe(true);
  });

  it('never reads more than the cap into memory', async () => {
    const { deps } = await setup({ scope: GRANTED }, doc('x'.repeat(MAX_DOC_CHARS + 5000)));
    const r = await handleDoc(deps, { userId: 'u1', body: { fileId: ID }, maxChars: MAX_DOC_CHARS * 2 });
    expect(r.status === 200 && r.body.text.length).toBeLessThanOrEqual(MAX_DOC_CHARS);
  });

  it('rejects a missing or malformed file id without calling Google', async () => {
    const { deps, f } = await setup({ scope: GRANTED }, doc('x'));
    for (const body of [null, {}, { fileId: 5 }, { fileId: 'short' }, { fileId: '../../etc/passwd' }, { fileId: `${ID}?alt=media` }]) {
      expect((await handleDoc(deps, { userId: 'u1', body, maxChars: 4000 })).status).toBe(400);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('answers a file that was not picked or is not a Doc with a plain message, not a reconnect', async () => {
    const { deps } = await setup({ scope: GRANTED }, () => json({}, 404));
    const r = await handleDoc(deps, { userId: 'u1', body: { fileId: ID }, maxChars: 4000 });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('asks to reconnect before the Drive scope, without calling Google', async () => {
    const { deps, f } = await setup({ scope: CAL }, doc('x'));
    expect((await handleDoc(deps, { userId: 'u1', body: { fileId: ID }, maxChars: 4000 })).status).toBe(409);
    expect(f).not.toHaveBeenCalled();
  });
});
