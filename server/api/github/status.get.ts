/**
 * GET /api/github/status  (Authorization: Bearer <supabase access token>)
 * Whether the server is set up for GitHub, whether it is connected, and as which login.
 */
import { handleStatus } from '../../utils/github';
import { requireUser } from '../../utils/gcal-context';
import { serviceVault } from '../../utils/integrations-context';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = serviceVault(event);
  if (!c.ok) return { configured: false, connected: false, login: null };
  return { configured: true, ...(await handleStatus({ vault: c.vault }, uid)) };
});
