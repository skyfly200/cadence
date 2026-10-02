/** POST /api/oauth/revoke (Authorization: Bearer <supabase access token>) Body: { id }. Revokes one of the user's connections. */
import { revokeConnection } from '../../utils/oauth';
import { connectorContext } from '../../utils/oauth-context';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const c = connectorContext(event);
  if (!c.ok) { setResponseStatus(event, 503); return { error: 'server_error' }; }
  const r = await revokeConnection(c.ctx.oauth, userId, await readBody(event).catch(() => null));
  setResponseStatus(event, r.status);
  return r.body;
});
