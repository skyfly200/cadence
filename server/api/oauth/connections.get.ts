/** GET /api/oauth/connections (Authorization: Bearer <supabase access token>): the signed-in user's connected assistants. */
import { listConnections } from '../../utils/oauth';
import { connectorContext } from '../../utils/oauth-context';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const c = connectorContext(event);
  if (!c.ok) { setResponseStatus(event, 503); return { error: 'server_error' }; }
  const r = await listConnections(c.ctx.oauth, userId);
  setResponseStatus(event, r.status);
  return r.body;
});
