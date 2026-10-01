import { describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey, postCapture } from './capture-client';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('postCapture', () => {
  it('posts with the bearer token and an idempotency key, and returns the reply', async () => {
    const f = vi.fn(async () => json({ ok: true, reply: 'Got it, parked.', id: 'idea_1', duplicate: false }));
    const r = await postCapture('hello', { accessToken: 'tok', fetch: f as unknown as typeof fetch });
    expect(r).toEqual({ status: 'saved', reply: 'Got it, parked.', id: 'idea_1', duplicate: false });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/capture');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const sent = JSON.parse(String(init.body));
    expect(sent.text).toBe('hello');
    expect(sent.idempotencyKey).toMatch(/^cap_/);
  });

  it('is signed out without a token (no request) and on a 401', async () => {
    const f = vi.fn();
    expect((await postCapture('x', { accessToken: null, fetch: f as unknown as typeof fetch })).status).toBe('signed_out');
    expect(f).not.toHaveBeenCalled();
    const r = await postCapture('x', { accessToken: 't', fetch: (async () => json({}, 401)) as unknown as typeof fetch });
    expect(r.status).toBe('signed_out');
  });

  it('maps 400s to calm rejections and 429/5xx to retryable failures', async () => {
    const rejected = await postCapture('', { accessToken: 't', fetch: (async () => json({ ok: false, error: 'empty', message: 'There was nothing to save yet.' }, 400)) as unknown as typeof fetch });
    expect(rejected).toEqual({ status: 'rejected', reason: 'empty', message: 'There was nothing to save yet.' });
    const limited = await postCapture('x', { accessToken: 't', fetch: (async () => json({ ok: false, error: 'rate_limited', message: 'Give it a moment.', retryAfterSeconds: 30 }, 429)) as unknown as typeof fetch });
    expect(limited).toMatchObject({ status: 'failed', retryable: true, retryAfterSeconds: 30 });
    const down = await postCapture('x', { accessToken: 't', fetch: (async () => new Response('<html>', { status: 502 })) as unknown as typeof fetch });
    expect(down).toMatchObject({ status: 'failed', retryable: true });
  });

  it('when offline returns queued with the key, and a retry with that key reuses it', async () => {
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const q = await postCapture('later', { accessToken: 't', fetch: offline as unknown as typeof fetch });
    expect(q.status).toBe('queued');
    if (q.status !== 'queued') throw new Error('unreachable');
    const online = vi.fn(async () => json({ ok: true, reply: 'Got it, parked.', id: 'idea_2', duplicate: false }));
    await postCapture('later', { accessToken: 't', idempotencyKey: q.idempotencyKey, fetch: online as unknown as typeof fetch });
    expect(JSON.parse(String((online.mock.calls[0] as unknown as [string, RequestInit])[1].body)).idempotencyKey).toBe(q.idempotencyKey);
  });

  it('generates distinct keys that the server accepts', () => {
    const a = newIdempotencyKey();
    expect(a).not.toBe(newIdempotencyKey());
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });
});
