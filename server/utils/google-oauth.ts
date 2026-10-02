/**
 * Google OAuth + Calendar logic, with `fetch` injected so it is testable
 * without a network. Nothing here returns a Google token to a caller that
 * would send it to the browser.
 */
import type { GoogleTokens, TokenVault } from './google-tokens';

type Fetch = typeof fetch;

// Google's documented endpoints. (The token endpoint the app used before, accounts.google.com/o/oauth2/v2/token, returns 404.)
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
/** Read-only access to the user's Google Tasks (for the import). */
export const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks.readonly';
/** Per-file access: only to the documents the user picks with the Google Picker (for the import). */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SCOPES = [CALENDAR_SCOPE, TASKS_SCOPE, DRIVE_FILE_SCOPE, 'https://www.googleapis.com/auth/userinfo.email'].join(' ');

export function buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // Google only returns a refresh token when consent is shown
    state: opts.state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export function emailFromIdToken(idToken: string | undefined): string {
  if (!idToken) return '';
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return '';
    const payload = JSON.parse(Buffer.from(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return typeof payload.email === 'string' ? payload.email : '';
  } catch {
    return '';
  }
}

async function googleError(res: Response, fallback: string): Promise<string> {
  try {
    const j = JSON.parse(await res.text());
    if (typeof j.error === 'string') return j.error;
  } catch { /* keep fallback */ }
  return fallback;
}

export type ExchangeResult = { ok: true; tokens: GoogleTokens } | { ok: false; reason: string };

/** Exchange the authorization code for tokens. The caller stores them; they are never sent to the browser. */
export async function exchangeCode(opts: {
  fetch: Fetch; clientId: string; clientSecret: string; redirectUri: string; code: string; now?: number;
}): Promise<ExchangeResult> {
  const res = await opts.fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      code: opts.code,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return { ok: false, reason: await googleError(res, 'token_exchange_failed') };
  const t = await res.json();
  if (!t.access_token) return { ok: false, reason: 'token_exchange_failed' };
  if (!t.refresh_token) return { ok: false, reason: 'no_refresh_token' };
  return {
    ok: true,
    tokens: {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: (opts.now ?? Date.now()) + (t.expires_in ?? 3600) * 1000,
      email: emailFromIdToken(t.id_token),
      // What the user actually granted (they can untick a permission on Google's screen).
      ...(typeof t.scope === 'string' ? { scope: t.scope } : {}),
    },
  };
}

export type AccessResult = { ok: true; accessToken: string } | { ok: false; reason: 'not_connected' | 'reauth' | 'refresh_failed' };

/**
 * Return a usable access token for the user, refreshing (and re-encrypting)
 * when it is about to expire. If Google says the grant is gone, the stored
 * tokens are deleted and the caller is told to reconnect.
 */
export async function getFreshAccessToken(opts: {
  vault: TokenVault; userId: string; fetch: Fetch; clientId: string; clientSecret: string; now?: number;
}): Promise<AccessResult> {
  const now = opts.now ?? Date.now();
  const tokens = await opts.vault.load(opts.userId);
  if (!tokens) return { ok: false, reason: 'not_connected' };
  if (tokens.expiresAt - 60_000 > now) return { ok: true, accessToken: tokens.accessToken };

  const res = await opts.fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    if ((await googleError(res, '')) === 'invalid_grant') {
      await opts.vault.remove(opts.userId);
      return { ok: false, reason: 'reauth' };
    }
    return { ok: false, reason: 'refresh_failed' };
  }
  const data = await res.json();
  if (!data.access_token) return { ok: false, reason: 'refresh_failed' };
  const next: GoogleTokens = {
    ...tokens,
    accessToken: data.access_token,
    // Google may or may not rotate the refresh token; keep the old one if not.
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  await opts.vault.save(opts.userId, next);
  return { ok: true, accessToken: next.accessToken };
}

export interface CalendarEvent {
  summary: string;
  start: string | null; // ISO dateTime, null for all-day events
  end: string | null;
  colorId: string | null;
}

/** Only these fields cross to the browser; no token, id or attendee data. */
export async function listEvents(opts: { fetch: Fetch; accessToken: string; timeMin: string; timeMax: string }): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const res = await opts.fetch(`${CALENDAR_EVENTS_URL}?${params}`, { headers: { Authorization: `Bearer ${opts.accessToken}` } });
  if (!res.ok) throw new Error(`Calendar API: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map((e: any) => ({
    summary: e.summary || '(No title)',
    start: e.start?.dateTime ?? null,
    end: e.end?.dateTime ?? null,
    colorId: e.colorId ?? null,
  }));
}

/** Validate the client-supplied window: valid ISO instants, ordered, and at most 48 hours. */
export function validateRange(timeMin: unknown, timeMax: unknown): { ok: true; timeMin: string; timeMax: string } | { ok: false } {
  if (typeof timeMin !== 'string' || typeof timeMax !== 'string') return { ok: false };
  const a = Date.parse(timeMin);
  const b = Date.parse(timeMax);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a || b - a > 48 * 3600 * 1000) return { ok: false };
  return { ok: true, timeMin: new Date(a).toISOString(), timeMax: new Date(b).toISOString() };
}

/** Best-effort revoke at Google when the user disconnects. Failure never blocks deleting our copy. */
export async function revokeToken(fetchFn: Fetch, token: string): Promise<void> {
  try {
    await fetchFn(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
  } catch { /* ignore */ }
}
