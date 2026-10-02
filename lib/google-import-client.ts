/**
 * Browser helpers for the Google imports (Tasks and Docs) and for connecting Google. Framework-free, with
 * `fetch` injectable. Every answer is calm: a missing grant says "Reconnect Google to import", and nothing
 * here ever sees a Google token (the server holds them).
 */
import type { ImportedTask } from './home/import';

export type GoogleOutcome<T> =
  | { status: 'ok'; data: T }
  | { status: 'signed_out' }
  | { status: 'reconnect'; message: string }
  | { status: 'failed'; message: string };

export interface GoogleStatus { configured: boolean; connected: boolean; email: string | null; canImportTasks: boolean; canImportDocs: boolean }

async function call<T>(path: string, method: 'GET' | 'POST', body: unknown, accessToken: string | null | undefined, f?: typeof fetch): Promise<GoogleOutcome<T>> {
  if (!accessToken) return { status: 'signed_out' };
  try {
    const res = await (f ?? fetch)(path, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401) return { status: 'signed_out' };
    if (res.status === 409) return { status: 'reconnect', message: 'Reconnect Google to import.' };
    if (!res.ok) {
      let message = 'That did not go through. Please try again.';
      try { const j = await res.json(); if ((res.status === 400 || res.status === 502) && typeof j?.message === 'string') message = j.message; } catch { /* keep the default */ }
      return { status: 'failed', message };
    }
    return { status: 'ok', data: (await res.json()) as T };
  } catch {
    return { status: 'failed', message: 'No connection right now. Please try again.' };
  }
}

export const getGoogleStatus = (accessToken: string | null | undefined, f?: typeof fetch) =>
  call<GoogleStatus>('/api/google-calendar/status', 'GET', null, accessToken, f);

/** The Google consent URL to send the browser to (the server signs the state and asks for every scope). */
export const startGoogleConnect = (accessToken: string | null | undefined, f?: typeof fetch) =>
  call<{ url: string }>('/api/google-calendar/start', 'POST', {}, accessToken, f);

export const fetchGoogleTasks = (accessToken: string | null | undefined, f?: typeof fetch) =>
  call<{ ok: true; tasks: ImportedTask[] }>('/api/google/tasks', 'GET', null, accessToken, f);

/** The plain text of a Google Doc the user picked; `truncated` says it was longer than extraction takes. */
export const fetchGoogleDoc = (fileId: string, accessToken: string | null | undefined, f?: typeof fetch) =>
  call<{ ok: true; text: string; truncated: boolean }>('/api/google/doc', 'POST', { fileId }, accessToken, f);
