import { describe, expect, it } from 'vitest';
import { occ } from '../domain/test-helpers';
import { RITUAL_MS, SLOG_OFFER_AT, postponeCount, ritualClock, ritualState, shouldOfferSlog } from './slog';

const moved = (id: string, extra = {}) => occ('moved', '2026-10-02T09:00:00Z', { id, nodeId: 'n1', ...extra });
const parked = (id: string, extra = {}) => occ('parked', '2026-10-02T09:30:00Z', { id, nodeId: 'n1', ...extra });

describe('postponeCount', () => {
  it('counts Not now and parked on that item only', () => {
    const occs = [moved('a'), parked('b'), moved('c', { nodeId: 'other' }), occ('done', '2026-10-02T10:00:00Z', { id: 'd', nodeId: 'n1' })];
    expect(postponeCount('n1', occs)).toBe(2);
  });

  it('does not count a postponement that was undone', () => {
    const occs = [moved('a'), parked('b'), occ('undone', '2026-10-02T10:00:00Z', { id: 'u', nodeId: 'n1', undoes: 'b' })];
    expect(postponeCount('n1', occs)).toBe(1);
  });
});

describe('shouldOfferSlog', () => {
  const three = [moved('a'), moved('b'), parked('c')];

  it('offers once an untagged item has been put off enough', () => {
    expect(SLOG_OFFER_AT).toBe(3);
    expect(shouldOfferSlog('n1', false, three, [])).toBe(true);
    expect(shouldOfferSlog('n1', false, three.slice(0, 2), [])).toBe(false);
  });

  it('does not offer for an item already tagged, or one the user said no to', () => {
    expect(shouldOfferSlog('n1', true, three, [])).toBe(false);
    expect(shouldOfferSlog('n1', false, three, ['n1'])).toBe(false);
  });
});

describe('the two-minute ritual', () => {
  const t0 = Date.UTC(2026, 9, 2, 12, 0, 0);

  it('counts down and then says the two minutes are up', () => {
    expect(ritualState(t0, t0)).toEqual({ remainingSec: 120, over: false });
    expect(ritualState(t0, t0 + 30_500)).toEqual({ remainingSec: 90, over: false });
    expect(ritualState(t0, t0 + RITUAL_MS)).toEqual({ remainingSec: 0, over: true });
    expect(ritualState(t0, t0 + RITUAL_MS + 60_000)).toEqual({ remainingSec: 0, over: true });
  });

  it('never goes negative when the clock is behind', () => {
    expect(ritualState(t0, t0 - 5000).remainingSec).toBe(120);
  });

  it('formats m:ss', () => {
    expect(ritualClock(120)).toBe('2:00');
    expect(ritualClock(65)).toBe('1:05');
    expect(ritualClock(0)).toBe('0:00');
  });
});
