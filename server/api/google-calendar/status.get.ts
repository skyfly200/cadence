/**
 * GET /api/google-calendar/status  (Authorization: Bearer <supabase access token>)
 * The only things the browser learns about the connection: is it set up on the
 * server, is it connected, which account, and whether the Tasks and Docs imports
 * are available (older connections need to reconnect to grant them).
 */
import { gcalContext, requireUser } from '../../utils/gcal-context';
import { handleCapabilities } from '../../utils/google-import';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = gcalContext(event);
  if (!c.ok) return { configured: false, connected: false, email: null, canImportTasks: false, canImportDocs: false };
  return { configured: true, ...(await handleCapabilities({ vault: c.ctx.vault }, uid)) };
});
