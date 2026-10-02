/**
 * POST /api/ai/extract  (Authorization: Bearer <supabase access token>)
 * Body: { text?: string, focusIds?: string[] }
 *
 * Answers { ok: true, nodes, links }: proposals only, nothing is written. The logic is in
 * server/utils/extraction.ts.
 */
import { aiDeps, aiServiceClient } from '../../utils/ai-context';
import { createSupabaseExtractionStore, handleExtract } from '../../utils/extraction';
import { requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const d = aiDeps(event);
  if (!d.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'The AI is not available right now.' };
  }
  const body = await readBody(event).catch(() => null);
  const result = await handleExtract({ ai: d.deps, store: createSupabaseExtractionStore(aiServiceClient(event)) }, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
