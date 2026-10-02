import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPERIMENTAL, MECHANISMS, mechanismByKey } from './signals-mechanisms';
import { getEvents } from './signals-state';

function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

beforeEach(() => { vi.stubGlobal('window', { localStorage: fakeStorage() }); });
afterEach(() => vi.unstubAllGlobals());

describe('mechanisms', () => {
  it('has unique keys and covers every nudge type as report-only', () => {
    const keys = MECHANISMS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ['nudge:leave_by', 'nudge:at_risk', 'nudge:transition', 'nudge:habit_summary']) {
      const m = mechanismByKey(k)!;
      expect(m.nudgeKind).toBe(k.slice('nudge:'.length));
      expect(m.set).toBeUndefined();
    }
  });

  it('only the per-device switches can be flipped by an experiment', () => {
    expect(EXPERIMENTAL.map((m) => m.key)).toEqual(['sound:speech', 'sound:tone', 'recap:week', 'recap:month', 'recap:quarter', 'planning_reminder']);
  });

  it('reads defaults, flips through the real setters, and records the switch in the history', () => {
    const speech = mechanismByKey('sound:speech')!;
    const recap = mechanismByKey('recap:week')!;
    expect([speech.isOn!(), recap.isOn!()]).toEqual([true, false]);
    speech.set!(false);
    recap.set!(true);
    expect([speech.isOn!(), recap.isOn!()]).toEqual([false, true]);
    expect(getEvents().map((e) => e.type === 'setting' && [e.key, e.on])).toEqual([['sound:speech', false], ['recap:week', true]]);
  });
});
