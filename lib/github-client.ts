/** Browser helpers for the GitHub routes. Framework-free. The token goes up once, on connect, and never comes back. */
import type { GithubDigest } from '../server/utils/github';

export type { GithubDigest, GithubItem } from '../server/utils/github';
export interface GithubStatus { configured: boolean; connected: boolean; login: string | null }
export type GithubOutcome<T> =
  | { status: 'ok'; data: T }
  | { status: 'signed_out' }
  /** Not connected, or GitHub stopped accepting the saved token (it has been forgotten). */
  | { status: 'not_connected'; message: string }
  | { status: 'failed'; message: string };

const NO_CONNECTION = 'No connection right now. Please try again.';

async function call<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }, accessToken: string | null | undefined, f?: typeof fetch): Promise<GithubOutcome<T>> {
  if (!accessToken) return { status: 'signed_out' };
  try {
    const res = await (f ?? fetch)(path, {
      method: init.method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      ...(init.method === 'POST' ? { body: JSON.stringify(init.body ?? {}) } : {}),
    });
    if (res.status === 401) return { status: 'signed_out' };
    const body = await res.json().catch(() => null) as { message?: unknown; error?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message : 'That did not go through. Please try again.';
    if (res.status === 409) return { status: 'not_connected', message };
    if (res.status === 503) return { status: 'failed', message: 'GitHub is not set up on the server yet.' };
    if (!res.ok) return { status: 'failed', message };
    return { status: 'ok', data: body as T };
  } catch {
    return { status: 'failed', message: NO_CONNECTION };
  }
}

export const getGithubStatus = (accessToken: string | null | undefined, f?: typeof fetch) =>
  call<GithubStatus>('/api/github/status', { method: 'GET' }, accessToken, f);

export const connectGithub = (token: string, accessToken: string | null | undefined, f?: typeof fetch) =>
  call<{ ok: true; login: string }>('/api/github/connect', { method: 'POST', body: { token } }, accessToken, f);

export const disconnectGithub = (accessToken: string | null | undefined, f?: typeof fetch) =>
  call<{ ok: true }>('/api/github/disconnect', { method: 'POST' }, accessToken, f);

export const getGithubDigest = (accessToken: string | null | undefined, f?: typeof fetch) =>
  call<{ ok: true; digest: GithubDigest }>('/api/github/digest', { method: 'GET' }, accessToken, f);
