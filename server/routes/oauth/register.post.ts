/** POST /oauth/register: dynamic client registration (RFC 7591), JSON in and out. */
import { handleRegister } from '../../utils/oauth';
import { connectorContext } from '../../utils/oauth-context';

export default defineEventHandler(async (event) => {
  const c = connectorContext(event);
  if (!c.ok) { setResponseStatus(event, 503); return { error: 'server_error' }; }
  const r = await handleRegister(c.ctx.oauth, await readBody(event).catch(() => null));
  setResponseStatus(event, r.status);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return r.body;
});
