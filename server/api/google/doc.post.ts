/**
 * POST /api/google/doc  (Authorization: Bearer <supabase access token>)
 * Body: { fileId: string }, the id of a Google Doc the user picked with the Google Picker.
 * Answers { ok, text, truncated }: the document's plain text, trimmed to what extraction accepts.
 * Read-only, nothing is saved, and no Google token reaches the browser. The logic is in
 * server/utils/google-import.ts.
 */
import { MAX_TEXT } from '../../utils/extraction';
import { gcalContext, requireUser } from '../../utils/gcal-context';
import { handleDoc } from '../../utils/google-import';

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const c = gcalContext(event);
  if (!c.ok) {
    setResponseStatus(event, 503);
    return { ok: false, error: 'not_configured', message: 'Google is not set up on this server.' };
  }
  const body = await readBody(event).catch(() => null);
  const result = await handleDoc(
    { vault: c.ctx.vault, fetch, clientId: c.ctx.clientId, clientSecret: c.ctx.clientSecret },
    { userId, body, maxChars: MAX_TEXT },
  );
  setResponseStatus(event, result.status);
  return result.body;
});
