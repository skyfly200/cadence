/**
 * POST /api/push/subscribe (Authorization: Bearer <supabase access token>)
 * Body: { endpoint, keys: { p256dh, auth } } (PushSubscription.toJSON())
 *
 * Saves the push subscription for the authenticated user. Returns 200 on success,
 * or 400 if the subscription is invalid, or 503 if the store is unavailable.
 */
import { handleSubscribe } from '../../utils/push';
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
  const result = await handleSubscribe({ store }, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
