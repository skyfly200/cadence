export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig();
  const clientId = cfg.googleClientId;
  const clientSecret = cfg.googleClientSecret;

  if (!clientId || !clientSecret) {
    setResponseStatus(event, 400);
    return { error: 'Google credentials not configured' };
  }

  try {
    const { refresh_token } = await readBody(event);
    if (!refresh_token) {
      setResponseStatus(event, 400);
      return { error: 'refresh_token required' };
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
      setResponseStatus(event, 400);
      return { error: 'Token refresh failed', details: err };
    }

    const data = await r.json();
    return { access_token: data.access_token, expires_in: data.expires_in };
  } catch {
    setResponseStatus(event, 500);
    return { error: 'Refresh failed' };
  }
});
