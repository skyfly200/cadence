/** POST /oauth/token: authorization_code and refresh_token grants, form-urlencoded in (h3 parses it), JSON out. */
import { handleToken } from '../../utils/oauth';
import { connectorContext } from '../../utils/oauth-context';

export default defineEventHandler(async (event) => {
  const c = connectorContext(event);
  if (!c.ok) { setResponseStatus(event, 503); return { error: 'server_error' }; }
  const r = await handleToken(c.ctx.oauth, await readBody(event).catch(() => null));
  setResponseStatus(event, r.status);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  setResponseHeader(event, 'Pragma', 'no-cache');
  return r.body;
});
