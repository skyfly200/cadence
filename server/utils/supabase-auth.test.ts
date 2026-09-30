import { describe, expect, it, vi } from 'vitest';
import { bearerFrom, verifyUser } from './supabase-auth';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const opts = (f: typeof fetch, authorization: string | undefined | null = 'Bearer tok123') => ({
  fetch: f, supabaseUrl: 'https://proj.supabase.co/', anonKey: 'sb_publishable_x', authorization,
});

describe('bearerFrom', () => {
  it('extracts the token', () => expect(bearerFrom('Bearer abc.def')).toBe('abc.def'));
  it('is case-insensitive about the scheme and tolerant of spaces', () => expect(bearerFrom('  bearer   abc ')).toBe('abc'));
  it('rejects anything else', () => {
    expect(bearerFrom(undefined)).toBeNull();
    expect(bearerFrom('')).toBeNull();
    expect(bearerFrom('Basic abc')).toBeNull();
    expect(bearerFrom('Bearer')).toBeNull();
    expect(bearerFrom('Bearer a b')).toBeNull();
  });
});

describe('verifyUser', () => {
  it('asks Supabase Auth who the token belongs to and returns the user id', async () => {
    const f = vi.fn(async () => json({ id: 'user-42', email: 'x@y.z' })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    expect(await verifyUser(opts(f))).toBe('user-42');
    const [url, init] = f.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://proj.supabase.co/auth/v1/user'); // trailing slash handled
    expect(init.headers).toEqual({ apikey: 'sb_publishable_x', Authorization: 'Bearer tok123' });
  });

  it('returns null without calling Supabase when there is no usable bearer token or config', async () => {
    const f = vi.fn(async () => json({ id: 'x' })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    expect(await verifyUser(opts(f, null))).toBeNull(); // null, not undefined: undefined would pick the helper's default token
    expect(await verifyUser(opts(f, 'Basic x'))).toBeNull();
    expect(await verifyUser({ ...opts(f), anonKey: '' })).toBeNull();
    expect(await verifyUser({ ...opts(f), supabaseUrl: '' })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('returns null for an invalid or expired token', async () => {
    expect(await verifyUser(opts(vi.fn(async () => json({ msg: 'invalid JWT' }, 401)) as unknown as typeof fetch))).toBeNull();
  });

  it('returns null when the response has no id, and when the network fails', async () => {
    expect(await verifyUser(opts(vi.fn(async () => json({ email: 'x' })) as unknown as typeof fetch))).toBeNull();
    expect(await verifyUser(opts(vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch))).toBeNull();
  });
});
