/**
 * Music to start alongside a focus session: one tap opens the player, or a chosen
 * playlist, so nothing else gets in the way. Providers are a list so more can be
 * added; YouTube Music is the default. Pure; the app opens the link on a tap.
 */
import type { KnownApp } from './apps';

export interface MusicProvider {
  id: string;
  name: string;
  /** Opens the app itself. */
  home: string;
  androidPackage: string;
  /** Hosts a playlist link for this provider can have. */
  hosts: string[];
}

export const MUSIC_PROVIDERS: readonly MusicProvider[] = [
  { id: 'ytmusic', name: 'YouTube Music', home: 'https://music.youtube.com/', androidPackage: 'com.google.android.apps.youtube.music', hosts: ['music.youtube.com'] },
  { id: 'spotify', name: 'Spotify', home: 'https://open.spotify.com/', androidPackage: 'com.spotify.music', hosts: ['open.spotify.com'] },
  { id: 'soundcloud', name: 'SoundCloud', home: 'https://soundcloud.com/', androidPackage: 'com.soundcloud.android', hosts: ['soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'] },
];

export const DEFAULT_MUSIC_PROVIDER = 'ytmusic';

export interface MusicConfig {
  provider: string;
  /** A playlist link; empty means just open the app. */
  playlist: string;
  /** Open music when a focus session starts. */
  onFocus: boolean;
  /** Music as the timer: the playlist's length in minutes (0 = not used). The session can then last exactly that long. */
  playlistMinutes: number;
}

export const DEFAULT_MUSIC: MusicConfig = { provider: DEFAULT_MUSIC_PROVIDER, playlist: '', onFocus: false, playlistMinutes: 0 };

export const FOCUS_MINUTES: readonly number[] = [15, 25, 45];
export const MAX_PLAYLIST_MINUTES = 180;

/** A typed playlist length as whole minutes within 1 to 180, otherwise 0 (not used). */
export function cleanPlaylistMinutes(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= MAX_PLAYLIST_MINUTES ? n : 0;
}

/** The focus lengths to offer: the usual three, plus the playlist's own length when music is the timer. */
export function focusDurations(m: MusicConfig): number[] {
  const own = m.onFocus ? cleanPlaylistMinutes(m.playlistMinutes) : 0;
  return own && !FOCUS_MINUTES.includes(own) ? [...FOCUS_MINUTES, own].sort((a, b) => a - b) : [...FOCUS_MINUTES];
}

export const providerById = (id: string): MusicProvider =>
  MUSIC_PROVIDERS.find((p) => p.id === id) ?? MUSIC_PROVIDERS[0]!;

/** The provider a pasted https link belongs to, with the cleaned link; null if it is not a known player's link. */
export function parsePlaylist(input: string): { provider: MusicProvider; url: string } | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const provider = MUSIC_PROVIDERS.find((p) => p.hosts.includes(u.hostname.toLowerCase()));
  return provider ? { provider, url: u.toString() } : null;
}

/**
 * What to open for a config, shaped like a KnownApp so apps.openLink builds the
 * Android intent or website link. A playlist link wins, and picks its own
 * provider; an invalid or empty one falls back to the chosen provider's app.
 */
export function musicTarget(config: MusicConfig): KnownApp {
  const parsed = config.playlist ? parsePlaylist(config.playlist) : null;
  const provider = parsed?.provider ?? providerById(config.provider);
  return { id: provider.id, name: provider.name, words: [], url: parsed?.url ?? provider.home, androidPackage: provider.androidPackage };
}
