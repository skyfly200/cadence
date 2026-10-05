import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_VOLUME, addPlanningReviewed, finishPlanning, getDiscussDisclosed, getPlanningFinished, setDiscussDisclosed, getPlanningNudged, setPlanningNudged, getPlanningReminder, getPlanningReviewed, getRecapOn, getSoundOn, getVolume,
  greeting, setPlanningReminder, setRecapOn, setVolume, speechLevel, speechVolume, toneGain, toneLevel,
  addSlogDismissed, getDelightState, getEndOfDayOn, getTripsOn, getWelcomed, setWelcomed, getRewardPrefs, getSlogDismissed, setDelightState, setEndOfDayOn, setTripsOn, setRewardPref,
} from './prefs';

describe('volume', () => {
  it('defaults when storage is unavailable', () => {
    expect(getVolume('tone')).toBe(DEFAULT_VOLUME);
    expect(getVolume('speech')).toBe(DEFAULT_VOLUME);
    expect(() => setVolume('tone', 30)).not.toThrow();
    expect(getSoundOn('tone')).toBe(true);
    expect(toneLevel()).toBeGreaterThan(0);
    expect(speechLevel()).toBeGreaterThan(0);
  });

  it('maps the slider to a tone gain on an even curve, louder than the old fixed 0.05 by default', () => {
    expect(toneGain(0)).toBe(0);
    expect(toneGain(100)).toBeCloseTo(0.4);
    expect(toneGain(50)).toBeCloseTo(0.1);
    expect(toneGain(DEFAULT_VOLUME)).toBeGreaterThan(0.05);
    expect(toneGain(40)).toBeLessThan(toneGain(60));
  });

  it('maps the slider to speech volume 0 to 1', () => {
    expect(speechVolume(0)).toBe(0);
    expect(speechVolume(70)).toBeCloseTo(0.7);
    expect(speechVolume(100)).toBe(1);
  });
});

describe('discuss disclosure', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is not accepted until the person accepts it, then is remembered on this device', () => {
    const map = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) } });
    expect(getDiscussDisclosed()).toBe(false);
    setDiscussDisclosed(true);
    expect(getDiscussDisclosed()).toBe(true);
  });

  it('asks again when storage is blocked rather than assuming consent', () => {
    expect(getDiscussDisclosed()).toBe(false);
    expect(() => setDiscussDisclosed(true)).not.toThrow();
    expect(getDiscussDisclosed()).toBe(false);
  });
});

describe('planning prefs', () => {
  const stubStorage = () => {
    const map = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) } });
  };
  afterEach(() => vi.unstubAllGlobals());

  it('starts with nothing finished or reviewed, every recap off and the reminder off', () => {
    stubStorage();
    expect(getPlanningFinished()).toBeNull();
    expect(getPlanningReviewed()).toEqual([]);
    for (const k of ['week', 'month', 'quarter'] as const) expect(getRecapOn(k)).toBe(false);
    expect(getPlanningReminder()).toBe(false);
  });

  it('keeps progress between visits and clears it when a session is finished', () => {
    stubStorage();
    addPlanningReviewed('a');
    addPlanningReviewed('b');
    addPlanningReviewed('a');
    expect(getPlanningReviewed()).toEqual(['a', 'b']);
    finishPlanning(new Date('2026-10-02T12:00:00.000Z'));
    expect(getPlanningFinished()).toBe('2026-10-02T12:00:00.000Z');
    expect(getPlanningReviewed()).toEqual([]);
  });

  it('remembers the last planning invitation it showed', () => {
    stubStorage();
    expect(getPlanningNudged()).toBeNull();
    setPlanningNudged('planning|-|2026-09-28');
    expect(getPlanningNudged()).toBe('planning|-|2026-09-28');
  });

  it('remembers each recap and the reminder on their own', () => {
    stubStorage();
    setRecapOn('month', true);
    setPlanningReminder(true);
    expect([getRecapOn('week'), getRecapOn('month'), getRecapOn('quarter')]).toEqual([false, true, false]);
    expect(getPlanningReminder()).toBe(true);
    setPlanningReminder(false);
    expect(getPlanningReminder()).toBe(false);
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => { addPlanningReviewed('a'); finishPlanning(); setRecapOn('week', true); setPlanningReminder(true); }).not.toThrow();
    expect(getPlanningReviewed()).toEqual([]);
  });
});

describe('greeting', () => {
  const at = (h: number) => new Date(2026, 9, 3, h, 0);
  it('welcomes you back after days away, at any hour', () => {
    expect(greeting(true, at(9))).toBe('Welcome back.');
    expect(greeting(true, at(21))).toBe('Welcome back.');
  });
  it('otherwise greets by the time of day', () => {
    expect(greeting(false, at(8))).toBe('Good morning.');
    expect(greeting(false, at(13))).toBe('Good afternoon.');
    expect(greeting(false, at(19))).toBe('Good evening.');
    expect(greeting(false, at(2))).toBe('Good evening.');
  });
});

describe('reward preferences', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = () => {
    const map = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) } });
  };

  it('has coach lines, the tally and the tone on, and the end-of-day line off, when storage is unavailable', () => {
    expect(getRewardPrefs()).toEqual({ lines: true, tally: true, sound: true });
    expect(getEndOfDayOn()).toBe(false);
    expect(getDelightState()).toBeNull();
    expect(getSlogDismissed()).toEqual([]);
    expect(() => { setRewardPref('lines', false); setEndOfDayOn(true); addSlogDismissed('a'); }).not.toThrow();
  });

  it('remembers each toggle on its own', () => {
    stub();
    setRewardPref('tally', false);
    expect(getRewardPrefs()).toEqual({ lines: true, tally: false, sound: true });
    setRewardPref('sound', false);
    expect(getRewardPrefs()).toEqual({ lines: true, tally: false, sound: false });
    setEndOfDayOn(true);
    expect(getEndOfDayOn()).toBe(true);
  });

  it('remembers the first-run welcome, and shows it again when storage is blocked', () => {
    expect(getWelcomed()).toBe(false);
    stub();
    setWelcomed(true);
    expect(getWelcomed()).toBe(true);
    setWelcomed(false);
    expect(getWelcomed()).toBe(false);
  });

  it('keeps Trips and Map off until switched on', () => {
    expect(getTripsOn()).toBe(false);
    stub();
    expect(getTripsOn()).toBe(false);
    setTripsOn(true);
    expect(getTripsOn()).toBe(true);
  });

  it('keeps the delight state and the dismissed slog offers', () => {
    stub();
    setDelightState({ day: '2026-10-02', shown: 1 });
    expect(getDelightState()).toEqual({ day: '2026-10-02', shown: 1 });
    addSlogDismissed('a');
    addSlogDismissed('b');
    addSlogDismissed('a');
    expect(getSlogDismissed()).toEqual(['a', 'b']);
  });
});
