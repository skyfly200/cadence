import { describe, expect, it, vi } from 'vitest';
import { createWhyNowCache, fetchWhyNow, shownLine, whyNowKey, type WhyNowItem } from './why-now';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const item: WhyNowItem = { nodeId: 'n1', title: 'Pack the cooler', template: 'Leave by 6:40, so this comes first', private: false };
const memoryStorage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe('cache', () => {
  it('is keyed by node id plus template text and survives a reload', () => {
    const s = memoryStorage();
    createWhyNowCache(s).set(whyNowKey('n1', 'A'), 'Polished A');
    const again = createWhyNowCache(s);
    expect(shownLine(again, 'n1', 'A')).toBe('Polished A');
    expect(shownLine(again, 'n1', 'B')).toBe('B'); // template changed: the old polish no longer applies
    expect(shownLine(again, 'n2', 'A')).toBe('A');
  });
  it('shows the template for an empty (nothing better) entry and caps its size', () => {
    const c = createWhyNowCache(null);
    c.set(whyNowKey('n1', 'T'), '');
    expect(shownLine(c, 'n1', 'T')).toBe('T');
    for (let i = 0; i < 120; i++) c.set(`k${i}`, 'x');
    expect(c.get('k0')).toBeUndefined();
    expect(c.get('k119')).toBe('x');
  });
});

describe('fetchWhyNow', () => {
  it('asks once, caches the line, and does not ask again', async () => {
    const f = vi.fn(async () => json({ ok: true, line: 'Head out by 6:40' }));
    const cache = createWhyNowCache(null);
    const o = { accessToken: 't', aiOn: true, fetch: f as unknown as typeof fetch };
    expect(await fetchWhyNow(item, cache, o)).toBe('Head out by 6:40');
    expect(await fetchWhyNow(item, cache, o)).toBe('Head out by 6:40');
    expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ nodeId: item.nodeId, template: item.template });
  });
  it('remembers a null answer so it is not asked again', async () => {
    const f = vi.fn(async () => json({ ok: true, line: null }));
    const cache = createWhyNowCache(null);
    const o = { accessToken: 't', aiOn: true, fetch: f as unknown as typeof fetch };
    expect(await fetchWhyNow(item, cache, o)).toBeNull();
    expect(await fetchWhyNow(item, cache, o)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('makes no request for a Private item, with AI off, or signed out', async () => {
    const f = vi.fn(async () => json({ ok: true, line: 'x' }));
    const ff = f as unknown as typeof fetch;
    expect(await fetchWhyNow({ ...item, private: true }, createWhyNowCache(null), { accessToken: 't', aiOn: true, fetch: ff })).toBeNull();
    expect(await fetchWhyNow(item, createWhyNowCache(null), { accessToken: 't', aiOn: false, fetch: ff })).toBeNull();
    expect(await fetchWhyNow(item, createWhyNowCache(null), { accessToken: null, aiOn: true, fetch: ff })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it('keeps the template and retries later when the server says no or fails', async () => {
    const cache = createWhyNowCache(null);
    const f = vi.fn(async () => json({ ok: false }, 429));
    expect(await fetchWhyNow(item, cache, { accessToken: 't', aiOn: true, fetch: f as unknown as typeof fetch })).toBeNull();
    expect(cache.get(whyNowKey(item.nodeId, item.template))).toBeUndefined();
  });
});
