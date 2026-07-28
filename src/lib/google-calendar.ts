/**
 * Google Calendar OAuth2 + Calendar API helpers.
 * Used only by server-side API routes (never imported on the client).
 */
import { db } from '@/lib/db';

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2';
const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

// Scopes needed: read/write calendar events, see email
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

/** Get the stored Google credentials (upsert singleton) */
export async function getGoogleCredentials() {
  return db.googleCalendarToken.findUnique({ where: { id: 'singleton' } });
}

/** Save / update credentials */
export async function upsertGoogleCredentials(data: {
  clientId: string;
  clientSecret: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  calendarEmail?: string | null;
  connected?: boolean;
  lastSyncAt?: Date | null;
}) {
  return db.googleCalendarToken.upsert({
    where: { id: 'singleton' },
    create: data,
    update: data,
  });
}

/** Build the OAuth authorization URL */
export function buildAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${GOOGLE_AUTH_BASE}/auth?${params}`;
}

/** Exchange authorization code for tokens */
export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number; id_token?: string }> {
  const r = await fetch(`${GOOGLE_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return r.json();
}

/** Refresh an expired access token */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const r = await fetch(`${GOOGLE_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return r.json();
}

/** Get a valid (possibly refreshed) access token */
export async function getValidAccessToken(): Promise<string | null> {
  const creds = await getGoogleCredentials();
  if (!creds?.clientId || !creds?.refreshToken) return null;

  const now = new Date();
  // If token is still valid for > 60 seconds, use it
  if (creds.tokenExpiresAt && creds.accessToken && creds.tokenExpiresAt.getTime() - now.getTime() > 60_000) {
    return creds.accessToken;
  }

  // Refresh
  try {
    const tokens = await refreshAccessToken(creds.clientId, creds.clientSecret, creds.refreshToken);
    const expiresAt = new Date(now.getTime() + tokens.expires_in * 1000);
    await upsertGoogleCredentials({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      accessToken: tokens.access_token,
      refreshToken: creds.refreshToken, // keep existing
      tokenExpiresAt: expiresAt,
      calendarEmail: creds.calendarEmail,
      connected: creds.connected,
      lastSyncAt: creds.lastSyncAt,
    });
    return tokens.access_token;
  } catch (e) {
    console.error('Failed to refresh Google token:', e);
    return null;
  }
}

/** Get user info (email) from ID token */
export function parseIdToken(idToken: string): { email: string } | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    // base64url decode the payload
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return { email: payload.email ?? payload.sub ?? 'unknown' };
  } catch {
    return null;
  }
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  htmlLink?: string;
  colorId?: string;
}

/** Fetch calendar events for a date range */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const r = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Calendar API failed: ${err}`);
  }
  const data = await r.json();
  return (data.items ?? []) as GoogleCalendarEvent[];
}

/** Google color IDs to our color tag mapping */
export const GOOGLE_COLOR_MAP: Record<string, string> = {
  '1': 'lavender',    // Lavender → purple-ish
  '2': 'slate',       // Sage → muted green
  '3': 'grape',       // Grape → purple
  '4': 'flamingo',    // Flamingo → pink
  '5': 'banana',      // Banana → amber
  '6': 'tangerine',   // Tangerine → orange
  '7': 'peacock',     // Peacock → teal
  '8': 'graphite',    // Graphite → slate
  '9': 'blueberry',   // Blueberry → use purple
  '10': 'basil',      // Basil → emerald
  '11': 'tomato',     // Tomato → rose
};
