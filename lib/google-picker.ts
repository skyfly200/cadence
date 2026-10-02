/**
 * Let the user pick one Google Doc with the Google Picker. Browser only.
 *
 * The Picker needs a short-lived access token in the browser, so it gets its own: Google Identity Services
 * issues one for the per-file `drive.file` scope alone, and it is used only to open the Picker and then
 * dropped. The long-lived Google tokens stay on the server, which reads the picked file by id
 * (POST /api/google/doc). Needs the OAuth client id and a Picker API key (NUXT_PUBLIC_GOOGLE_PICKER_API_KEY).
 */
const GSI = 'https://accounts.google.com/gsi/client';
const GAPI = 'https://apis.google.com/js/api.js';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DOC_MIME = 'application/vnd.google-apps.document';

/** The id of the document the user picked, or null if they cancelled or picked nothing usable. */
export function docIdFromPickerData(data: unknown): string | null {
  const d = data as { action?: unknown; docs?: unknown } | null;
  if (!d || d.action !== 'picked' || !Array.isArray(d.docs)) return null;
  const id = (d.docs[0] as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

const loading = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const have = loading.get(src);
  if (have) return have;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => { loading.delete(src); reject(new Error('script_failed')); };
    document.head.appendChild(el);
  });
  loading.set(src, p);
  return p;
}

/** Opens the Picker. Resolves with the picked document's id, or null if cancelled; rejects if Google's scripts cannot load or sign-in is refused. */
export async function pickGoogleDoc(opts: { clientId: string; apiKey: string }): Promise<string | null> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  await Promise.all([loadScript(GSI), loadScript(GAPI)]);
  const w = window as any;
  await new Promise<void>((resolve) => w.gapi.load('picker', () => resolve()));
  const token = await new Promise<string>((resolve, reject) => {
    const client = w.google.accounts.oauth2.initTokenClient({
      client_id: opts.clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (r: { access_token?: string; error?: string }) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error || 'no_token'))),
      error_callback: (e: { type?: string }) => reject(new Error(e?.type || 'sign_in_failed')),
    });
    client.requestAccessToken({ prompt: '' });
  });
  return new Promise<string | null>((resolve) => {
    const view = new w.google.picker.DocsView(w.google.picker.ViewId.DOCUMENTS).setMimeTypes(DOC_MIME);
    new w.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(opts.apiKey)
      .setCallback((data: { action?: string }) => {
        if (data.action === 'picked') resolve(docIdFromPickerData(data));
        else if (data.action === 'cancel') resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
