/**
 * GET /api/google-calendar/callback?code=...
 * Handles Google OAuth redirect. Exchanges code for tokens via env vars.
 * Redirects back to app with tokens in URL fragment (client stores in localStorage).
 */
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig();
  const clientId = cfg.googleClientId;
  const clientSecret = cfg.googleClientSecret;

  const query = getQuery(event);
  const code = query.code as string | undefined;
  const error = query.error as string | undefined;

  const reqUrl = getRequestURL(event);
  const origin = `${reqUrl.protocol}//${reqUrl.host}`;

  if (error) return sendRedirect(event, `/?gcal_error=${encodeURIComponent(error)}`);
  if (!code) return sendRedirect(event, '/?gcal_error=no_code');
  if (!clientId || !clientSecret) return sendRedirect(event, '/?gcal_error=no_credentials');

  try {
    const redirectUri = `${origin}/api/google-calendar/callback`;
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
      console.error('Token exchange failed:', await tokenRes.text());
      return sendRedirect(event, '/?gcal_error=token_exchange_failed');
    }

    const tokens = await tokenRes.json();

    let email = '';
    if (tokens.id_token) {
      try {
        const parts = tokens.id_token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
          );
          email = payload.email ?? '';
        }
      } catch { /* ignore */ }
    }

    const tokenData = JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      calendar_email: email,
    });
    const fragment = Buffer.from(tokenData).toString('base64url');
    return sendRedirect(event, `/#gcal_tokens=${fragment}`);
  } catch (e) {
    console.error('OAuth callback error:', e);
    return sendRedirect(event, '/?gcal_error=callback_failed');
  }
});
