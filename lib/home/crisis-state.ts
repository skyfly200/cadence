/**
 * Device-only state for the crisis card (ticket 24): the country override and the time the
 * card was last shown, for a 24 hour cooldown. Nothing here is sent to the server or logged.
 * Plain localStorage, wrapped so a blocked store never breaks capture.
 */
import { countryFromLocale, resourcesFor, type ResourceSet } from '../domain/crisis';

const COUNTRY_KEY = 'cadence:crisisCountry';
const SHOWN_KEY = 'cadence:crisisShown';
export const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function read(key: string): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value);
  } catch { /* storage blocked */ }
}

/** The country the user chose in Settings, or null for "from this device". */
export function getCountryOverride(): string | null {
  const v = read(COUNTRY_KEY);
  return v && /^[A-Z]{2}$/.test(v) ? v : null;
}
export function setCountryOverride(code: string | null): void { write(COUNTRY_KEY, code); }

/** The help lines to show: the override, else the device locale, else the worldwide finder. */
export function currentResources(locale: string | readonly string[] | null = typeof navigator === 'undefined' ? null : navigator.languages): ResourceSet {
  return resourcesFor(getCountryOverride() ?? countryFromLocale(locale));
}

/** False for 24 hours after the card was last shown, so a repeat match never nags. */
export function shouldShowCard(now: Date = new Date()): boolean {
  const last = Number(read(SHOWN_KEY));
  return !(Number.isFinite(last) && last > 0 && now.getTime() - last < COOLDOWN_MS);
}
export function markCardShown(now: Date = new Date()): void { write(SHOWN_KEY, String(now.getTime())); }
