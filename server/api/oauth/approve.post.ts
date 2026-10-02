/**
 * POST /api/oauth/approve (Authorization: Bearer <supabase access token>)
 * Body: { request: <the authorize query values>, scope: 'read' | 'read write' }
 * The signed-in user said yes on the consent page. Answers with the address to send the browser to.
 */
import { handleApprove } from '../../utils/oauth';
import { connectorContext } from '../../utils/oauth-context';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const c = connectorContext(event);
  if (!c.ok) { setResponseStatus(event, 503); return { error: 'server_error' }; }
  const body = (await readBody(event).catch(() => null)) as { request?: unknown; scope?: unknown } | null;
  const r = await handleApprove(c.ctx.oauth, { userId, request: (body?.request ?? {}) as Record<string, unknown>, grantScope: body?.scope });
  setResponseStatus(event, r.status);
  return r.body;
});
