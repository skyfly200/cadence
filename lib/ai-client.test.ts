import { describe, expect, it, vi } from 'vitest';
import { aiFetch } from './ai-client';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('aiFetch', () => {
  it('makes no request when AI is off on this device', async () => {
    const f = vi.fn();
    expect(await aiFetch('/api/ai/x', {}, { accessToken: 't', aiOn: false, fetch: f as unknown as typeof fetch })).toEqual({ status: 'off' });
    expect(f).not.toHaveBeenCalled();
  });
  it('is signed out without a token, and posts with the bearer token otherwise', async () => {
    const f = vi.fn(async () => json({ text: 'hi' }));
    expect(await aiFetch('/api/ai/x', {}, { accessToken: null, aiOn: true, fetch: f as unknown as typeof fetch })).toEqual({ status: 'signed_out' });
    expect(f).not.toHaveBeenCalled();
    expect(await aiFetch('/api/ai/x', { a: 1 }, { accessToken: 't', aiOn: true, fetch: f as unknown as typeof fetch })).toEqual({ status: 'ok', data: { text: 'hi' } });
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ Authorization: 'Bearer t' });
  });
  it('treats a 403 as off, other errors as a calm failure', async () => {
    expect((await aiFetch('/p', {}, { accessToken: 't', aiOn: true, fetch: (async () => json({}, 403)) as unknown as typeof fetch })).status).toBe('off');
    expect((await aiFetch('/p', {}, { accessToken: 't', aiOn: true, fetch: (async () => json({}, 500)) as unknown as typeof fetch })).status).toBe('failed');
    expect((await aiFetch('/p', {}, { accessToken: 't', aiOn: true, fetch: (async () => { throw new Error('x'); }) as unknown as typeof fetch })).status).toBe('failed');
  });
});
