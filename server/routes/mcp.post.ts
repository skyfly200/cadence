/**
 * POST /mcp: the assistant connector endpoint (MCP over Streamable HTTP, plain JSON replies).
 * Without a valid bearer token it answers 401 with the WWW-Authenticate header that starts the
 * sign-in. Thin: the protocol and the tools live in server/utils/mcp.ts.
 */
import { handleMcp } from '../utils/mcp';
import { connectorContext, requireAssistant } from '../utils/oauth-context';

export default defineEventHandler(async (event) => {
  const c = connectorContext(event);
  if (!c.ok) {
    setResponseStatus(event, 503);
    return { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Not available just now.' } };
  }
  const auth = await requireAssistant(event, c.ctx);
  const body = await readBody(event).catch(() => undefined);
  const r = await handleMcp(c.ctx.mcp, { auth, body });
  setResponseStatus(event, r.status);
  if (r.status === 202) return '';
  return r.body;
});
