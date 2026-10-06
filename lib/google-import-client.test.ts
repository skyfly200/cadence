import { describe, expect, it, vi } from 'vitest';
import { fetchGoogleDoc, getGoogleStatus, startGoogleConnect } from './google-import-client';

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

describe('google import client', () => {
  it('sends the access token and the file id, and never anything else', async () => {
    const f = reply(200, { ok: true, text: 'hi', truncated: false });
    const r = await fetchGoogleDoc('abcDEF123456', 'tok', f);
    expect(r).toEqual({ status: 'ok', data: { ok: true, text: 'hi', truncated: false } });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/google/doc');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(init.body))).toEqual({ fileId: 'abcDEF123456' });
  });

  it('makes no request when signed out, and treats a 401 as signed out', async () => {
    const f = reply(200, {});
    expect(await fetchGoogleDoc('abcDEF123456', null, f)).toEqual({ status: 'signed_out' });
    expect(f).not.toHaveBeenCalled();
    expect(await fetchGoogleDoc('abcDEF123456', 'tok', reply(401, {}))).toEqual({ status: 'signed_out' });
  });

  it('maps a 409 to the calm reconnect message', async () => {
    expect(await fetchGoogleDoc('abcDEF123456', 'tok', reply(409, { error: 'reconnect' }))).toEqual({ status: 'reconnect', message: 'Reconnect Google to import.' });
  });

  it('shows the server message for a bad document or a Google hiccup, and a generic one otherwise', async () => {
    expect(await fetchGoogleDoc('x', 'tok', reply(400, { message: 'Cadence could not open that document.' }))).toEqual({ status: 'failed', message: 'Cadence could not open that document.' });
    expect(await fetchGoogleDoc('abcDEF123456', 'tok', reply(502, { message: 'Google did not answer just now.' }))).toEqual({ status: 'failed', message: 'Google did not answer just now.' });
    const generic = await fetchGoogleDoc('abcDEF123456', 'tok', reply(500, { message: 'internal detail' }));
    expect(generic).toEqual({ status: 'failed', message: 'That did not go through. Please try again.' });
  });

  it('answers a network error calmly', async () => {
    const r = await getGoogleStatus('tok', (async () => { throw new Error('offline'); }) as unknown as typeof fetch);
    expect(r).toEqual({ status: 'failed', message: 'No connection right now. Please try again.' });
  });

  it('asks the server for the consent URL, never building one in the browser', async () => {
    const f = reply(200, { url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' });
    expect(await startGoogleConnect('tok', f)).toMatchObject({ status: 'ok', data: { url: expect.stringContaining('accounts.google.com') } });
    expect(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [string])[0]).toBe('/api/google-calendar/start');
  });
});
