/**
 * POST /api/nudges/dispatch (Header: x-nudge-cron: <secret>)
 *
 * Called every minute by the Supabase cron scheduler. Claims a batch of due nudges,
 * sends them via web push, and marks them sent. Must complete within 2 seconds.
 * Returns 202 on success (even if no nudges were sent), or 401 if the secret is
 * wrong, or 503 if the store or web-push is unavailable.
 */
import webpush from 'web-push';
import { handleDispatch } from '../../utils/nudges';
import { createSupabaseDispatchStore, createServiceClient } from '../../utils/nudges';
import { purgeDueDeletions, createSupabasePrivacyStore } from '../../utils/privacy';

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event);
  const vapidPrivateKey = String(cfg.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY || '');
  const vapidPublicKey = String(cfg.public.vapidPublicKey || process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY || '');
  const vapidSubject = String(cfg.vapidSubject || process.env.VAPID_SUBJECT || '');
  const nudgeCronSecret = String(cfg.nudgeCronSecret || process.env.NUDGE_CRON_SECRET || '');
  const serviceRoleKey = String(cfg.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabaseUrl = String(cfg.public.supabaseUrl || '');

  if (!vapidPrivateKey || !vapidPublicKey || !vapidSubject) {
    // Checked before claiming, so unconfigured pushes are never marked sent and lost.
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'Web push is not configured.' };
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const secret = getHeader(event, 'x-nudge-cron');
  const store = createSupabaseDispatchStore(createServiceClient(supabaseUrl, serviceRoleKey));
  const result = await handleDispatch(
    {
      store,
      send: (sub, payload, ttl) => webpush.sendNotification(sub, payload, { TTL: ttl }),
      nudgeCronSecret,
    },
    { secret },
  );
  // The same every-minute call also purges accounts whose 7-day delete-everything window is up (rare, so it adds no cost most minutes).
  if (result.status === 202) {
    try { await purgeDueDeletions({ store: createSupabasePrivacyStore(createServiceClient(supabaseUrl, serviceRoleKey)) }); } catch { /* retried next minute */ }
  }
  setResponseStatus(event, result.status);
  return result.body;
});
