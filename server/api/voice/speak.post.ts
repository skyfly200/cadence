/**
 * POST /api/voice/speak  (Authorization: Bearer <supabase access token>)
 * Body: { text: string }  ->  { ok: true, audio: <base64 mp3>, mime } or { ok: false, error, message }
 * Opt-in cloud voice for nudges; 503 when the server has no voice service configured.
 * The logic is in server/utils/tts.ts.
 */
import { requireUser } from '../../utils/gcal-context';
import { createMemoryUsage, handleSpeak, ttsConfig } from '../../utils/tts';

const usage = createMemoryUsage();

export default defineEventHandler(async (event) => {
  const userId = await requireUser(event);
  const body = await readBody(event).catch(() => null);
  const result = await handleSpeak({ config: ttsConfig(process.env), usage, fetch, now: Date.now }, { userId, body });
  setResponseStatus(event, result.status);
  return result.body;
});
