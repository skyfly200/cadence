import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  buildAuthUrl, emailFromIdToken, exchangeCode, getFreshAccessToken, listEvents, revokeToken, validateRange,
  GOOGLE_TOKEN_URL,
} from './google-oauth';
import { createMemoryTokenStore, createTokenVault, type GoogleTokens } from './google-tokens';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fakeFetch = (handler: (url: string, init?: RequestInit) => Response | Promise<Response>) =>
  vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => handler(String(url), init)) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
const idToken = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
const form = (init?: RequestInit) => Object.fromEntries(new URLSearchParams(String(init?.body)));

const NOW = 1_800_000_000_000;
const stored: GoogleTokens = { accessToken: 'old-access', refreshToken: 'the-refresh', expiresAt: NOW + 3_600_000, email: 'sky@example.com' };
const setup = async (t: GoogleTokens = stored) => {
  const store = createMemoryTokenStore();
  const vault = createTokenVault(store, randomBytes(32));
  await vault.save('u1', t);
  return { store, vault };
};

describe('buildAuthUrl', () => {
  it('asks for offline access with consent and carries the signed state', () => {
    const url = new URL(buildAuthUrl({ clientId: 'cid', redirectUri: 'https://x.test/api/google-calendar/callback', state: 'STATE' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('STATE');
    expect(url.searchParams.get('redirect_uri')).toBe('https://x.test/api/google-calendar/callback');
    expect(url.searchParams.get('scope')).toContain('calendar.readonly');
  });
});

describe('emailFromIdToken', () => {
  it('reads the email claim', () => expect(emailFromIdToken(idToken({ email: 'a@b.co' }))).toBe('a@b.co'));
  it('returns empty for missing or malformed tokens', () => {
    expect(emailFromIdToken(undefined)).toBe('');
    expect(emailFromIdToken('nope')).toBe('');
    expect(emailFromIdToken('a.!!!.c')).toBe('');
  });
});

describe('exchangeCode', () => {
  const base = { clientId: 'cid', clientSecret: 'sec', redirectUri: 'https://x.test/cb', code: 'CODE', now: NOW };

  it('returns tokens with an absolute expiry and the email', async () => {
    const f = fakeFetch(() => json({ access_token: 'A', refresh_token: 'R', expires_in: 1800, id_token: idToken({ email: 'me@x.test' }) }));
    const r = await exchangeCode({ ...base, fetch: f });
    expect(r).toEqual({ ok: true, tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: NOW + 1_800_000, email: 'me@x.test' } });
    expect(f.mock.calls[0]![0]).toBe(GOOGLE_TOKEN_URL);
    expect(form(f.mock.calls[0]![1])).toMatchObject({ grant_type: 'authorization_code', code: 'CODE', client_secret: 'sec' });
  });

  it("surfaces Google's error code (e.g. invalid_grant, redirect_uri_mismatch)", async () => {
    expect(await exchangeCode({ ...base, fetch: fakeFetch(() => json({ error: 'invalid_grant' }, 400)) })).toEqual({ ok: false, reason: 'invalid_grant' });
    expect(await exchangeCode({ ...base, fetch: fakeFetch(() => new Response('<html>', { status: 500 })) })).toEqual({ ok: false, reason: 'token_exchange_failed' });
  });

  it('refuses a response without a refresh token (we could not stay connected)', async () => {
    const r = await exchangeCode({ ...base, fetch: fakeFetch(() => json({ access_token: 'A', expires_in: 3600 })) });
    expect(r).toEqual({ ok: false, reason: 'no_refresh_token' });
  });
});

describe('getFreshAccessToken', () => {
  const opts = (vault: ReturnType<typeof createTokenVault>, f: typeof fetch) => ({ vault, userId: 'u1', fetch: f, clientId: 'cid', clientSecret: 'sec', now: NOW });

  it('returns the stored token without any network call while it is fresh', async () => {
    const { vault } = await setup();
    const f = fakeFetch(() => json({}));
    expect(await getFreshAccessToken(opts(vault, f))).toEqual({ ok: true, accessToken: 'old-access' });
    expect(f).not.toHaveBeenCalled();
  });

  it('reports not_connected when the user has no tokens', async () => {
    const { vault } = await setup();
    expect(await getFreshAccessToken({ ...opts(vault, fakeFetch(() => json({}))), userId: 'nobody' })).toEqual({ ok: false, reason: 'not_connected' });
  });

  it('refreshes an expired token, re-encrypts it, and keeps the refresh token', async () => {
    const { vault, store } = await setup({ ...stored, expiresAt: NOW + 30_000 }); // inside the 60 s safety margin
    const f = fakeFetch(() => json({ access_token: 'new-access', expires_in: 3600 }));
    expect(await getFreshAccessToken(opts(vault, f))).toEqual({ ok: true, accessToken: 'new-access' });
    expect(form(f.mock.calls[0]![1])).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'the-refresh' });
    const after = await vault.load('u1');
    expect(after).toMatchObject({ accessToken: 'new-access', refreshToken: 'the-refresh', expiresAt: NOW + 3_600_000, email: 'sky@example.com' });
    expect(JSON.stringify(store.rows.get('u1'))).not.toContain('new-access'); // still encrypted at rest
  });

  it('adopts a rotated refresh token when Google sends one', async () => {
    const { vault } = await setup({ ...stored, expiresAt: NOW - 1 });
    await getFreshAccessToken(opts(vault, fakeFetch(() => json({ access_token: 'n', refresh_token: 'rotated', expires_in: 60 }))));
    expect((await vault.load('u1'))!.refreshToken).toBe('rotated');
  });

  it('deletes the stored tokens and asks to reconnect when Google says invalid_grant', async () => {
    const { vault, store } = await setup({ ...stored, expiresAt: NOW - 1 });
    expect(await getFreshAccessToken(opts(vault, fakeFetch(() => json({ error: 'invalid_grant' }, 400))))).toEqual({ ok: false, reason: 'reauth' });
    expect(store.rows.size).toBe(0);
  });

  it('keeps the tokens on a transient failure', async () => {
    const { vault, store } = await setup({ ...stored, expiresAt: NOW - 1 });
    expect(await getFreshAccessToken(opts(vault, fakeFetch(() => json({ error: 'backend_error' }, 503))))).toEqual({ ok: false, reason: 'refresh_failed' });
    expect(store.rows.size).toBe(1);
  });
});

