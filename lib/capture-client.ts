/**
 * Browser helper for POST /api/capture. Framework-free so it can be unit tested.
 *
 * Offline behaviour (a decision, not a queue): if the request cannot reach the
 * server, the result is 'queued' and carries the idempotency key. The caller
 * decides whether to keep the text and call again later with the SAME key; the
 * server then returns the original result instead of saving a second Idea. This
 * module builds no queue and no UI.
 */
export type CaptureOutcome =
  | { status: 'saved'; reply: string; id: string; duplicate: boolean }
  | { status: 'queued'; idempotencyKey: string; message: string }
  | { status: 'signed_out'; message: string }
  | { status: 'rejected'; reason: 'empty' | 'too_long' | 'bad_request'; message: string }
  | { status: 'failed'; retryable: boolean; message: string; retryAfterSeconds?: number };

export function newIdempotencyKey(): string {
  return `cap_${crypto.randomUUID()}`;
}

interface Opts {
  accessToken: string | null | undefined;
  /** Reuse the key from an earlier 'queued' attempt so a retry cannot duplicate. */
  idempotencyKey?: string;
  fetch?: typeof fetch;
}

export async function postCapture(text: string, opts: Opts): Promise<CaptureOutcome> {
  if (!opts.accessToken) return { status: 'signed_out', message: 'Sign in first, then capture.' };
  const key = opts.idempotencyKey ?? newIdempotencyKey();
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch('/api/capture', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, idempotencyKey: key }),
    });
  } catch {
    return { status: 'queued', idempotencyKey: key, message: 'No connection right now. Keep it, and try again when you are back online.' };
  }
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  if (res.ok && body?.ok === true) {
    return { status: 'saved', reply: String(body.reply ?? 'Got it, parked.'), id: String(body.id ?? ''), duplicate: body.duplicate === true };
  }
  if (res.status === 401) return { status: 'signed_out', message: 'Sign in again, then capture.' };
  const message = typeof body?.message === 'string' ? body.message : 'Could not save that just now. Please try again in a moment.';
  if (res.status === 400) {
    const reason = body?.error === 'empty' || body?.error === 'too_long' ? body.error : 'bad_request';
    return { status: 'rejected', reason, message };
  }
  const retry = Number(body?.retryAfterSeconds);
  return { status: 'failed', retryable: true, message, ...(retry > 0 ? { retryAfterSeconds: retry } : {}) };
}
