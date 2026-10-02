import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PressedSeason } from '../domain/garden';
import { getPressedPages, savePressedPages } from './garden-state';
import { applyServerPages, mergeServerPages, pagesFromKv, pressedKey, pressedRows, pushPressed } from './pressed-sync';

const page = (key: string, title = 'Walk'): PressedSeason => ({
  key, name: 'Summer', year: 2026, kept: 4, plants: [{ nodeId: 'h1', title, kind: 'sprout', stage: 1, count: 2 }],
});

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } });
});
afterEach(() => vi.unstubAllGlobals());

describe('rows', () => {
  it('keys each page by its season', () => {
    expect(pressedKey(page('quarter:2026-07-01'))).toBe('pressed:quarter:2026-07-01');
    expect(pressedRows('u1', [page('quarter:2026-07-01')])).toEqual([{ user_id: 'u1', key: 'pressed:quarter:2026-07-01', data: page('quarter:2026-07-01') }]);
  });

  it('reads only valid pressed pages out of kv rows', () => {
    const rows = [
      { key: 'pressed:quarter:2026-07-01', data: page('quarter:2026-07-01') },
      { key: 'settings', data: { a: 1 } },
      { key: 'pressed:quarter:2026-04-01', data: { not: 'a page' } },
    ];
    expect(pagesFromKv(rows).map((p) => p.key)).toEqual(['quarter:2026-07-01']);
  });
});

describe('merging', () => {
  it('lets the server page win for a season both have, and adds the rest', () => {
    const merged = mergeServerPages([page('quarter:2026-07-01', 'Local'), page('quarter:2026-01-01')], [page('quarter:2026-07-01', 'Server'), page('quarter:2026-04-01')]);
    expect(merged.map((p) => p.key).sort()).toEqual(['quarter:2026-01-01', 'quarter:2026-04-01', 'quarter:2026-07-01']);
    expect(merged.find((p) => p.key === 'quarter:2026-07-01')!.plants[0]!.title).toBe('Server');
  });

  it('applies server pages to the local book and leaves it alone when there are none', () => {
    savePressedPages([page('quarter:2026-01-01')]);
    applyServerPages([{ key: 'settings', data: {} }]);
    expect(getPressedPages().map((p) => p.key)).toEqual(['quarter:2026-01-01']);
    applyServerPages([{ key: 'pressed:quarter:2026-04-01', data: page('quarter:2026-04-01') }]);
    expect(getPressedPages().map((p) => p.key).sort()).toEqual(['quarter:2026-01-01', 'quarter:2026-04-01']);
  });
});

describe('pushPressed', () => {
  const fakeClient = (error: unknown = null) => {
    const calls: { table: string; rows: unknown; opts: unknown }[] = [];
    const sb = { from: (table: string) => ({ upsert: async (rows: unknown, opts: unknown) => { calls.push({ table, rows, opts }); return { error }; } }) } as unknown as SupabaseClient;
    return { sb, calls };
  };

  it("pushes this device's pages without overwriting a season already on the server", async () => {
    savePressedPages([page('quarter:2026-07-01'), page('quarter:2026-04-01')]);
    const { sb, calls } = fakeClient();
    await pushPressed(sb, 'u1');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.table).toBe('cadence_kv');
    expect(calls[0]!.opts).toEqual({ onConflict: 'user_id,key', ignoreDuplicates: true });
    expect((calls[0]!.rows as { key: string }[]).map((r) => r.key)).toEqual(['pressed:quarter:2026-07-01', 'pressed:quarter:2026-04-01']);
  });

  it('does nothing with an empty book and raises a failed write', async () => {
    const empty = fakeClient();
    await pushPressed(empty.sb, 'u1');
    expect(empty.calls).toHaveLength(0);
    savePressedPages([page('quarter:2026-07-01')]);
    await expect(pushPressed(fakeClient({ message: 'boom' }).sb, 'u1')).rejects.toBeTruthy();
  });
});