describe('listEvents', () => {
  it('returns only summary, start, end and colour; nothing else leaves the server', async () => {
    const f = fakeFetch(() => json({
      items: [
        { id: 'secret-id', summary: 'Standup', start: { dateTime: '2026-09-30T09:00:00Z' }, end: { dateTime: '2026-09-30T09:15:00Z' }, colorId: '5', attendees: [{ email: 'x@y.z' }], hangoutLink: 'https://meet' },
        { summary: 'Holiday', start: { date: '2026-09-30' }, end: { date: '2026-10-01' } },
        { start: { dateTime: '2026-09-30T10:00:00Z' }, end: { dateTime: '2026-09-30T11:00:00Z' } },
      ],
    }));
    const items = await listEvents({ fetch: f, accessToken: 'tok', timeMin: '2026-09-30T00:00:00.000Z', timeMax: '2026-09-30T23:59:59.000Z' });
    expect(items).toEqual([
      { summary: 'Standup', start: '2026-09-30T09:00:00Z', end: '2026-09-30T09:15:00Z', colorId: '5' },
      { summary: 'Holiday', start: null, end: null, colorId: null },
      { summary: '(No title)', start: '2026-09-30T10:00:00Z', end: '2026-09-30T11:00:00Z', colorId: null },
    ]);
    expect(JSON.stringify(items)).not.toMatch(/secret-id|attendees|hangout|x@y\.z/);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain('/calendars/primary/events?');
    expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('throws on an upstream error', async () => {
    await expect(listEvents({ fetch: fakeFetch(() => json({}, 401)), accessToken: 't', timeMin: 'a', timeMax: 'b' })).rejects.toThrow(/401/);
  });
});

describe('validateRange', () => {
  it('accepts a one-day window and normalises it to ISO', () => {
    expect(validateRange('2026-09-30T00:00:00Z', '2026-09-30T23:59:59Z')).toEqual({ ok: true, timeMin: '2026-09-30T00:00:00.000Z', timeMax: '2026-09-30T23:59:59.000Z' });
  });
  it('rejects non-strings, garbage, reversed and over-48-hour windows', () => {
    expect(validateRange(undefined, '2026-09-30T00:00:00Z')).toEqual({ ok: false });
    expect(validateRange('nope', '2026-09-30T00:00:00Z')).toEqual({ ok: false });
    expect(validateRange('2026-09-30T10:00:00Z', '2026-09-30T09:00:00Z')).toEqual({ ok: false });
    expect(validateRange('2026-09-30T00:00:00Z', '2026-10-03T00:00:00Z')).toEqual({ ok: false });
  });
});

describe('revokeToken', () => {
  it('posts the token to Google and never throws', async () => {
    const f = fakeFetch(() => json({}));
    await revokeToken(f, 'the-refresh');
    expect(form(f.mock.calls[0]![1])).toEqual({ token: 'the-refresh' });
    await expect(revokeToken(fakeFetch(() => { throw new Error('offline'); }), 'x')).resolves.toBeUndefined();
  });
});
