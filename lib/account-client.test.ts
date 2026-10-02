import { describe, expect, it, vi } from 'vitest';
import { getAiEnabledFromServer, sendDeletionAction, setAiEnabledOnServer } from './account-client';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('account client', () => {
  it('needs a token and posts to the right route with it', async () => {
    const f = vi.fn(async () => json({ ok: true, enabled: false }));
    expect(await setAiEnabledOnServer(false, null, f as unknown as typeof fetch)).toEqual({ status: 'signed_out' });
    expect(f).not.toHaveBeenCalled();
    expect(await setAiEnabledOnServer(false, 't', f as unknown as typeof fetch)).toEqual({ status: 'ok', data: { ok: true, enabled: false } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/account/ai');
    expect(JSON.parse(String(init.body))).toEqual({ enabled: false });
  });
  it('maps 401 and failures calmly', async () => {
    expect((await sendDeletionAction('request', 't', (async () => json({}, 401)) as unknown as typeof fetch)).status).toBe('signed_out');
    expect((await sendDeletionAction('request', 't', (async () => json({}, 503)) as unknown as typeof fetch)).status).toBe('failed');
    expect((await sendDeletionAction('cancel', 't', (async () => { throw new Error('x'); }) as unknown as typeof fetch)).status).toBe('failed');
  });
});

describe('getAiEnabledFromServer', () => {
  it('GETs the switch with the bearer token and no body', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, enabled: false })));
    expect(await getAiEnabledFromServer('tok', f as unknown as typeof fetch)).toEqual({ status: 'ok', data: { ok: true, enabled: false } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/account/ai');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
  it('is signed_out without a token and without a request', async () => {
    const f = vi.fn();
    expect(await getAiEnabledFromServer(null, f as unknown as typeof fetch)).toEqual({ status: 'signed_out' });
    expect(f).not.toHaveBeenCalled();
  });
});
