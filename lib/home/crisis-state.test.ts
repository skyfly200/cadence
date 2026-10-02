import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COOLDOWN_MS, currentResources, getCountryOverride, markCardShown, setCountryOverride, shouldShowCard } from './crisis-state';

function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

beforeEach(() => { vi.stubGlobal('window', { localStorage: fakeStorage() }); });
afterEach(() => vi.unstubAllGlobals());

const T0 = new Date(Date.UTC(2026, 9, 1, 12, 0, 0));

describe('cooldown', () => {
  it('shows the card the first time', () => {
    expect(shouldShowCard(T0)).toBe(true);
  });
  it('holds it back for 24 hours, then allows it again', () => {
    markCardShown(T0);
    expect(shouldShowCard(new Date(T0.getTime() + COOLDOWN_MS - 1))).toBe(false);
    expect(shouldShowCard(new Date(T0.getTime() + COOLDOWN_MS))).toBe(true);
  });
  it('shows the card when storage is blocked', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('window', { localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked } });
    expect(() => markCardShown(T0)).not.toThrow();
    expect(shouldShowCard(T0)).toBe(true);
  });
});

describe('country', () => {
  it('uses the device locale until the user chooses', () => {
    expect(currentResources(['en-AU']).country).toBe('AU');
    expect(currentResources(['en']).country).toBeNull();
  });
  it('prefers the Settings override and can clear it', () => {
    setCountryOverride('GB');
    expect(getCountryOverride()).toBe('GB');
    expect(currentResources(['en-US']).country).toBe('GB');
    setCountryOverride(null);
    expect(getCountryOverride()).toBeNull();
    expect(currentResources(['en-US']).country).toBe('US');
  });
  it('ignores a malformed stored value', () => {
    window.localStorage.setItem('cadence:crisisCountry', 'not a code');
    expect(getCountryOverride()).toBeNull();
  });
});
