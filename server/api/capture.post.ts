/**
 * POST /api/capture  (Authorization: Bearer <supabase access token>)
 * Body: { text: string, idempotencyKey?: string }
 *
 * Saves the raw text as an Idea plus a 'captured' Occurrence and answers with a
 * short, plain, spoken-friendly reply. No classification and no AI here. The
 * server decides the source: this browser route always records 'app' (assistants
 * will come through their own routes later). The text is data, never instructions,
 * and is never logged.
 */
import { handleCapture } from '../utils/capture';
import { captureStore } from '../utils/capture-context';
import { requireUser } from '../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const s = captureStore(event);
  if (!s.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'unavailable', message: 'Could not save that just now. Please try again in a moment.' };
  }
  const body = await readBody(event).catch(() => null);
  const result = await handleCapture({ store: s.store }, { userId, source: 'app', body });
  setResponseStatus(event, result.status);
  if (result.status === 429) setResponseHeader(event, 'Retry-After', result.body.retryAfterSeconds ?? 30);
  return result.body;
});
