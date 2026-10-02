import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PressedSeason } from '../domain/garden';
import { getGardenMotion, getHemisphereChoice, getPressedPages, getSeasonDraft, replacePressedPages, resolveHemisphere, savePressedPages, saveSeasonDraft, setGardenMotion, setHemisphereChoice } from './garden-state';

const page = (key: string, title = 'Walk'): PressedSeason => ({
  key, name: 'Summer', year: 2026, kept: 4, plants: [{ nodeId: 'h1', title, kind: 'sprout', stage: 1, count: 2 }],
});

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } });
});
afterEach(() => vi.unstubAllGlobals());

describe('pressed pages', () => {
  it('starts empty and keeps what is saved', () => {
    expect(getPressedPages()).toEqual([]);
    savePressedPages([page('quarter:2026-07-01')]);
    expect(getPressedPages()).toEqual([page('quarter:2026-07-01')]);
  });

  it('never replaces a page already kept', () => {
    savePressedPages([page('quarter:2026-07-01', 'Walk')]);
    savePressedPages([page('quarter:2026-07-01', 'Changed'), page('quarter:2026-04-01')]);
    const pages = getPressedPages();
    expect(pages.map((p) => p.key)).toEqual(['quarter:2026-07-01', 'quarter:2026-04-01']);
    expect(pages[0]!.plants[0]!.title).toBe('Walk');
  });

  it('ignores damaged storage', () => {
    store.set('cadence:pressedBook', '{not json');
    expect(getPressedPages()).toEqual([]);
    store.set('cadence:pressedBook', JSON.stringify([{ key: 1 }, page('quarter:2026-07-01')]));
    expect(getPressedPages()).toEqual([page('quarter:2026-07-01')]);
  });

  it('survives blocked storage', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } });
    expect(getPressedPages()).toEqual([]);
    expect(() => savePressedPages([page('quarter:2026-07-01')])).not.toThrow();
    expect(getGardenMotion()).toBe(false);
  });
});

describe('season draft', () => {
  it('keeps one rolling page and ignores damaged data', () => {
    expect(getSeasonDraft()).toBeUndefined();
    saveSeasonDraft(page('quarter:2026-10-01'));
    expect(getSeasonDraft()).toEqual(page('quarter:2026-10-01'));
    saveSeasonDraft(page('quarter:2026-10-01', 'Later'));
    expect(getSeasonDraft()!.plants[0]!.title).toBe('Later');
    store.set('cadence:pressedDraft', '[1]');
    expect(getSeasonDraft()).toBeUndefined();
  });
});

describe('garden motion', () => {
  it('is off by default and remembers the choice', () => {
    expect(getGardenMotion()).toBe(false);
    setGardenMotion(true);
    expect(getGardenMotion()).toBe(true);
    setGardenMotion(false);
    expect(getGardenMotion()).toBe(false);
  });
});

describe('replacePressedPages', () => {
  it('replaces the whole book', () => {
    savePressedPages([page('quarter:2026-07-01')]);
    replacePressedPages([page('quarter:2026-04-01'), page('quarter:2026-01-01')]);
    expect(getPressedPages().map((p) => p.key)).toEqual(['quarter:2026-04-01', 'quarter:2026-01-01']);
  });
});

describe('hemisphere choice', () => {
  it('is automatic until chosen, and then follows the choice', () => {
    expect(getHemisphereChoice()).toBe('auto');
    expect(resolveHemisphere('auto', 'Australia/Sydney')).toBe('south');
    expect(resolveHemisphere('auto', 'Europe/Paris')).toBe('north');
    setHemisphereChoice('south');
    expect(getHemisphereChoice()).toBe('south');
    expect(resolveHemisphere(getHemisphereChoice(), 'Europe/Paris')).toBe('south');
    setHemisphereChoice('auto');
    expect(getHemisphereChoice()).toBe('auto');
  });

  it('ignores a stored value it does not know', () => {
    store.set('cadence:hemisphere', 'sideways');
    expect(getHemisphereChoice()).toBe('auto');
  });
});
