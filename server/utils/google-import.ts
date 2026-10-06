/**
 * Read-only import from Google, user-triggered: the text of one Google Doc the user picked with the Google
 * Picker. (The Google Tasks import was dropped: it filled the Heap with old tasks.) Framework-free (no Nitro globals), with `fetch` and the token vault
 * injected so it can be unit tested. Nothing is ever written back to Google, no Google token reaches the
 * browser, and nothing here is saved: the browser runs a doc's text through
 * extraction, where every proposal waits for a tap.
 *
 * Users who connected before imports existed hold tokens without these scopes; they get a calm
 * "reconnect" answer instead of an error.
 */
import { DRIVE_FILE_SCOPE, getFreshAccessToken } from './google-oauth';
import type { TokenVault } from './google-tokens';

type Fetch = typeof fetch;

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
/** The most of a document read into memory; the route trims further to what extraction accepts. */
export const MAX_DOC_CHARS = 100_000;
const FILE_ID = /^[A-Za-z0-9_-]{10,100}$/;

/** Google answered, but not with what was asked for: the grant is missing or revoked. */
class NotAllowed extends Error {}
class NotFound extends Error {}
class Upstream extends Error {}

async function getJson(f: Fetch, url: string, accessToken: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await f(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new NotAllowed();
  if (!res.ok) throw new Upstream(`Google answered ${res.status}`);
  return res.json();
}

/**
 * The plain text of a Google Doc. Uses the Drive export endpoint, which the per-file `drive.file` scope
 * allows for a file the user picked (the Docs API's documents.get is documented for the broader document
 * scopes, and this avoids needing them).
 */
export async function fetchDocText(opts: { fetch: Fetch; accessToken: string; fileId: string }): Promise<string> {
  const res = await opts.fetch(`${DRIVE_FILES}/${encodeURIComponent(opts.fileId)}/export?mimeType=${encodeURIComponent('text/plain')}`, {
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  if (res.status === 401) throw new NotAllowed();
  // A file the user did not pick with the Picker, or one that is not a Google Doc.
  if (res.status === 403 || res.status === 404) throw new NotFound();
  if (!res.ok) throw new Upstream(`Google answered ${res.status}`);
  return (await res.text()).slice(0, MAX_DOC_CHARS);
}

// ── handlers ──────────────────────────────────────────────────

export interface ImportDeps { vault: TokenVault; fetch: Fetch; clientId: string; clientSecret: string }

export type ImportResult<T> =
  | { status: 200; body: T }
  | { status: 400; body: { ok: false; error: 'invalid'; message: string } }
  | { status: 409; body: { ok: false; error: 'reconnect'; message: string } }
  | { status: 502; body: { ok: false; error: 'google_failed'; message: string } };

const RECONNECT = 'Reconnect Google to import.';
const reconnect = (): ImportResult<never> => ({ status: 409, body: { ok: false, error: 'reconnect', message: RECONNECT } });
const failed = (): ImportResult<never> => ({ status: 502, body: { ok: false, error: 'google_failed', message: 'Google did not answer just now. Please try again in a moment.' } });

/** A token good for the scope, or the result to answer with. */
async function tokenFor(deps: ImportDeps, userId: string, scope: string): Promise<{ ok: true; accessToken: string } | { ok: false; result: ImportResult<never> }> {
  const access = await getFreshAccessToken({ vault: deps.vault, userId, fetch: deps.fetch, clientId: deps.clientId, clientSecret: deps.clientSecret });
  if (!access.ok) return { ok: false, result: access.reason === 'refresh_failed' ? failed() : reconnect() };
  const granted = await deps.vault.scopes(userId);
  if (!granted.includes(scope)) return { ok: false, result: reconnect() };
  return { ok: true, accessToken: access.accessToken };
}

/** What the browser may know about this connection: whether each import is available, never a token. */
export async function handleCapabilities(deps: Pick<ImportDeps, 'vault'>, userId: string): Promise<{ connected: boolean; email: string | null; canImportDocs: boolean }> {
  const s = await deps.vault.status(userId);
  if (!s.connected) return { connected: false, email: null, canImportDocs: false };
  let granted: string[] = [];
  try { granted = await deps.vault.scopes(userId); } catch { /* unreadable tokens: ask to reconnect */ }
  return { connected: true, email: s.email, canImportDocs: granted.includes(DRIVE_FILE_SCOPE) };
}

/** Body: { fileId: string }. `text` is the document's plain text, trimmed to `maxChars` with `truncated` saying so. */
export async function handleDoc(deps: ImportDeps, input: { userId: string; body: unknown; maxChars: number }): Promise<ImportResult<{ ok: true; text: string; truncated: boolean }>> {
  const b = input.body as { fileId?: unknown } | null;
  const fileId = b && typeof b === 'object' && typeof b.fileId === 'string' ? b.fileId : '';
  if (!FILE_ID.test(fileId)) return { status: 400, body: { ok: false, error: 'invalid', message: 'That document could not be read.' } };
  const t = await tokenFor(deps, input.userId, DRIVE_FILE_SCOPE);
  if (!t.ok) return t.result;
  try {
    const text = (await fetchDocText({ fetch: deps.fetch, accessToken: t.accessToken, fileId })).trim();
    return { status: 200, body: { ok: true, text: text.slice(0, input.maxChars), truncated: text.length > input.maxChars } };
  } catch (e) {
    if (e instanceof NotFound) return { status: 400, body: { ok: false, error: 'invalid', message: 'Cadence could not open that document. Pick it again, and make sure it is a Google Doc.' } };
    return e instanceof NotAllowed ? reconnect() : failed();
  }
}
