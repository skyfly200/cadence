/**
 * POST /api/google-calendar/disconnect  (Authorization: Bearer ...)
 * Revokes the grant at Google (best effort) and deletes our stored copy.
 */
import { revokeToken } from '../../utils/google-oauth';
import { gcalContext, requireUser } from '../../utils/gcal-context';

export default defineEventHandler(async (event) => {
  const uid = await requireUser(event);
  const c = gcalContext(event);
  if (!c.ok) return { ok: true }; // nothing can be stored without the server config
  try {
    const tokens = await c.ctx.vault.load(uid);
    if (tokens) await revokeToken(fetch, tokens.refreshToken);
  } catch { /* an unreadable blob must not stop the delete below */ }
  await c.ctx.vault.remove(uid);
  return { ok: true };
});
