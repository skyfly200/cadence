/**
 * POST /api/account/purge (Header: x-nudge-cron: <secret>)
 *
 * Called every minute by the Supabase cron scheduler (supabase/drafts/0006_deletion_hold.sql).
 * Purges, in a small bounded batch, the accounts whose 7-day "delete everything" window is
 * up. It is its own route so it neither shares the nudge route's 2 second budget nor needs
 * web push configured. Uses the same shared cron secret as the nudge dispatch.
 */
import { handlePurgeRun } from '../../utils/privacy';
import { privacyStore } from '../../utils/privacy-context';

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event);
  const s = privacyStore(event);
  if (!s.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'Could not purge just now.' };
  }
  const cronSecret = String(cfg.nudgeCronSecret || process.env.NUDGE_CRON_SECRET || '');
  const result = await handlePurgeRun({ store: s.store, cronSecret }, { secret: getHeader(event, 'x-nudge-cron') ?? null });
  setResponseStatus(event, result.status);
  return result.body;
});
