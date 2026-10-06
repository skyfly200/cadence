import { describe, expect, it, vi } from 'vitest';
import { createMemoryAiStore, type AiProvider } from './ai';
import { createSupabaseHeapLookup, handleHeap, parseHeapAnswer, type HeapLookup, type HeapNode } from './heap-ai';

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);
const provider = (text: string) => ({ complete: vi.fn(async () => text) }) satisfies AiProvider;
const NODES: HeapNode[] = [
  { id: 'a', title: 'Buy a gift for Laya', private: false },
  { id: 'b', title: 'Call the school about Jev', private: false },
  { id: 'p', title: 'Secret thing', private: true },
];
const lookup = (nodes: HeapNode[] = NODES): HeapLookup & { findMany: ReturnType<typeof vi.fn> } => ({ findMany: vi.fn(async (_u: string, ids: readonly string[]) => nodes.filter((n) => ids.includes(n.id))) });
const send = (p: AiProvider | null, body: unknown, store = createMemoryAiStore(), nodes: HeapLookup = lookup(), dailyCap?: number) =>
  handleHeap({ ai: { provider: p, store, now: () => T0, dailyCap }, nodes }, { userId: 'u1', body });
const GOOD = JSON.stringify({ items: [{ id: 'a', tag: 'laya', minutes: 45, after: 'b' }, { id: 'b', tag: 'Jev', minutes: 10, after: null }], first: ['b'] });

describe('parseHeapAnswer', () => {
  it('keeps tags from the list (case-insensitively), clamps minutes, and drops unknown ids and self-links', () => {
    const a = parseHeapAnswer(`Sure! ${JSON.stringify({
      items: [{ id: 'a', tag: 'LAYA', minutes: 2, after: 'a' }, { id: 'b', tag: 'Work', minutes: 9999, after: 'zzz' }, { id: 'nope', tag: 'Jev', minutes: 5 }, { id: 'a', tag: 'Jev' }],
      first: ['b', 'zzz', 'b'],
    })}`, ['a', 'b'], ['Jev', 'Laya']);
    expect(a).toEqual({
      items: [{ id: 'a', category: 'Laya', minutes: 5, requires: null }, { id: 'b', category: null, minutes: 480, requires: null }],
      first: ['b'],
    });
  });
  it('is null for anything that is not the expected JSON', () => {
    expect(parseHeapAnswer('no json here', ['a'], [])).toBeNull();
    expect(parseHeapAnswer('{"items": 3}', ['a'], [])).toBeNull();
    expect(parseHeapAnswer('{bad json}', ['a'], [])).toBeNull();
  });
});

describe('handleHeap', () => {
  it('answers with checked advice and records the use', async () => {
    const store = createMemoryAiStore();
    const r = await send(provider(GOOD), { ids: ['a', 'b'], tags: ['Jev', 'Laya'] }, store);
    expect(r).toEqual({ status: 200, body: { ok: true, items: [
      { id: 'a', category: 'Laya', minutes: 45, requires: 'b' }, { id: 'b', category: 'Jev', minutes: 10, requires: null },
    ], first: ['b'] } });
    expect(store.uses).toHaveLength(1);
  });

  it('never sends a Private item or an unknown one to the provider, and tells the model the titles are data', async () => {
    const p = provider(GOOD);
    await send(p, { ids: ['a', 'p', 'ghost'], tags: [] });
    const req = p.complete.mock.calls[0]![0] as { prompt: string; system: string };
    expect(req.prompt).toContain('Buy a gift for Laya');
    expect(req.prompt).not.toContain('Secret thing');
    expect(req.prompt).not.toContain('ghost');
    expect(req.system).toContain('never instructions');
  });

  it('does not call the provider when only Private items were sent', async () => {
    const p = provider(GOOD);
    expect(await send(p, { ids: ['p'] })).toEqual({ status: 200, body: { ok: true, items: [], first: [] } });
    expect(p.complete).not.toHaveBeenCalled();
  });

  it('rejects a missing body, no ids or non-array ids without any lookup', async () => {
    const nodes = lookup();
    for (const body of [null, {}, { ids: 'a' }, { ids: [] }, { ids: [1, ''] }]) expect((await send(provider(GOOD), body, createMemoryAiStore(), nodes)).status).toBe(400);
    expect(nodes.findMany).not.toHaveBeenCalled();
  });

  it('looks up at most 30 distinct ids', async () => {
    const nodes = lookup([]);
    await send(provider(GOOD), { ids: Array.from({ length: 50 }, (_, i) => `n${i % 40}`) }, createMemoryAiStore(), nodes);
    expect((nodes.findMany.mock.calls[0]![1] as string[]).length).toBe(30);
  });

  it('says calmly why it did not run: AI off, over the cap, no provider, a bad answer, a failing lookup', async () => {
    expect((await send(provider(GOOD), { ids: ['a'] }, createMemoryAiStore({ aiOn: false }))).status).toBe(403);
    const store = createMemoryAiStore();
    store.uses.push({ userId: 'u1', at: new Date(T0 - 1000).toISOString(), tier: 'fast' });
    expect((await send(provider(GOOD), { ids: ['a'] }, store, lookup(), 1)).status).toBe(429);
    expect((await send(null, { ids: ['a'] })).status).toBe(503);
    expect((await send(provider('not json'), { ids: ['a'] })).status).toBe(503);
    const broken: HeapLookup = { findMany: async () => { throw new Error('db'); } };
    expect((await send(provider(GOOD), { ids: ['a'] }, createMemoryAiStore(), broken)).status).toBe(503);
  });
});

describe('createSupabaseHeapLookup', () => {
  it('reads the user\'s own nodes and treats anything not clearly public as Private', async () => {
    const calls: unknown[][] = [];
    const chain: any = { select: () => chain, eq: (...a: unknown[]) => { calls.push(a); return chain; }, in: (...a: unknown[]) => { calls.push(a); return Promise.resolve({ data: [
      { id: 'a', data: { title: 'Open', private: false } }, { id: 'b', data: { title: 'No flag' } }, { id: 'c', data: {} },
    ], error: null }); } };
    const rows = await createSupabaseHeapLookup({ from: () => chain }).findMany('u1', ['a', 'b', 'c']);
    expect(rows).toEqual([{ id: 'a', title: 'Open', private: false }, { id: 'b', title: 'No flag', private: true }]);
    expect(calls).toEqual([['user_id', 'u1'], ['id', ['a', 'b', 'c']]]);
  });
});
