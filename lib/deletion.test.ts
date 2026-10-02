import { describe, expect, it } from 'vitest';
import { deletionHold, deletionSyncPlan } from './deletion';

const row = (purged: string | null) => ({ requested_at: '2026-10-01T00:00:00Z', purged_at: purged });

describe('deletionSyncPlan', () => {
  it('proceeds when nothing was ever requested', () => {
    expect(deletionSyncPlan(null, null)).toEqual({ wipe: false, hold: false, acknowledge: null });
  });
  it('wipes and holds while a request is pending', () => {
    expect(deletionSyncPlan(row(null), null)).toEqual({ wipe: true, hold: true, acknowledge: null });
  });
  it('wipes once after a purge this device has not seen, then carries on', () => {
    expect(deletionSyncPlan(row('2026-10-08T00:00:00Z'), null)).toEqual({ wipe: true, hold: false, acknowledge: '2026-10-08T00:00:00Z' });
    expect(deletionSyncPlan(row('2026-10-08T00:00:00Z'), '2026-10-08T00:00:00Z')).toEqual({ wipe: false, hold: false, acknowledge: null });
  });
});

describe('deletionHold', () => {
  const sb = (result: { data: unknown; error: unknown }) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }),
  }) as never;
  it('holds sync while a request is pending', async () => {
    expect(await deletionHold(sb({ data: row(null), error: null }), 'u1')).toBe(true);
  });
  it('lets sync proceed when there is no request or the check fails', async () => {
    expect(await deletionHold(sb({ data: null, error: null }), 'u1')).toBe(false);
    expect(await deletionHold(sb({ data: null, error: new Error('x') }), 'u1')).toBe(false);
  });
});
