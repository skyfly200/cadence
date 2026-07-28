import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/google-calendar/refresh
 * Refreshes an expired access token using the refresh_token (sent from client).
 * Uses env vars for client_id and client_secret.
 */
export async function POST(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google credentials not configured' }, { status: 400 });
  }

  try {
    const { refresh_token } = await req.json();
    if (!refresh_token) {
      return NextResponse.json({ error: 'refresh_token required' }, { status: 400 });
    }

    const r = await fetch('https://accounts.google.com/o/oauth2/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ error: 'Token refresh failed', details: err }, { status: 400 });
    }

    const data = await r.json();
    return NextResponse.json({ access_token: data.access_token, expires_in: data.expires_in });
  } catch (e) {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
