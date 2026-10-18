/**
 * GET /api/github/digest  (Authorization: Bearer <supabase access token>)
 * What needs the person on GitHub: pull requests waiting on their review, their own open pull
 * requests with CI and review state, and issues assigned to them. Read with the stored token.
 */
import { handleDigest } from '../../utils/github';
import { requireUser } from '../../utils/gcal-context';
import { serviceVault } from '../../utils/integrations-context';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = serviceVault(event);
  if (!c.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'not_configured' };
  }
  const r = await handleDigest({ vault: c.vault, fetch }, uid);
  setResponseStatus(event, r.status);
  return r.body;
});
