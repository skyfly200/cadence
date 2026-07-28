import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, upsertGoogleCredentials, parseIdToken, getGoogleCredentials } from '@/lib/google-calendar';

/**
 * GET /api/google-calendar/callback?code=...
 * Handles the Google OAuth redirect. Exchanges the code for tokens,
 * saves them to the DB, then redirects back to the app.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/?gcal_error=${encodeURIComponent(error)}`, req.headers.get('origin') ?? 'http://localhost:3000')
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/?gcal_error=no_code', req.headers.get('origin') ?? 'http://localhost:3000')
    );
  }

  try {
    const creds = await getGoogleCredentials();
    if (!creds?.clientId || !creds?.clientSecret) {
      return NextResponse.redirect(
        new URL('/?gcal_error=no_credentials', req.headers.get('origin') ?? 'http://localhost:3000')
      );
    }

    const origin = req.headers.get('origin') ?? 'http://localhost:3000';
    const redirectUri = `${origin}/api/google-calendar/callback`;

    const tokens = await exchangeCode(creds.clientId, creds.clientSecret, code, redirectUri);

    // Parse email from id_token if available
    let email: string | undefined;
    if (tokens.id_token) {
      const parsed = parseIdToken(tokens.id_token);
      if (parsed) email = parsed.email;
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await upsertGoogleCredentials({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
      calendarEmail: email,
      connected: true,
    });

    return NextResponse.redirect(new URL('/?gcal=connected', origin));
  } catch (e) {
    console.error('OAuth callback error:', e);
    return NextResponse.redirect(
      new URL(`/?gcal_error=token_exchange_failed`, req.headers.get('origin') ?? 'http://localhost:3000')
    );
  }
}
