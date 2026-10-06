import { describe, expect, it, vi } from 'vitest';
import { SIZE_MINUTES, buildQuestions, createSystemOneTriage, parseAnswers, triageFromEnv } from './triage';

const ans = (tag: [string, number] | null, size: [string, number] | null) => ({
  answers: { ...(tag ? { tag: { type: 'choice', choice: tag[0], answer_confidence: tag[1] } } : {}), ...(size ? { size: { type: 'choice', choice: size[0], answer_confidence: size[1] } } : {}) },
});

describe('buildQuestions', () => {
  it('asks about the tags (plus a none option) and the size', () => {
    const q = buildQuestions(['Work', 'Home']);
    expect(Object.keys(q.tag!.criteria)).toEqual(['Work', 'Home', 'none of these']);
    expect(Object.keys(q.size.criteria)).toEqual(['quick', 'short', 'medium', 'long']);
  });
  it('leaves the tag question out with no tags, and never lets a tag collide with the none option', () => {
    expect('tag' in buildQuestions([])).toBe(false);
    expect(Object.keys(buildQuestions(['None of these', 'Work']).tag!.criteria)).toEqual(['Work', 'none of these']);
  });
});

describe('parseAnswers', () => {
  it('maps a confident tag and size', () => {
    expect(parseAnswers(ans(['Work', 0.9], ['short', 0.8]), ['Work'])).toEqual({ category: 'Work', minutes: SIZE_MINUTES.short });
  });
  it('ignores low confidence, the none option, unknown options and a body that is not an answer', () => {
    expect(parseAnswers(ans(['Work', 0.3], ['long', 0.49]), ['Work'])).toEqual({ category: null, minutes: null });
    expect(parseAnswers(ans(['none of these', 0.99], ['huge', 0.99]), ['Work'])).toEqual({ category: null, minutes: null });
    expect(parseAnswers(null, ['Work'])).toEqual({ category: null, minutes: null });
    expect(parseAnswers({ answers: 'x' }, [])).toEqual({ category: null, minutes: null });
  });
  it('reads the strict Jev shape, which has no answer_confidence, from the probabilities', () => {
    const body = { answers: { size: { choice: 'quick', probabilities: { quick: 0.7 } }, tag: { choice: 'Work' } } };
    expect(parseAnswers(body, ['Work'])).toEqual({ category: 'Work', minutes: SIZE_MINUTES.quick });
  });
});

describe('createSystemOneTriage', () => {
  const server = (route: (body: { state: string }) => Response | Promise<Response>) =>
    vi.fn(async (_u: string | URL | Request, init?: RequestInit) => route(JSON.parse(String(init!.body))));
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

  it('posts each title as the state to /v1/systemone with the bearer, and keeps what answered', async () => {
    const f = server((b) => (b.state === 'bad' ? json({}, 500) : json(ans(['Work', 0.9], ['quick', 0.9]))));
    const t = createSystemOneTriage({ baseUrl: 'http://laya:8000/', apiKey: 'k', fetch: f as unknown as typeof fetch });
    const out = await t.classify([{ id: 'a', title: 'email boss' }, { id: 'b', title: 'bad' }], ['Work']);
    expect([...out]).toEqual([['a', { category: 'Work', minutes: 10 }]]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://laya:8000/v1/systemone');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(String(init.body)).questions.tag).toBeDefined();
  });
  it('sends no Authorization header without a key, and survives network errors', async () => {
    const f = vi.fn(async () => { throw new Error('down'); });
    const t = createSystemOneTriage({ baseUrl: 'http://x', fetch: f as unknown as typeof fetch });
    expect((await t.classify([{ id: 'a', title: 't' }], [])).size).toBe(0);
    const g = server(() => json(ans(null, ['long', 1])));
    await createSystemOneTriage({ baseUrl: 'http://x', fetch: g as unknown as typeof fetch }).classify([{ id: 'a', title: 't' }], []);
    expect(((g.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>).Authorization).toBeUndefined();
  });
  it('asks about at most 30 items', async () => {
    const f = server(() => json(ans(null, ['quick', 1])));
    const items = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, title: `t${i}` }));
    await createSystemOneTriage({ baseUrl: 'http://x', fetch: f as unknown as typeof fetch }).classify(items, []);
    expect(f).toHaveBeenCalledTimes(30);
  });
});

describe('triageFromEnv', () => {
  it('is null unless TRIAGE_BASE_URL is set', () => {
    expect(triageFromEnv({})).toBeNull();
    expect(triageFromEnv({ TRIAGE_BASE_URL: '  ' })).toBeNull();
    expect(triageFromEnv({ TRIAGE_BASE_URL: 'http://laya:8000' })).not.toBeNull();
  });
});
