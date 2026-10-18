/**
 * POST /api/ai/discuss  (Authorization: Bearer <supabase access token>)
 * Body: { messages: { role: 'user' | 'assistant', text: string }[], context?, layers?, lookups? }
 *
 * Answers the next turn of a Discuss conversation, or asks the browser to look something up.
 * The browser chooses the context (Private items already dropped). Nothing is stored or logged.
 * The logic is in server/utils/discuss.ts.
 */
import { aiDeps } from '../../utils/ai-context';
import { handleDiscuss } from '../../utils/discuss';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const d = aiDeps(event);
  if (!d.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'The AI is not available right now.' };
  }
  const body = await readBody(event).catch(() => null);
  const result = await handleDiscuss({ ai: d.deps }, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
