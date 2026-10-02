/**
 * GET /api/google/tasks  (Authorization: Bearer <supabase access token>)
 * The user's open Google Tasks, read-only: { ok, tasks: [{ id, title, notes, due }] }. Nothing is saved
 * here and no Google token reaches the browser. The logic is in server/utils/google-import.ts.
 */
import { gcalContext, requireUser } from '../../utils/gcal-context';
import { handleTasks } from '../../utils/google-import';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const c = gcalContext(event);
  if (!c.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'not_configured', message: 'Google is not set up on this server.' };
  }
  const result = await handleTasks({ vault: c.ctx.vault, fetch, clientId: c.ctx.clientId, clientSecret: c.ctx.clientSecret }, { userId });
  setResponseStatus(event, result.status);
  return result.body;
});
