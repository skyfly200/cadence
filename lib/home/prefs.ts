/**
 * Small per-device preferences for the new Home: display density and the last
 * time the app was opened (to show the warm "welcome back" greeting after a
 * break). Plain localStorage, wrapped so a blocked store never breaks Home.
 */
import type { TimeFormat } from '~/lib/domain/clock';
import { DEFAULT_MUSIC, providerById, type MusicConfig } from './music';

export type Density = 0 | 1 | 2; // Simple, Balanced (default), Rich

const DENSITY_KEY = 'cadence:homeDensity';
const OPENED_KEY = 'cadence:homeLastOpened';
const AWAY_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

function read(key: string): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

export function getDensity(): Density {
  const v = Number(read(DENSITY_KEY));
  return v === 0 || v === 1 || v === 2 ? v : 1;
}
export function setDensity(d: Density): void { write(DENSITY_KEY, String(d)); }

/** True if the app has not been opened for two days or more (never on the very first open). */
export function wasAway(now: Date = new Date()): boolean {
  const last = Number(read(OPENED_KEY));
  return Number.isFinite(last) && last > 0 && now.getTime() - last >= AWAY_AFTER_MS;
}
/** The header greeting: "Welcome back." after days away, otherwise by the hour of the day. */
export function greeting(away: boolean, now: Date = new Date()): string {
  if (away) return 'Welcome back.';
  const h = now.getHours();
  return h >= 5 && h < 12 ? 'Good morning.' : h >= 12 && h < 17 ? 'Good afternoon.' : 'Good evening.';
}
export function markOpened(now: Date = new Date()): void { write(OPENED_KEY, String(now.getTime())); }

const MENTIONED_KEY = 'cadence:habitMentioned';
/** Habit period windows already given their one final-stretch mention, as `habitId|windowKey`. */
export function getMentioned(): string[] {
  try { const v = JSON.parse(read(MENTIONED_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}
export function addMentioned(keys: string[]): void { write(MENTIONED_KEY, JSON.stringify([...new Set([...getMentioned(), ...keys])].slice(-200))); }

const LEGACY_VOLUME_KEY = 'cadence:nudgeVolume';
export const DEFAULT_VOLUME = 70;
export type SoundKind = 'tone' | 'speech';
const volumeKey = (k: SoundKind) => `cadence:${k}Volume`;
const onKey = (k: SoundKind) => `cadence:${k}On`;

/** Loudness of the tone or the speech, 0 to 100 (per device). The mute switch is separate. */
export function getVolume(kind: SoundKind): number {
  const raw = read(volumeKey(kind)) ?? read(LEGACY_VOLUME_KEY);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : DEFAULT_VOLUME;
}
export function setVolume(kind: SoundKind, v: number): void { write(volumeKey(kind), String(Math.min(100, Math.max(0, Math.round(v))))); }
/** Tone and speech can each be switched off on their own. On by default. */
export function getSoundOn(kind: SoundKind): boolean { return read(onKey(kind)) !== 'false'; }
export function setSoundOn(kind: SoundKind, on: boolean): void { write(onKey(kind), String(on)); }
/** Peak gain of the soft tone: a squared curve so the slider feels even; 100 is 0.4. */
export function toneGain(volume: number): number { return 0.4 * (volume / 100) ** 2; }
/** SpeechSynthesisUtterance.volume (0 to 1). */
export function speechVolume(volume: number): number { return volume / 100; }

const TIME_FORMAT_KEY = 'cadence:timeFormat';
/** 12 or 24 hour clock; until chosen, whatever this device's locale uses. */
export function getTimeFormat(): TimeFormat {
  const v = read(TIME_FORMAT_KEY);
  if (v === '12' || v === '24') return v;
  try { return new Intl.DateTimeFormat([], { hour: 'numeric' }).resolvedOptions().hour12 === false ? '24' : '12'; } catch { return '12'; }
}
export function setTimeFormat(f: TimeFormat): void { write(TIME_FORMAT_KEY, f); }
/** What to play right now: the tone's peak gain and the speech volume, each 0 when switched off. */
export function toneLevel(): number { return getSoundOn('tone') ? toneGain(getVolume('tone')) : 0; }
export function speechLevel(): number { return getSoundOn('speech') ? speechVolume(getVolume('speech')) : 0; }

const MUSIC_KEY = 'cadence:music';
/** Music for focus sessions: provider, playlist link and whether to open it on start (per device). */
export function getMusic(): MusicConfig {
  try {
    const v = JSON.parse(read(MUSIC_KEY) ?? 'null');
    if (v && typeof v === 'object') {
      return {
        provider: providerById(String(v.provider)).id,
        playlist: typeof v.playlist === 'string' ? v.playlist : '',
        onFocus: v.onFocus === true,
      };
    }
  } catch { /* fall through */ }
  return { ...DEFAULT_MUSIC };
}
export function setMusic(m: MusicConfig): void { write(MUSIC_KEY, JSON.stringify(m)); }
