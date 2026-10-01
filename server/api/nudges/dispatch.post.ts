/**
 * POST /api/nudges/dispatch (Header: x-nudge-cron: <secret>)
 *
 * Called every minute by the Supabase cron scheduler. Claims a batch of due nudges,
 * sends them via web push, and marks them sent. Must complete within 2 seconds.
 * Returns 202 on success (even if no nudges were sent), or 401 if the secret is
 * wrong, or 503 if the store or web-push is unavailable.
 */
import { handleDispatch } from '../../utils/nudges';
import { createSupabaseDispatchStore, createServiceClient } from '../../utils/nudges';

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event);
  const vapidPrivateKey = String(cfg.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY || '');
  const vapidSubject = String(cfg.vapidSubject || process.env.VAPID_SUBJECT || '');
  const nudgeCronSecret = String(cfg.nudgeCronSecret || process.env.NUDGE_CRON_SECRET || '');
  const serviceRoleKey = String(cfg.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const supabaseUrl = String(cfg.public.supabaseUrl || '');

  const secret = getHeader(event, 'x-nudge-cron');
  const store = createSupabaseDispatchStore(createServiceClient(supabaseUrl, serviceRoleKey));
  const result = await handleDispatch(
    {
      store,
      vapidPrivateKey,
      vapidSubject,
      nudgeCronSecret,
    },
    { secret },
  );
  setResponseStatus(event, result.status);
  return result.body;
});
