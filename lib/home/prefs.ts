/**
 * Small per-device preferences for the new Home: display density and the last
 * time the app was opened (to show the warm "welcome back" greeting after a
 * break). Plain localStorage, wrapped so a blocked store never breaks Home.
 */
export type Density = 0 | 1 | 2; // Simple, Balanced (default), Rich

const DENSITY_KEY = 'cadence:homeDensity';
const OPENED_KEY = 'cadence:homeLastOpened';
const AWAY_AFTER_MS = 24 * 60 * 60 * 1000;

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

/** True if the app has not been opened for a day or more (never on the very first open). */
export function wasAway(now: Date = new Date()): boolean {
  const last = Number(read(OPENED_KEY));
  return Number.isFinite(last) && last > 0 && now.getTime() - last >= AWAY_AFTER_MS;
}
export function markOpened(now: Date = new Date()): void { write(OPENED_KEY, String(now.getTime())); }

const MENTIONED_KEY = 'cadence:habitMentioned';
/** Habit period windows already given their one final-stretch mention, as `habitId|windowKey`. */
export function getMentioned(): string[] {
  try { const v = JSON.parse(read(MENTIONED_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}
export function addMentioned(keys: string[]): void { write(MENTIONED_KEY, JSON.stringify([...new Set([...getMentioned(), ...keys])].slice(-200))); }

const VOLUME_KEY = 'cadence:nudgeVolume';
export const DEFAULT_VOLUME = 70;
/** Nudge and cue loudness, 0 to 100 (per device). The mute switch is separate. */
export function getVolume(): number {
  const raw = read(VOLUME_KEY);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : DEFAULT_VOLUME;
}
export function setVolume(v: number): void { write(VOLUME_KEY, String(Math.min(100, Math.max(0, Math.round(v))))); }
/** Peak gain of the soft tone: a squared curve so the slider feels even; 100 is 0.4. */
export function toneGain(volume: number): number { return 0.4 * (volume / 100) ** 2; }
/** SpeechSynthesisUtterance.volume (0 to 1). */
export function speechVolume(volume: number): number { return volume / 100; }
