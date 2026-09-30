/**
 * GET /api/google-calendar/status  (Authorization: Bearer <supabase access token>)
 * The only things the browser learns about the connection: is it set up on the
 * server, is it connected, and which account.
 */
import { gcalContext, requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = gcalContext(event);
  if (!c.ok) return { configured: false, connected: false, email: null };
  const s = await c.ctx.vault.status(uid);
  return { configured: true, connected: s.connected, email: s.email };
});
