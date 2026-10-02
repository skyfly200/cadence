import { describe, expect, it, vi } from 'vitest';
import { approveAuthorize, describeAuthorize, getAiEnabledFromServer, listAssistants, revokeAssistant, sendDeletionAction, setAiEnabledOnServer } from './account-client';

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

describe('assistant connection helpers', () => {
  it('lists with GET and revokes with POST, both with the bearer token', async () => {
    const f = vi.fn(async () => json({ ok: true, connections: [] }));
    expect(await listAssistants('tok', f as unknown as typeof fetch)).toEqual({ status: 'ok', data: { ok: true, connections: [] } });
    expect(await listAssistants(null, f as unknown as typeof fetch)).toEqual({ status: 'signed_out' });
    await revokeAssistant('gr_1', 'tok', f as unknown as typeof fetch);
    const [lu, li] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(lu).toBe('/api/oauth/connections');
    expect(li.method).toBe('GET');
    const [ru, ri] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect(ru).toBe('/api/oauth/revoke');
    expect(JSON.parse(String(ri.body))).toEqual({ id: 'gr_1' });
    expect((ri.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
  it('sends the authorize request through describe and approve', async () => {
    const f = vi.fn(async () => json({ ok: true }));
    const q = { client_id: 'cl_1', redirect_uri: 'https://claude.ai/api/mcp/auth_callback' };
    await describeAuthorize(q, 't', f as unknown as typeof fetch);
    await approveAuthorize(q, 'read', 't', f as unknown as typeof fetch);
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('/api/oauth/describe');
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual(q);
    expect((f.mock.calls[1] as unknown as [string])[0]).toBe('/api/oauth/approve');
    expect(JSON.parse(String((f.mock.calls[1] as unknown as [string, RequestInit])[1].body))).toEqual({ request: q, scope: 'read' });
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
