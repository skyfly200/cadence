/**
 * POST /api/github/disconnect  (Authorization: Bearer <supabase access token>)
 * Deletes the stored token. The person deletes the token itself on GitHub.
 */
import { handleDisconnect } from '../../utils/github';
import { requireUser } from '../../utils/gcal-context';
import { serviceVault } from '../../utils/integrations-context';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = serviceVault(event);
  if (!c.ok) return { ok: true }; // nothing can be stored without the server config
  return handleDisconnect({ vault: c.vault }, uid);
});
