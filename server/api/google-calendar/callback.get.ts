/**
 * GET /api/google-calendar/callback?code=...&state=...
 * Google redirects here. The signed `state` says which user started the flow;
 * we exchange the code on the server, store the tokens encrypted, and redirect
 * back to the app with NO tokens in the URL (only ?gcal_connected=1 or ?gcal_error=...).
 */
import { exchangeCode } from '../../utils/google-oauth';
import { verifyState } from '../../utils/google-tokens';
import { CALLBACK_PATH, gcalContext, requestOrigin } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string | undefined;
  const error = query.error as string | undefined;
  const fail = (reason: string) => sendRedirect(event, `/?gcal_error=${encodeURIComponent(reason)}`);

  if (error) return fail(error);
  const c = gcalContext(event);
  if (!c.ok) return fail('no_credentials');

  const uid = verifyState(c.ctx.key, query.state as string | undefined);
  if (!uid) return fail('bad_state');
  if (!code) return fail('no_code');

  try {
    const result = await exchangeCode({
      fetch,
      clientId: c.ctx.clientId,
      clientSecret: c.ctx.clientSecret,
      redirectUri: `${requestOrigin(event)}${CALLBACK_PATH}`,
      code,
    });
    if (!result.ok) {
      console.error('Google token exchange failed:', result.reason);
      return fail(result.reason);
    }
    await c.ctx.vault.save(uid, result.tokens);
    return sendRedirect(event, '/?gcal_connected=1');
  } catch (e) {
    console.error('OAuth callback error:', e);
    return fail('callback_failed');
  }
});
