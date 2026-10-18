import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MEMORY_KEY, getMemories, saveMemories, type Memory } from './memory';
import { applyServerMemories, memoriesFromData, pushMemories } from './memory-sync';

const mem = (id: string, text: string, updatedAt = '2026-10-01T10:00:00.000Z'): Memory => ({
  id, text, origin: 'stated', private: false, createdAt: '2026-10-01T10:00:00.000Z', updatedAt,
});

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } });
});
afterEach(() => vi.unstubAllGlobals());

/** A cadence_kv stand-in that holds one memories row. */
function fakeKv(row: unknown) {
  const upserts: unknown[] = [];
  const chain = { eq: () => chain, maybeSingle: async () => ({ data: row === undefined ? null : { data: row }, error: null }) };
  const sb = { from: () => ({ select: () => chain, upsert: async (r: unknown) => { upserts.push(r); return { error: null }; } }) };
  return { sb: sb as unknown as SupabaseClient, upserts };
}

describe('memory sync', () => {
  it('reads only valid memories out of a kv row', () => {
    expect(memoriesFromData([mem('m1', 'a'), { nope: 1 }]).map((m) => m.id)).toEqual(['m1']);
    expect(memoriesFromData('x')).toEqual([]);
  });

  it('merges a pulled row into this device, ignoring other keys', () => {
    saveMemories([mem('m1', 'here')]);
    applyServerMemories([{ key: 'settings', data: {} }, { key: 'memories', data: [mem('m2', 'from the phone')] }]);
    expect(getMemories().map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it("pushes the merge of this device and the server's copy, so neither device loses a new memory", async () => {
    saveMemories([mem('m1', 'here')]);
    const { sb, upserts } = fakeKv([mem('m2', 'there')]);
    await pushMemories(sb, 'u1');
    expect(upserts).toEqual([{ user_id: 'u1', key: 'memories', data: [mem('m1', 'here'), mem('m2', 'there')] }]);
    expect(JSON.parse(store.get(MEMORY_KEY)!).map((m: Memory) => m.id)).toEqual(['m1', 'm2']);
  });

  it('writes nothing when neither side has memories', async () => {
    const { sb, upserts } = fakeKv(undefined);
    await pushMemories(sb, 'u1');
    expect(upserts).toEqual([]);
  });
});
