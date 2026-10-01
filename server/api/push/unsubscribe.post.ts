/**
 * POST /api/push/unsubscribe (Authorization: Bearer <supabase access token>)
 * Body: { endpoint }
 *
 * Removes a push subscription. Returns 200 on success, or 400 if the endpoint is
 * missing, or 503 if the store is unavailable.
 */
import { handleUnsubscribe } from '../../utils/push';
import { pushContext } from '../../utils/push-context';
import { createSupabasePushStore } from '../../utils/push';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const ctx = pushContext(event);
  if (!ctx.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'Push is not configured.' };
  }
  const store = createSupabasePushStore(ctx.supabase);
  const body = await readBody(event).catch(() => null);
  const result = await handleUnsubscribe({ store }, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
