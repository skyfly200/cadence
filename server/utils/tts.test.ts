import { describe, expect, it, vi } from 'vitest';
import { createMemoryUsage, handleSpeak, MAX_TTS_CHARS, ttsConfig, type TtsConfig } from './tts';

const CONFIG: TtsConfig = { url: 'https://tts.example/v1', key: 'k', model: 'm', voice: 'v', dailyCap: 2 };
const audio = () => new Response(new Uint8Array([1, 2, 3]));
const run = (body: unknown, over: Partial<Parameters<typeof handleSpeak>[0]> = {}) =>
  handleSpeak({ config: CONFIG, usage: createMemoryUsage(), fetch: vi.fn(async () => audio()) as unknown as typeof fetch, now: () => Date.UTC(2026, 9, 5), ...over }, { userId: 'u1', body });

describe('ttsConfig', () => {
  it('is null unless an https url and a key are set', () => {
    expect(ttsConfig({})).toBeNull();
    expect(ttsConfig({ CADENCE_TTS_URL: 'https://x/v1' })).toBeNull();
    expect(ttsConfig({ CADENCE_TTS_URL: 'http://x/v1', CADENCE_TTS_KEY: 'k' })).toBeNull();
  });
  it('reads the url without a trailing slash, with defaults and a cap', () => {
    expect(ttsConfig({ CADENCE_TTS_URL: 'https://x/v1/', CADENCE_TTS_KEY: 'k' })).toEqual({ url: 'https://x/v1', key: 'k', model: 'tts-1', voice: 'alloy', dailyCap: 200 });
    expect(ttsConfig({ CADENCE_TTS_URL: 'https://x', CADENCE_TTS_KEY: 'k', CADENCE_TTS_DAILY_CAP: '5' })?.dailyCap).toBe(5);
  });
});

describe('handleSpeak', () => {
  it('answers 503 when cloud voices are not set up, without calling out', async () => {
    const f = vi.fn();
    const r = await run({ text: 'hi' }, { config: null, fetch: f as unknown as typeof fetch });
    expect(r.status).toBe(503);
    expect(f).not.toHaveBeenCalled();
  });
  it('rejects missing, empty and over-long text', async () => {
    for (const b of [null, {}, { text: 5 }, { text: '  ' }, { text: 'x'.repeat(MAX_TTS_CHARS + 1) }]) expect((await run(b)).status).toBe(400);
  });
  it('returns base64 audio and sends the text with the key', async () => {
    const f = vi.fn(async () => audio());
    const r = await run({ text: ' Leave by 6:40 ' }, { fetch: f as unknown as typeof fetch });
    expect(r).toEqual({ status: 200, body: { ok: true, audio: 'AQID', mime: 'audio/mpeg' } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://tts.example/v1/audio/speech');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'm', voice: 'v', input: 'Leave by 6:40' });
  });
  it('stops at the daily cap, per user, and starts again the next day', async () => {
    const usage = createMemoryUsage();
    const send = (userId: string, now: number) => handleSpeak({ config: CONFIG, usage, fetch: (async () => audio()) as unknown as typeof fetch, now: () => now }, { userId, body: { text: 'a' } });
    const day = Date.UTC(2026, 9, 5);
    expect([(await send('u1', day)).status, (await send('u1', day)).status, (await send('u1', day)).status]).toEqual([200, 200, 429]);
    expect((await send('u2', day)).status).toBe(200);
    expect((await send('u1', day + 86_400_000)).status).toBe(200);
  });
  it('answers 502 when the service fails or errors', async () => {
    expect((await run({ text: 'a' }, { fetch: (async () => new Response('no', { status: 500 })) as unknown as typeof fetch })).status).toBe(502);
    expect((await run({ text: 'a' }, { fetch: (async () => { throw new Error('down'); }) as unknown as typeof fetch })).status).toBe(502);
  });
});
