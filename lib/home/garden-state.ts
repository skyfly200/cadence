/**
 * Device-only state for the Garden: the pressed pages (so a page survives even if the habit or
 * goal on it is later deleted) and the "gentle motion" choice. Plain localStorage, wrapped so a
 * blocked store never breaks Home. Nothing here is sent to the server.
 */
import type { PressedSeason } from '../domain/garden';

const BOOK_KEY = 'cadence:pressedBook';
const MOTION_KEY = 'cadence:gardenMotion';
const MAX_PAGES = 200;

function read(key: string): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

const isPage = (v: unknown): v is PressedSeason => {
  const p = v as PressedSeason;
  return !!p && typeof p.key === 'string' && typeof p.name === 'string' && typeof p.year === 'number' && typeof p.kept === 'number'
    && Array.isArray(p.plants) && p.plants.every((x) => x && typeof x.nodeId === 'string' && typeof x.title === 'string' && typeof x.kind === 'string');
};

/** The pressed pages kept on this device. */
export function getPressedPages(): PressedSeason[] {
  try {
    const v = JSON.parse(read(BOOK_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter(isPage) : [];
  } catch { return []; }
}

/** Keep newly pressed pages; a page already kept is never replaced. */
export function savePressedPages(fresh: readonly PressedSeason[]): void {
  if (!fresh.length) return;
  const have = getPressedPages();
  const keys = new Set(have.map((p) => p.key));
  write(BOOK_KEY, JSON.stringify([...have, ...fresh.filter((p) => !keys.has(p.key))].slice(-MAX_PAGES)));
}

const DRAFT_KEY = 'cadence:pressedDraft';

/** The rolling page for the season in progress, replaced on every open; it becomes a real page when the season turns. */
export function getSeasonDraft(): PressedSeason | undefined {
  try { const v = JSON.parse(read(DRAFT_KEY) ?? 'null'); return isPage(v) ? v : undefined; } catch { return undefined; }
}
export function saveSeasonDraft(page: PressedSeason | null): void { write(DRAFT_KEY, JSON.stringify(page)); }

/** Slow shimmer in the dark garden: off unless switched on (and never when the device asks for less motion). */
export function getGardenMotion(): boolean { return read(MOTION_KEY) === 'true'; }
export function setGardenMotion(on: boolean): void { write(MOTION_KEY, String(on)); }
