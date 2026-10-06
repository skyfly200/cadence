import { describe, expect, it, vi } from 'vitest';
import { CAP_WINDOW_MS, buildSlice, createMemoryAiStore, createOpenAiCompatProvider, heapProviderFromEnv, runAi, type AiProvider, type AiRequest } from './ai';

const T0 = Date.UTC(2026, 9, 1, 12, 0, 0);
const req: AiRequest = { tier: 'fast', system: 's', prompt: 'p', maxTokens: 50 };
const fakeProvider = (text = 'hello') => ({ complete: vi.fn(async () => text) }) satisfies AiProvider;

describe('buildSlice', () => {
  it('drops Private nodes so they never reach a provider payload', () => {
    const nodes = [{ id: 'a', private: false }, { id: 'b', private: true }, { id: 'c', private: false }];
    expect(buildSlice(nodes).map((n) => n.id)).toEqual(['a', 'c']);
  });
});

describe('runAi', () => {
  it('calls the provider, records the use and returns the text', async () => {
    const provider = fakeProvider('hi');
    const store = createMemoryAiStore();
    const r = await runAi({ provider, store, now: () => T0 }, 'u1', req);
    expect(r).toEqual({ ok: true, text: 'hi' });
    expect(provider.complete).toHaveBeenCalledWith(req);
    expect(store.uses).toEqual([{ userId: 'u1', at: new Date(T0).toISOString(), tier: 'fast' }]);
  });

  it('never reaches the provider when AI is off', async () => {
    const provider = fakeProvider();
    const r = await runAi({ provider, store: createMemoryAiStore({ aiOn: false }) }, 'u1', req);
    expect(r).toEqual({ ok: false, reason: 'ai_off' });
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it('never reaches the provider once the user is over the cap, and only counts the rolling window', async () => {
    const provider = fakeProvider();
    const store = createMemoryAiStore();
    store.uses.push({ userId: 'u1', at: new Date(T0 - CAP_WINDOW_MS - 1000).toISOString(), tier: 'fast' }); // too old to count
    store.uses.push({ userId: 'u1', at: new Date(T0 - 1000).toISOString(), tier: 'fast' });
    store.uses.push({ userId: 'u2', at: new Date(T0 - 1000).toISOString(), tier: 'fast' }); // someone else
    const deps = { provider, store, now: () => T0, dailyCap: 2 };
    expect((await runAi(deps, 'u1', req)).ok).toBe(true); // 1 counted, cap 2
    expect(await runAi(deps, 'u1', req)).toEqual({ ok: false, reason: 'over_cap' });
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it('answers unavailable with no provider configured or when the provider fails', async () => {
    expect(await runAi({ provider: null, store: createMemoryAiStore() }, 'u1', req)).toEqual({ ok: false, reason: 'unavailable' });
    const failing: AiProvider = { complete: async () => { throw new Error('boom'); } };
    expect(await runAi({ provider: failing, store: createMemoryAiStore() }, 'u1', req)).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('heapProviderFromEnv', () => {
  it('is null unless both the endpoint and the model are set', () => {
    expect(heapProviderFromEnv({})).toBeNull();
    expect(heapProviderFromEnv({ HEAP_AI_BASE_URL: 'http://localhost:11434/v1' })).toBeNull();
    expect(heapProviderFromEnv({ HEAP_AI_MODEL: 'laya' })).toBeNull();
  });
  it('calls the configured endpoint and model for every tier', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })));
    const p = heapProviderFromEnv({ HEAP_AI_BASE_URL: 'http://localhost:11434/v1', HEAP_AI_MODEL: 'laya' }, fetchMock as unknown as typeof fetch)!;
    expect(await p.complete({ ...req, tier: 'strong' })).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'laya' });
  });
});

describe('createOpenAiCompatProvider', () => {
  it('posts to /chat/completions with the tier model and returns the message text', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'local hi' } }] })));
    const p = createOpenAiCompatProvider({
      baseUrl: 'http://localhost:11434/v1/', models: { fast: 'small', strong: 'big' }, fetch: fetchMock as unknown as typeof fetch,
    });
    expect(await p.complete({ ...req, tier: 'strong' })).toBe('local hi');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'big', max_tokens: 50 });
  });

  it('throws on a non-OK answer', async () => {
    const p = createOpenAiCompatProvider({ baseUrl: 'http://x', models: { fast: 'a', strong: 'b' }, fetch: (async () => new Response('no', { status: 401 })) as typeof fetch });
    await expect(p.complete(req)).rejects.toThrow();
  });
});
