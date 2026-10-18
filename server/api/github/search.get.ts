/**
 * GET /api/github/search?q=<words>  (Authorization: Bearer <supabase access token>)
 * Issues and pull requests the person is involved in that match the words, newest first.
 */
import { handleSearch } from '../../utils/github';
import { requireUser } from '../../utils/gcal-context';
import { serviceVault } from '../../utils/integrations-context';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = serviceVault(event);
  if (!c.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'not_configured' };
  }
  const r = await handleSearch({ vault: c.vault, fetch }, { userId: uid, query: getQuery(event).q });
  setResponseStatus(event, r.status);
  return r.body;
});
