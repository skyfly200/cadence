/**
 * Cloud voices (opt-in): turns one short nudge line into speech with an OpenAI-compatible
 * text-to-speech endpoint chosen by the server's environment (CADENCE_TTS_URL, CADENCE_TTS_KEY,
 * and optionally CADENCE_TTS_MODEL and CADENCE_TTS_VOICE). Unset means the module is off and
 * the browser's own voice is used. Framework-free so it can be tested with a fake fetch.
 * The browser decides what is sent (never a Private item); the text is spoken, not stored.
 */
export interface TtsConfig { url: string; key: string; model: string; voice: string; dailyCap: number; }

export const MAX_TTS_CHARS = 300;
export const DEFAULT_DAILY_CAP = 200;

/** The config from the environment, or null when cloud voices are not set up. */
export function ttsConfig(env: Record<string, string | undefined>): TtsConfig | null {
  const url = (env.CADENCE_TTS_URL ?? '').trim().replace(/\/+$/, '');
  const key = (env.CADENCE_TTS_KEY ?? '').trim();
  if (!url.startsWith('https://') || !key) return null;
  const cap = Number(env.CADENCE_TTS_DAILY_CAP);
  return { url, key, model: env.CADENCE_TTS_MODEL || 'tts-1', voice: env.CADENCE_TTS_VOICE || 'alloy', dailyCap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : DEFAULT_DAILY_CAP };
}

/** Per-instance daily counter; a cost guard, not an exact meter. */
export interface TtsUsage { take(userId: string, cap: number, now: number): boolean; }
export function createMemoryUsage(): TtsUsage {
  const used = new Map<string, number>();
  return {
    take(userId, cap, now) {
      const key = `${userId}|${new Date(now).toISOString().slice(0, 10)}`;
      const n = used.get(key) ?? 0;
      if (n >= cap) return false;
      used.set(key, n + 1);
      return true;
    },
  };
}

export interface TtsDeps { config: TtsConfig | null; usage: TtsUsage; fetch: typeof fetch; now: () => number; }
export type TtsResult =
  | { status: 200; body: { ok: true; audio: string; mime: string } }
  | { status: 400 | 429 | 502 | 503; body: { ok: false; error: string; message: string } };

const fail = (status: 400 | 429 | 502 | 503, error: string, message: string): TtsResult => ({ status, body: { ok: false, error, message } });

export async function handleSpeak(d: TtsDeps, req: { userId: string; body: unknown }): Promise<TtsResult> {
  if (!d.config) return fail(503, 'unavailable', 'Cloud voices are not set up. The browser voice is used instead.');
  const text = req.body && typeof req.body === 'object' ? (req.body as { text?: unknown }).text : undefined;
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TTS_CHARS) return fail(400, 'bad_request', `text must be 1 to ${MAX_TTS_CHARS} characters.`);
  if (!d.usage.take(req.userId, d.config.dailyCap, d.now())) return fail(429, 'cap', 'Cloud voice limit reached for today.');
  try {
    const res = await d.fetch(`${d.config.url}/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${d.config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: d.config.model, voice: d.config.voice, input: text.trim(), response_format: 'mp3' }),
    });
    if (!res.ok) return fail(502, 'upstream', 'The voice service is not available right now.');
    return { status: 200, body: { ok: true, audio: Buffer.from(await res.arrayBuffer()).toString('base64'), mime: 'audio/mpeg' } };
  } catch {
    return fail(502, 'upstream', 'The voice service is not available right now.');
  }
}
