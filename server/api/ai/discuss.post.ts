/**
 * POST /api/ai/discuss  (Authorization: Bearer <supabase access token>)
 * Body: { messages: { role: 'user' | 'assistant', text: string }[] }
 *
 * Answers the next short question of a Discuss conversation. Nothing is stored or logged. The logic
 * is in server/utils/discuss.ts.
 */
import { aiDeps, aiServiceClient } from '../../utils/ai-context';
import { handleDiscuss } from '../../utils/discuss';
import { createSupabaseExtractionStore } from '../../utils/extraction';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const d = aiDeps(event);
  if (!d.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'The AI is not available right now.' };
  }
  const body = await readBody(event).catch(() => null);
  const result = await handleDiscuss({ ai: d.deps, store: createSupabaseExtractionStore(aiServiceClient(event)) }, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
