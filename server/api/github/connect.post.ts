/**
 * POST /api/github/connect  { token }  (Authorization: Bearer <supabase access token>)
 * Checks the token with GitHub and stores it encrypted on the server. Returns { ok, login };
 * the token never comes back.
 */
import { handleConnect } from '../../utils/github';
import { requireUser } from '../../utils/gcal-context';
import { serviceVault } from '../../utils/integrations-context';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = serviceVault(event);
  if (!c.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'not_configured', missing: c.missing };
  }
  const r = await handleConnect({ vault: c.vault, fetch }, { userId: uid, body: await readBody(event).catch(() => null) });
  setResponseStatus(event, r.status);
  return r.body;
});
