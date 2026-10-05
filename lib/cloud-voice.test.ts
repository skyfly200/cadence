import { describe, expect, it, vi } from 'vitest';
import { cloudSpeak } from './cloud-voice';

const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const base = { accessToken: 't', volume: 0.5, on: true };

describe('cloudSpeak', () => {
  it('sends nothing when off, signed out, Private or silent', async () => {
    const f = ok({ ok: true, audio: 'AQID' });
    const play = vi.fn(async () => {});
    for (const o of [{ on: false }, { accessToken: null }, { priv: true }, { volume: 0 }]) {
      expect(await cloudSpeak('hi', { ...base, ...o, play, fetch: f })).toBe(false);
    }
    expect(f).not.toHaveBeenCalled();
  });
  it('plays the returned audio at the given volume', async () => {
    const play = vi.fn(async () => {});
    expect(await cloudSpeak('hi', { ...base, play, fetch: ok({ ok: true, audio: 'AQID', mime: 'audio/mpeg' }) })).toBe(true);
    expect(play).toHaveBeenCalledWith('AQID', 'audio/mpeg', 0.5);
  });
  it('returns false so the browser voice takes over on any failure', async () => {
    const play = vi.fn(async () => {});
    expect(await cloudSpeak('hi', { ...base, play, fetch: ok({ ok: false }, 503) })).toBe(false);
    expect(await cloudSpeak('hi', { ...base, play, fetch: ok({ ok: true }) })).toBe(false);
    expect(await cloudSpeak('hi', { ...base, play, fetch: (async () => { throw new Error('x'); }) as unknown as typeof fetch })).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });
});
