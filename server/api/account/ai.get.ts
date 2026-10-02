/**
 * GET /api/account/ai  (Authorization: Bearer <supabase access token>)
 *
 * The signed-in user's server-side AI switch, so the privacy page shows what the
 * server will actually enforce rather than this device's copy.
 */
import { handleGetAi } from '../../utils/privacy';
import { privacyStore } from '../../utils/privacy-context';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const s = privacyStore(event);
  if (!s.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'Could not read that just now. Please try again in a moment.' };
  }
  const result = await handleGetAi({ store: s.store }, { userId });
  setResponseStatus(event, result.status);
  return result.body;
});
