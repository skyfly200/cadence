/**
 * POST /api/oauth/describe (Authorization: Bearer <supabase access token>)
 * Body: the authorize request's query values. Answers who is asking and for what, so the consent
 * page can show it. Creates nothing.
 */
import { describeRequest } from '../../utils/oauth';
import { connectorContext } from '../../utils/oauth-context';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  await requireUser(event);
  const c = connectorContext(event);
  if (!c.ok) { setResponseStatus(event, 503); return { error: 'server_error' }; }
  const r = await describeRequest(c.ctx.oauth, await readBody(event).catch(() => ({})));
  setResponseStatus(event, r.status);
  return r.body;
});
