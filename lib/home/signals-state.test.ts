import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EVENT_CAP, answeredCheckpoints, feelingFor, getEvents, getExperiment, getSignalsOn, markCheckpointAnswered,
  recordNudge, recordSetting, setExperiment, setFeeling, setSignalsOn,
} from './signals-state';

function fakeStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

beforeEach(() => { vi.stubGlobal('window', { localStorage: fakeStorage() }); });
afterEach(() => vi.unstubAllGlobals());

const T0 = new Date(Date.UTC(2026, 9, 1, 12, 0, 0));

describe('signals switch', () => {
  it('is off until switched on', () => {
    expect(getSignalsOn()).toBe(false);
    setSignalsOn(true);
    expect(getSignalsOn()).toBe(true);
  });
});

describe('event history', () => {
  it('records setting switches and nudge events in order', () => {
    recordSetting('sound:speech', false, T0);
    recordNudge('leave_by', 'not_now', T0);
    expect(getEvents()).toEqual([
      { type: 'setting', at: T0.toISOString(), key: 'sound:speech', on: false },
      { type: 'nudge', at: T0.toISOString(), kind: 'leave_by', action: 'not_now' },
    ]);
  });
  it('does not record a switch to the state it is already in', () => {
    recordSetting('k', true, T0);
    recordSetting('k', true, new Date(T0.getTime() + 1000));
    recordSetting('k', false, new Date(T0.getTime() + 2000));
    expect(getEvents().map((e) => e.type === 'setting' && e.on)).toEqual([true, false]);
  });
  it('keeps only the newest events', () => {
    for (let i = 0; i < EVENT_CAP + 5; i++) recordNudge('leave_by', 'shown', new Date(T0.getTime() + i));
    const events = getEvents();
    expect(events).toHaveLength(EVENT_CAP);
    expect(events[events.length - 1]!.at).toBe(new Date(T0.getTime() + EVENT_CAP + 4).toISOString());
  });
  it('ignores a corrupt store', () => {
    window.localStorage.setItem('cadence:signalsEvents', '{not json');
    expect(getEvents()).toEqual([]);
  });
});

describe('feeling, checkpoints, experiment', () => {
  it('stores one feeling per week, replacing an earlier one', () => {
    expect(feelingFor('2026-09-28')).toBeNull();
    setFeeling('2026-09-28', 'heavier', T0);
    setFeeling('2026-09-28', 'lighter', T0);
    expect(feelingFor('2026-09-28')).toBe('lighter');
    expect(feelingFor('2026-10-05')).toBeNull();
  });
  it('remembers answered checkpoints once each', () => {
    markCheckpointAnswered(2);
    markCheckpointAnswered(2);
    markCheckpointAnswered(4);
    expect(answeredCheckpoints()).toEqual([2, 4]);
  });
  it('holds one experiment until cleared', () => {
    expect(getExperiment()).toBeNull();
    setExperiment({ key: 'sound:speech', startedAt: T0.toISOString(), turnedOn: false });
    expect(getExperiment()).toEqual({ key: 'sound:speech', startedAt: T0.toISOString(), turnedOn: false });
    setExperiment(null);
    expect(getExperiment()).toBeNull();
  });
});

describe('blocked storage', () => {
  it('never throws', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('window', { localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked } });
    expect(() => { recordSetting('k', true, T0); recordNudge('x', 'shown', T0); setSignalsOn(true); setFeeling('w', 'same'); }).not.toThrow();
    expect(getEvents()).toEqual([]);
    expect(getSignalsOn()).toBe(false);
  });
});
