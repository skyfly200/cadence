import { describe, expect, it, vi } from 'vitest';
import { connectGithub, getGithubDigest, getGithubStatus } from './github-client';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('github client', () => {
  it('sends the token once, on connect, with the sign-in bearer', async () => {
    const f = vi.fn(async () => json({ ok: true, login: 'me' }));
    expect(await connectGithub('github_pat_x', 'tok', f as unknown as typeof fetch)).toEqual({ status: 'ok', data: { ok: true, login: 'me' } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/github/connect');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(init.body))).toEqual({ token: 'github_pat_x' });
  });

  it('is signed out without a sign-in (no request) and on a 401', async () => {
    const f = vi.fn(async () => json({}, 401));
    expect(await getGithubStatus(null, f as unknown as typeof fetch)).toEqual({ status: 'signed_out' });
    expect(f).not.toHaveBeenCalled();
    expect(await getGithubStatus('tok', f as unknown as typeof fetch)).toEqual({ status: 'signed_out' });
  });

  it('tells "connect again" apart from a passing failure, with the server message', async () => {
    const reauth = vi.fn(async () => json({ ok: false, error: 'reauth', message: 'Connect again.' }, 409));
    expect(await getGithubDigest('tok', reauth as unknown as typeof fetch)).toEqual({ status: 'not_connected', message: 'Connect again.' });
    const bad = vi.fn(async () => json({ ok: false, error: 'bad_token', message: 'GitHub did not accept that token.' }, 400));
    expect(await connectGithub('x', 'tok', bad as unknown as typeof fetch)).toEqual({ status: 'failed', message: 'GitHub did not accept that token.' });
    const offline = vi.fn(async () => { throw new Error('offline'); });
    expect((await getGithubDigest('tok', offline as unknown as typeof fetch)).status).toBe('failed');
  });
});
