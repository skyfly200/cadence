/**
 * Verify a Supabase user from a Bearer access token, server-side.
 *
 * The app keeps its Supabase session in localStorage (not cookies), so the
 * browser sends the access token in an Authorization header. We ask Supabase
 * Auth itself who the token belongs to, which needs only the public URL and
 * publishable key (no JWT secret on our side).
 */
export function bearerFrom(header: string | undefined | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1]! : null;
}

export async function verifyUser(opts: {
  fetch: typeof fetch; supabaseUrl: string; anonKey: string; authorization: string | undefined | null;
}): Promise<string | null> {
  const token = bearerFrom(opts.authorization);
  if (!token || !opts.supabaseUrl || !opts.anonKey) return null;
  try {
    const res = await opts.fetch(`${opts.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: opts.anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user?.id === 'string' && user.id ? user.id : null;
  } catch {
    return null;
  }
}
