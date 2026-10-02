/**
 * GET /mcp: this server does not stream server-initiated messages, so the spec's answer is 405.
 * (Anyone without a token still gets the 401 first, so a client that probes learns where to sign in.)
 */
import { connectorContext, requireAssistant } from '../utils/oauth-context';

export default defineEventHandler(async (event) => {
  const c = connectorContext(event);
  if (c.ok) await requireAssistant(event, c.ctx);
  setResponseHeader(event, 'Allow', 'POST');
  setResponseStatus(event, 405);
  return '';
});
