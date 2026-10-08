import { describe, expect, it, vi } from 'vitest';
import { browserVoice, followUp, sayAloud, type UtteranceLike } from './talk';

function fakeVoice(fire: 'end' | 'error' | 'never') {
  const spoken: string[] = [];
  const synth = {
    cancel: vi.fn(),
    speak: (u: unknown) => {
      const utt = u as UtteranceLike & { text: string };
      spoken.push(utt.text);
      if (fire === 'end') setTimeout(() => utt.onend?.(), 0);
      if (fire === 'error') setTimeout(() => utt.onerror?.(), 0);
    },
  };
  const make = (text: string) => ({ text, volume: 1, onend: null, onerror: null }) as UtteranceLike & { text: string };
  return { synth, make, spoken };
}

describe('followUp', () => {
  it('asks a different short question each turn and wraps around', () => {
    expect(followUp(1)).toBe('Anything else?');
    expect(followUp(2)).not.toBe(followUp(1));
    expect(followUp(4)).toBe(followUp(1));
    expect(followUp(0)).toBe('Anything else?');
  });
});

describe('sayAloud', () => {
  it('speaks the line at the given volume and resolves when it ends', async () => {
    const v = fakeVoice('end');
    await sayAloud('Got it, parked.', { synth: v.synth, make: v.make, volume: 0.5 });
    expect(v.spoken).toEqual(['Got it, parked.']);
    expect(v.synth.cancel).toHaveBeenCalled();
  });
  it('resolves on a speech error too', async () => {
    const v = fakeVoice('error');
    await expect(sayAloud('Hi', { synth: v.synth, make: v.make, volume: 1 })).resolves.toBeUndefined();
  });
  it('gives up waiting after the timeout when the browser never says it finished', async () => {
    const v = fakeVoice('never');
    await expect(sayAloud('Hi', { synth: v.synth, make: v.make, volume: 1, timeoutMs: 5 })).resolves.toBeUndefined();
  });
  it('says nothing when the volume is 0 or there is no voice', async () => {
    const v = fakeVoice('end');
    await sayAloud('Hi', { synth: v.synth, make: v.make, volume: 0 });
    await sayAloud('Hi', { synth: null, make: null, volume: 1 });
    expect(v.spoken).toEqual([]);
  });
});

describe('browserVoice', () => {
  it('returns nulls without speech synthesis', () => {
    expect(browserVoice({} as Window)).toEqual({ synth: null, make: null });
  });
});
