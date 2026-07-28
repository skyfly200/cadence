import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/google-calendar/callback?code=...
 * Handles Google OAuth redirect. Exchanges code for tokens via env vars.
 * Redirects back to app with tokens in URL fragment (client stores in localStorage).
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const origin = req.headers.get('origin') ?? 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(new URL(`/?gcal_error=${encodeURIComponent(error)}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?gcal_error=no_code', origin));
  }

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/?gcal_error=no_credentials', origin));
  }

  try {
    const redirectUri = `${origin}/api/google-calendar/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://accounts.google.com/o/oauth2/v2/token', {
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

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return NextResponse.redirect(new URL('/?gcal_error=token_exchange_failed', origin));
    }

    const tokens = await tokenRes.json();

    // Parse email from id_token
    let email = '';
    if (tokens.id_token) {
      try {
        const parts = tokens.id_token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
          email = payload.email ?? '';
        }
      } catch { /* ignore */ }
    }

    // Encode tokens as base64 for URL fragment
    const tokenData = JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      calendar_email: email,
    });
    const fragment = Buffer.from(tokenData).toString('base64url');

    return NextResponse.redirect(new URL(`/#gcal_tokens=${fragment}`, origin));
  } catch (e) {
    console.error('OAuth callback error:', e);
    return NextResponse.redirect(new URL('/?gcal_error=callback_failed', origin));
  }
}
