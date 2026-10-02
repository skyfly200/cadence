import { describe, expect, it } from 'vitest';
import { DEFAULT_VOLUME, getVolume, setVolume, speechVolume, toneGain } from './prefs';

describe('volume', () => {
  it('defaults when storage is unavailable', () => {
    expect(getVolume()).toBe(DEFAULT_VOLUME);
    expect(() => setVolume(30)).not.toThrow();
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
