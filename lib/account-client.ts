/** Browser helpers for the account routes (AI switch, delete everything). Framework-free. */
export interface DeletionState { pending: boolean; requestedAt: string | null; purgeAt: string | null }
export type AccountOutcome<T> = { status: 'ok'; data: T } | { status: 'signed_out' } | { status: 'failed'; message: string };

async function call<T>(path: string, method: 'GET' | 'POST', body: unknown, accessToken: string | null | undefined, f?: typeof fetch): Promise<AccountOutcome<T>> {
  if (!accessToken) return { status: 'signed_out' };
  try {
    const res = await (f ?? fetch)(path, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401) return { status: 'signed_out' };
    if (!res.ok) return { status: 'failed', message: 'That did not go through. Please try again.' };
    return { status: 'ok', data: (await res.json()) as T };
  } catch {
    return { status: 'failed', message: 'No connection right now. Please try again.' };
  }
}

const post = <T>(path: string, body: unknown, accessToken: string | null | undefined, f?: typeof fetch) => call<T>(path, 'POST', body, accessToken, f);

export const getAiEnabledFromServer = (accessToken: string | null | undefined, f?: typeof fetch) =>
  call<{ ok: true; enabled: boolean }>('/api/account/ai', 'GET', null, accessToken, f);

export const setAiEnabledOnServer = (enabled: boolean, accessToken: string | null | undefined, f?: typeof fetch) =>
  post<{ ok: true; enabled: boolean }>('/api/account/ai', { enabled }, accessToken, f);

export const sendDeletionAction = (action: 'request' | 'cancel' | 'status', accessToken: string | null | undefined, f?: typeof fetch) =>
  post<{ ok: true } & DeletionState>('/api/account/deletion', { action }, accessToken, f);
