/**
 * GET /api/google-calendar/events?timeMin=<ISO>&timeMax=<ISO>  (Authorization: Bearer ...)
 * Fetches the user's events using the stored tokens (refreshing as needed) and
 * returns only { summary, start, end, colorId } per event. The browser never
 * sees a Google token.
 */
import { getFreshAccessToken, listEvents, validateRange } from '../../utils/google-oauth';
import { gcalContext, requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = gcalContext(event);
  if (!c.ok) {
    setResponseStatus(event, 503);
    return { error: 'not_configured' };
  }
  const q = getQuery(event);
  const range = validateRange(q.timeMin, q.timeMax);
  if (!range.ok) {
    setResponseStatus(event, 400);
    return { error: 'bad_range' };
  }

  const access = await getFreshAccessToken({
    vault: c.ctx.vault, userId: uid, fetch, clientId: c.ctx.clientId, clientSecret: c.ctx.clientSecret,
  });
  if (!access.ok) {
    // not_connected and reauth both mean "connect again"; refresh_failed is a transient upstream problem.
    setResponseStatus(event, access.reason === 'refresh_failed' ? 502 : 409);
    return { error: access.reason };
  }
  try {
    const items = await listEvents({ fetch, accessToken: access.accessToken, timeMin: range.timeMin, timeMax: range.timeMax });
    return { items };
  } catch (e) {
    console.error('calendar list failed', e);
    setResponseStatus(event, 502);
    return { error: 'calendar_failed' };
  }
});
