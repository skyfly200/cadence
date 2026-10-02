import { describe, expect, it, vi, beforeEach } from 'vitest';
import { syncNudgesToQueue } from './nudge-queue-sync';
import type { Nudge } from '~/lib/domain';

const now = new Date('2026-10-01T10:00:00.000Z');
const futureTime = new Date(now.getTime() + 60 * 60_000).toISOString();
const pastTime = new Date(now.getTime() - 60 * 60_000).toISOString();

const nudge = (id: string, fireAt: string): Nudge => ({
  id,
  kind: 'leave_by',
  nodeId: 'node1',
  day: '2026-10-01',
  fireAt,
  dropAfter: new Date(new Date(fireAt).getTime() + 30 * 60_000).toISOString(),
  title: 'Test nudge',
  body: 'Test body',
  tag: id,
});

describe('syncNudgesToQueue', () => {
  let mockSupabase: any;
  let mockUpsert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user123' } },
        }),
      },
      from: vi.fn((table) => ({
        upsert: mockUpsert,
      })),
    };
  });

  it('returns false if supabase is null', async () => {
    const result = await syncNudgesToQueue([nudge('n1', futureTime)], null);
    expect(result).toBe(false);
  });

  it('returns false if not signed in', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await syncNudgesToQueue([nudge('n1', futureTime)], mockSupabase, now);
    expect(result).toBe(false);
  });

  it('returns false if no future nudges', async () => {
    const result = await syncNudgesToQueue([nudge('n1', pastTime)], mockSupabase, now);
    expect(result).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('syncs future nudges to nudge_queue', async () => {
    const nudges = [
      nudge('n1', futureTime),
      nudge('n2', new Date(now.getTime() + 120 * 60_000).toISOString()),
    ];
    const result = await syncNudgesToQueue(nudges, mockSupabase, now);

    expect(result).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'n1', kind: 'leave_by', title: 'Test nudge' }),
        expect.objectContaining({ id: 'n2', kind: 'leave_by', title: 'Test nudge' }),
      ]),
      expect.objectContaining({ onConflict: 'user_id,id', ignoreDuplicates: true })
    );
  });

  it('queues the weekly planning invitation under its own kind and week id', async () => {
    const planning: Nudge = { ...nudge('planning|-|2026-09-28', futureTime), kind: 'planning', nodeId: null, title: 'A five-minute plan for the week' };
    expect(await syncNudgesToQueue([planning], mockSupabase, now)).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'planning|-|2026-09-28', kind: 'planning' })],
      expect.objectContaining({ onConflict: 'user_id,id', ignoreDuplicates: true }),
    );
  });

  it('filters out past nudges', async () => {
    const nudges = [nudge('n1', futureTime), nudge('n2', pastTime)];
    await syncNudgesToQueue(nudges, mockSupabase, now);

    const callArgs = mockUpsert.mock.calls[0];
    expect(callArgs[0]).toHaveLength(1);
    expect(callArgs[0][0].id).toBe('n1');
  });

  it('skips sync if id set has not changed', async () => {
    const nudges = [nudge('n1', futureTime)];
    const lastSyncedIds = new Set(['n1']);

    const result = await syncNudgesToQueue(nudges, mockSupabase, now, lastSyncedIds);

    expect(result).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('syncs when new nudges are added', async () => {
    const nudges = [nudge('n1', futureTime), nudge('n2', new Date(now.getTime() + 120 * 60_000).toISOString())];
    const lastSyncedIds = new Set(['n1']);

    const result = await syncNudgesToQueue(nudges, mockSupabase, now, lastSyncedIds);

    expect(result).toBe(true);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('syncs when nudges are removed', async () => {
    const nudges = [nudge('n1', futureTime)];
    const lastSyncedIds = new Set(['n1', 'n2']);

    const result = await syncNudgesToQueue(nudges, mockSupabase, now, lastSyncedIds);

    expect(result).toBe(true);
  });

  it('handles upsert errors gracefully', async () => {
    mockUpsert.mockResolvedValueOnce({ error: new Error('DB error') });
    const nudges = [nudge('n1', futureTime)];

    const result = await syncNudgesToQueue(nudges, mockSupabase, now);

    expect(result).toBe(false);
  });

  it('does not include user_id in the row body', async () => {
    const nudges = [nudge('n1', futureTime)];
    await syncNudgesToQueue(nudges, mockSupabase, now);

    const callArgs = mockUpsert.mock.calls[0];
    const row = callArgs[0][0];
    expect(row).not.toHaveProperty('user_id');
    expect(row).toEqual(
      expect.objectContaining({
        id: 'n1',
        kind: 'leave_by',
        title: 'Test nudge',
        body: 'Test body',
        tag: 'n1',
        fire_at: futureTime,
      })
    );
  });
});
