/**
 * POST /api/ai/heap  (Authorization: Bearer <supabase access token>)
 * Body: { ids: string[], tags?: string[] }
 *
 * Answers { ok: true, items: [{ id, category, minutes, requires }], first: string[] }: advice only, nothing is
 * written. The logic is in server/utils/heap-ai.ts; an optional decision engine (TRIAGE_BASE_URL) is in triage.ts.
 */
import { aiDeps, aiServiceClient } from '../../utils/ai-context';
import { requireUser } from '../../utils/gcal-context';
import { createSupabaseHeapLookup, handleHeap } from '../../utils/heap-ai';
import { triageFromEnv } from '../../utils/triage';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const d = aiDeps(event, 'heap');
  if (!d.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'The AI is not available right now.' };
  }
  const body = await readBody(event).catch(() => null);
  const result = await handleHeap({ ai: d.deps, nodes: createSupabaseHeapLookup(aiServiceClient(event)), triage: triageFromEnv(process.env) }, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
