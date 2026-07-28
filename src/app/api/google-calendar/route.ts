import { NextRequest, NextResponse } from 'next/server';
import { getGoogleCredentials, upsertGoogleCredentials, buildAuthUrl } from '@/lib/google-calendar';

/**
 * GET /api/google-calendar/status
 * Returns connection status and calendar email (if connected).
 * GET /api/google-calendar/auth-url
 * Returns the Google OAuth authorization URL.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode');

  // Return OAuth URL
  if (mode === 'auth-url') {
    const creds = await getGoogleCredentials();
    if (!creds?.clientId) {
      return NextResponse.json({ error: 'Google credentials not configured' }, { status: 400 });
    }
    const origin = req.headers.get('origin') ?? 'http://localhost:3000';
    const redirectUri = `${origin}/api/google-calendar/callback`;
    const url = buildAuthUrl(creds.clientId, redirectUri);
    return NextResponse.json({ url });
  }

  // Return connection status
  const creds = await getGoogleCredentials();
  return NextResponse.json({
    connected: creds?.connected ?? false,
    calendarEmail: creds?.calendarEmail ?? null,
    hasCredentials: !!creds?.clientId,
    lastSyncAt: creds?.lastSyncAt ?? null,
  });
}

/**
 * POST /api/google-calendar/credentials
 * Save Google OAuth client ID and client secret.
 */
export async function POST(req: NextRequest) {
  try {
    const { clientId, clientSecret } = await req.json();
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'clientId and clientSecret required' }, { status: 400 });
    }
    const existing = await getGoogleCredentials();
    await upsertGoogleCredentials({
      clientId,
      clientSecret,
      accessToken: existing?.accessToken,
      refreshToken: existing?.refreshToken,
      tokenExpiresAt: existing?.tokenExpiresAt,
      calendarEmail: existing?.calendarEmail,
      connected: existing?.connected,
      lastSyncAt: existing?.lastSyncAt,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
}

/**
 * DELETE /api/google-calendar/disconnect
 * Remove stored tokens and disconnect.
 */
export async function DELETE() {
  try {
    const existing = await getGoogleCredentials();
    if (!existing) {
      return NextResponse.json({ ok: true });
    }
    await upsertGoogleCredentials({
      clientId: existing.clientId,
      clientSecret: existing.clientSecret,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      calendarEmail: null,
      connected: false,
      lastSyncAt: null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
