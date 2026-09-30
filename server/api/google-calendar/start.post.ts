/**
 * POST /api/google-calendar/start  (Authorization: Bearer <supabase access token>)
 * Returns { url }: the Google consent URL, carrying a short-lived signed `state`
 * that ties the redirect back to this user. No Google token is involved yet.
 */
import { buildAuthUrl } from '../../utils/google-oauth';
import { signState } from '../../utils/google-tokens';
import { CALLBACK_PATH, gcalContext, requestOrigin, requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = gcalContext(event);
  if (!c.ok) {
    setResponseStatus(event, 503);
    return { error: 'not_configured', missing: c.missing };
  }
  const redirectUri = `${requestOrigin(event)}${CALLBACK_PATH}`;
  return { url: buildAuthUrl({ clientId: c.ctx.clientId, redirectUri, state: signState(c.ctx.key, uid) }) };
});
