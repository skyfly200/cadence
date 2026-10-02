/**
 * Read-only imports from Google, user-triggered: open Google Tasks, and the text of one Google Doc the
 * user picked with the Google Picker. Framework-free (no Nitro globals), with `fetch` and the token vault
 * injected so it can be unit tested. Nothing is ever written back to Google, no Google token reaches the
 * browser, and nothing here is saved: the browser turns tasks into Ideas and runs a doc's text through
 * extraction, where every proposal waits for a tap.
 *
 * Users who connected before imports existed hold tokens without these scopes; they get a calm
 * "reconnect" answer instead of an error.
 */
import { DRIVE_FILE_SCOPE, TASKS_SCOPE, getFreshAccessToken } from './google-oauth';
import type { TokenVault } from './google-tokens';

type Fetch = typeof fetch;

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const MAX_LISTS = 10;
const MAX_PER_LIST = 100;
const MAX_TASKS = 300;
const MAX_TITLE = 200;
const MAX_NOTES = 1000;
/** The most of a document read into memory; the route trims further to what extraction accepts. */
export const MAX_DOC_CHARS = 100_000;
const FILE_ID = /^[A-Za-z0-9_-]{10,100}$/;

export interface GoogleTask { id: string; title: string; notes: string | null; due: string | null }

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

/** Open (not completed) tasks across the user's first few lists, newest lists first as Google returns them. */
export async function listOpenTasks(opts: { fetch: Fetch; accessToken: string }): Promise<GoogleTask[]> {
  const lists = await getJson(opts.fetch, `${TASKS_BASE}/users/@me/lists?maxResults=${MAX_LISTS}`, opts.accessToken);
  const out: GoogleTask[] = [];
  for (const l of (Array.isArray(lists?.items) ? lists.items : []).slice(0, MAX_LISTS)) {
    if (typeof l?.id !== 'string') continue;
    const page = await getJson(
      opts.fetch,
      `${TASKS_BASE}/lists/${encodeURIComponent(l.id)}/tasks?showCompleted=false&showHidden=false&maxResults=${MAX_PER_LIST}`,
      opts.accessToken,
    );
    for (const t of Array.isArray(page?.items) ? page.items : []) {
      const title = typeof t?.title === 'string' ? t.title.replace(/\s+/g, ' ').trim() : '';
      if (!title || typeof t.id !== 'string' || t.status === 'completed') continue;
      out.push({
        id: `${l.id}:${t.id}`,
        title: title.slice(0, MAX_TITLE),
        notes: typeof t.notes === 'string' && t.notes.trim() ? t.notes.trim().slice(0, MAX_NOTES) : null,
        due: typeof t.due === 'string' ? t.due : null,
      });
      if (out.length >= MAX_TASKS) return out;
    }
  }
  return out;
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
export async function handleCapabilities(deps: Pick<ImportDeps, 'vault'>, userId: string): Promise<{ connected: boolean; email: string | null; canImportTasks: boolean; canImportDocs: boolean }> {
  const s = await deps.vault.status(userId);
  if (!s.connected) return { connected: false, email: null, canImportTasks: false, canImportDocs: false };
  let granted: string[] = [];
  try { granted = await deps.vault.scopes(userId); } catch { /* unreadable tokens: ask to reconnect */ }
  return { connected: true, email: s.email, canImportTasks: granted.includes(TASKS_SCOPE), canImportDocs: granted.includes(DRIVE_FILE_SCOPE) };
}

export async function handleTasks(deps: ImportDeps, input: { userId: string }): Promise<ImportResult<{ ok: true; tasks: GoogleTask[] }>> {
  const t = await tokenFor(deps, input.userId, TASKS_SCOPE);
  if (!t.ok) return t.result;
  try {
    return { status: 200, body: { ok: true, tasks: await listOpenTasks({ fetch: deps.fetch, accessToken: t.accessToken }) } };
  } catch (e) {
    return e instanceof NotAllowed ? reconnect() : failed();
  }
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
