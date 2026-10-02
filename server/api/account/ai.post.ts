/**
 * POST /api/account/ai  (Authorization: Bearer <supabase access token>)
 * Body: { enabled: boolean }
 *
 * Turns AI on or off for the signed-in user, server-side, so every device obeys it.
 */
import { handleSetAi } from '../../utils/privacy';
import { privacyStore } from '../../utils/privacy-context';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const s = privacyStore(event);
  if (!s.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'Could not save that just now. Please try again in a moment.' };
  }
  const body = await readBody(event).catch(() => null);
  const result = await handleSetAi({ store: s.store }, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
