import { describe, expect, it } from 'vitest';
import { DEFAULT_VOLUME, getSoundOn, greeting, getVolume, setVolume, speechLevel, speechVolume, toneGain, toneLevel } from './prefs';

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
