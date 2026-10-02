/**
 * Known apps: recognise one in an item's title ("Check my email", "Duolingo") and
 * give the link that opens it. On Android the link is an intent for the installed
 * app, falling back to the website; everywhere else it is the website, which the
 * phone or desktop hands to the app when it can. Pure; the title is the only input,
 * so existing items get the link without any migration.
 */
export interface KnownApp {
  id: string;
  name: string;
  /** Words in a title that mean this app, matched as whole words, case-insensitive. */
  words: string[];
  url: string;
  /** Android package, to open the installed app. */
  androidPackage?: string;
}

export const KNOWN_APPS: readonly KnownApp[] = [
  { id: 'gmail', name: 'Gmail', words: ['gmail', 'email', 'emails', 'e-mail', 'inbox', 'mail'], url: 'https://mail.google.com/', androidPackage: 'com.google.android.gm' },
  { id: 'calendar', name: 'Calendar', words: ['calendar', 'gcal'], url: 'https://calendar.google.com/', androidPackage: 'com.google.android.calendar' },
  { id: 'maps', name: 'Maps', words: ['maps', 'directions'], url: 'https://maps.google.com/', androidPackage: 'com.google.android.apps.maps' },
  { id: 'drive', name: 'Drive', words: ['drive', 'gdrive'], url: 'https://drive.google.com/', androidPackage: 'com.google.android.apps.docs' },
  { id: 'duolingo', name: 'Duolingo', words: ['duolingo'], url: 'https://www.duolingo.com/learn', androidPackage: 'com.duolingo' },
  { id: 'youtube', name: 'YouTube', words: ['youtube'], url: 'https://www.youtube.com/', androidPackage: 'com.google.android.youtube' },
  { id: 'spotify', name: 'Spotify', words: ['spotify'], url: 'https://open.spotify.com/', androidPackage: 'com.spotify.music' },
  { id: 'whatsapp', name: 'WhatsApp', words: ['whatsapp'], url: 'https://web.whatsapp.com/', androidPackage: 'com.whatsapp' },
  { id: 'slack', name: 'Slack', words: ['slack'], url: 'https://app.slack.com/', androidPackage: 'com.Slack' },
  { id: 'zoom', name: 'Zoom', words: ['zoom'], url: 'https://zoom.us/', androidPackage: 'us.zoom.videomeetings' },
  { id: 'notion', name: 'Notion', words: ['notion'], url: 'https://www.notion.so/', androidPackage: 'notion.id' },
];

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\-]/g, '\$&');

/** The first known app named in a title, preferring the app whose word appears earliest. */
export function matchApp(title: string): KnownApp | null {
  let best: { app: KnownApp; at: number } | null = null;
  for (const app of KNOWN_APPS) {
    for (const w of app.words) {
      const m = new RegExp(String.raw`(?<![\p{L}\p{N}])${escape(w)}(?![\p{L}\p{N}])`, 'iu').exec(title);
      if (m && (!best || m.index < best.at)) best = { app, at: m.index };
    }
  }
  return best?.app ?? null;
}

/** The link to open an app: an Android intent (with the website as fallback) or the website. */
export function openLink(app: KnownApp, android: boolean): string {
  if (!android || !app.androidPackage) return app.url;
  const u = new URL(app.url);
  const fallback = encodeURIComponent(app.url);
  return `intent://${u.host}${u.pathname}#Intent;scheme=${u.protocol.slice(0, -1)};package=${app.androidPackage};S.browser_fallback_url=${fallback};end`;
}

export const isAndroidUa = (ua: string): boolean => /Android/i.test(ua);
