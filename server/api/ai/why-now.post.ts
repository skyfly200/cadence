/**
 * POST /api/ai/why-now  (Authorization: Bearer <supabase access token>)
 * Body: { title: string, template: string, private?: boolean }
 *
 * Answers { ok: true, line } where line is an AI-polished version of the Now card's
 * reason, or null when the caller should keep its own line. The logic is in
 * server/utils/why-now.ts.
 */
import { aiDeps } from '../../utils/ai-context';
import { requireUser } from '../../utils/gcal-context';
import { handleWhyNow } from '../../utils/why-now';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const d = aiDeps(event);
  if (!d.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'The AI is not available right now.' };
  }
  const body = await readBody(event).catch(() => null);
  const result = await handleWhyNow(d.deps, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
