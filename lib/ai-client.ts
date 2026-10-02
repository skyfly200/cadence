/**
 * The one browser helper every AI call goes through. Framework-free so it can be
 * unit tested. With AI switched off on this device it makes no request at all; the
 * server checks the switch again (ai_settings), so another device cannot bypass it.
 */
import { getAiOn } from './home/prefs';

export type AiClientResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'off' }
  | { status: 'signed_out' }
  | { status: 'failed'; message: string };

interface Opts {
  accessToken: string | null | undefined;
  fetch?: typeof fetch;
  /** Overrides the stored switch (tests). */
  aiOn?: boolean;
}

export async function aiFetch<T>(path: string, body: unknown, opts: Opts): Promise<AiClientResult<T>> {
  if (!(opts.aiOn ?? getAiOn())) return { status: 'off' };
  if (!opts.accessToken) return { status: 'signed_out' };
  try {
    const res = await (opts.fetch ?? fetch)(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { status: 'signed_out' };
    if (res.status === 403) return { status: 'off' }; // the server says AI is off for this account
    if (!res.ok) return { status: 'failed', message: 'The AI is not available right now.' };
    return { status: 'ok', data: (await res.json()) as T };
  } catch {
    return { status: 'failed', message: 'The AI is not available right now.' };
  }
}
