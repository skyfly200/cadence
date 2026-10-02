import { describe, expect, it, vi } from 'vitest';
import { createMemoryAiStore, type AiProvider } from './ai';
import { createSupabaseNodeLookup, facts, handleWhyNow, validatePolish, type NodeLookup, type WhyNowNode } from './why-now';

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);
const provider = (text: string) => ({ complete: vi.fn(async () => text) }) satisfies AiProvider;
const NODE: WhyNowNode = { title: 'Pack the cooler', private: false };
const lookup = (node: WhyNowNode | null = NODE): NodeLookup & { find: ReturnType<typeof vi.fn> } => ({ find: vi.fn(async () => node) });
const send = (p: AiProvider | null, body: unknown, store = createMemoryAiStore(), dailyCap?: number, nodes: NodeLookup = lookup()) =>
  handleWhyNow({ ai: { provider: p, store, now: () => T0, dailyCap }, nodes }, { userId: 'u1', body });
const body = { nodeId: 'n1', template: 'Leave by 6:40, so this comes first' };

describe('validatePolish', () => {
  const t = 'Leave by 6:40, so this comes first';
  it('accepts a short line that keeps the time', () => {
    expect(validatePolish(t, 'Time to head out by 6:40.')).toBe('Time to head out by 6:40.');
    expect(validatePolish(t, '"Head out by 6:40, this one first"')).toBe('Head out by 6:40, this one first');
  });
  it('rejects 12 or more words, empty and multi-line replies', () => {
    expect(validatePolish(t, 'You should really leave by 6:40 because this has to come first today ok')).toBeNull();
    expect(validatePolish(t, '')).toBeNull();
    expect(validatePolish(t, 'Leave by 6:40\nthen relax')).toBeNull();
  });
  it('rejects a changed, dropped or added time or day', () => {
    expect(validatePolish(t, 'Leave by 7:00, so this is first')).toBeNull();
    expect(validatePolish(t, 'This comes first')).toBeNull();
    expect(validatePolish(t, 'Leave by 6:40 tomorrow')).toBeNull();
    expect(validatePolish("It's due today", 'Due soon')).toBeNull();
    expect(validatePolish("It's due today", 'This is due today')).toBe('This is due today');
  });
  it('reads facts case and space insensitively', () => {
    expect(facts('At 8:00 PM on Friday')).toEqual(['8:00pm', 'friday']);
    expect(facts('Up next')).toEqual([]);
  });
});

describe('handleWhyNow', () => {
  it('returns the polished line when it passes validation', async () => {
    const p = provider('Head out by 6:40, this one first');
    const r = await send(p, body);
    expect(r).toEqual({ status: 200, body: { ok: true, line: 'Head out by 6:40, this one first' } });
    expect(p.complete).toHaveBeenCalledTimes(1);
  });
  it('answers line null (keep the template) when the reply fails validation', async () => {
    expect(await send(provider('Head out by 7:15'), body)).toEqual({ status: 200, body: { ok: true, line: null } });
  });
  it('never reaches the provider for a Private item, whatever the client claims', async () => {
    const p = provider('x');
    expect(await send(p, { ...body, private: false }, createMemoryAiStore(), undefined, lookup({ title: 'Secret', private: true }))).toEqual({ status: 200, body: { ok: true, line: null } });
    expect(p.complete).not.toHaveBeenCalled();
  });
  it('never reaches the provider for a node the server cannot find, and looks it up for this user', async () => {
    const p = provider('x');
    const nodes = lookup(null);
    expect(await send(p, body, createMemoryAiStore(), undefined, nodes)).toEqual({ status: 200, body: { ok: true, line: null } });
    expect(p.complete).not.toHaveBeenCalled();
    expect(nodes.find).toHaveBeenCalledWith('u1', 'n1');
  });
  it('answers 503 when the lookup fails', async () => {
    expect((await send(provider('x'), body, createMemoryAiStore(), undefined, { find: async () => { throw new Error('x'); } })).status).toBe(503);
  });
  it('never reaches the provider when AI is off (403) or over the cap (429)', async () => {
    const p = provider('x');
    expect((await send(p, body, createMemoryAiStore({ aiOn: false }))).status).toBe(403);
    const store = createMemoryAiStore();
    store.uses.push({ userId: 'u1', at: new Date(T0 - 1000).toISOString(), tier: 'fast' });
    expect((await send(p, body, store, 1)).status).toBe(429);
    expect(p.complete).not.toHaveBeenCalled();
  });
  it('answers 503 with no provider or a failing one', async () => {
    expect((await send(null, body)).status).toBe(503);
    expect((await send({ complete: async () => { throw new Error('x'); } }, body)).status).toBe(503);
  });
  it('rejects a missing, empty or oversized body without calling the provider', async () => {
    const p = provider('x');
    for (const b of [null, 'x', {}, { nodeId: '', template: 't' }, { nodeId: 'n', template: 'y'.repeat(201) }]) {
      expect((await send(p, b)).status).toBe(400);
    }
    expect(p.complete).not.toHaveBeenCalled();
  });
  it('sends only the stored title and the template, as data', async () => {
    const p = provider('Head out by 6:40');
    await send(p, { ...body, title: 'client title', extra: 'secret' });
    const req = (p.complete.mock.calls[0] as unknown as [{ prompt: string; tier: string }])[0];
    expect(req.tier).toBe('fast');
    expect(req.prompt).toBe('Task: Pack the cooler\nCurrent line: Leave by 6:40, so this comes first');
  });
});

describe('createSupabaseNodeLookup', () => {
  const db = (row: unknown, error: unknown = null) => {
    const calls: [string, string][] = [];
    const q: any = { select: () => q, eq: (c: string, v: string) => { calls.push([c, v]); return q; }, maybeSingle: async () => ({ data: row, error }) };
    return { calls, from: (t: string) => { calls.push(['from', t]); return q; } };
  };
  it('reads the stored title and Private flag for this user only', async () => {
    const d = db({ data: { title: 'Pack', private: false } });
    expect(await createSupabaseNodeLookup(d).find('u1', 'n1')).toEqual({ title: 'Pack', private: false });
    expect(d.calls).toEqual([['from', 'cadence_nodes'], ['user_id', 'u1'], ['id', 'n1']]);
  });
  it('treats a missing flag as Private (fails closed) and a missing node as null', async () => {
    expect(await createSupabaseNodeLookup(db({ data: { title: 'Pack' } })).find('u1', 'n1')).toEqual({ title: 'Pack', private: true });
    expect(await createSupabaseNodeLookup(db(null)).find('u1', 'n1')).toBeNull();
  });
  it('throws on a database error', async () => {
    await expect(createSupabaseNodeLookup(db(null, { message: 'x' })).find('u1', 'n1')).rejects.toThrow();
  });
});
