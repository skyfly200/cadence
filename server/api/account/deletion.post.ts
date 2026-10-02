/**
 * POST /api/account/deletion  (Authorization: Bearer <supabase access token>)
 * Body: { action: 'request' | 'cancel' | 'status' }
 *
 * Delete everything with a 7-day undo window. The data is removed after the window
 * (by the dispatch route); the sign-in account is kept.
 */
import { handleDeletion } from '../../utils/privacy';
import { privacyStore } from '../../utils/privacy-context';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const s = privacyStore(event);
  if (!s.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'Could not do that just now. Please try again in a moment.' };
  }
  const body = await readBody(event).catch(() => null);
  const result = await handleDeletion({ store: s.store }, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
