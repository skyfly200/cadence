import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DUPLICATE_WINDOW_MS, MAX_TEXT_LENGTH, RATE_LIMIT_COUNT, RATE_LIMIT_WINDOW_MS, REPLY,
  createMemoryCaptureStore, createSupabaseCaptureStore, handleCapture, hashText, type SupabaseLike,
} from './capture';

const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);
let n = 0;
const deps = (store = createMemoryCaptureStore(), now = T0) => ({ store, now: () => now, newId: () => `id${++n}` });
const send = (d: ReturnType<typeof deps>, body: unknown, userId = 'u1') => handleCapture(d, { userId, source: 'app', body });

afterEach(() => vi.restoreAllMocks());

describe('handleCapture: success', () => {
  it('saves an Idea and a captured Occurrence and answers in the coach voice', async () => {
    const d = deps();
    const r = await send(d, { text: '  Bring the projector  ' });
    expect(r.status).toBe(200);
    if (r.status !== 200) throw new Error('unreachable');
    expect(r.body).toMatchObject({ ok: true, reply: REPLY, duplicate: false });
    expect(REPLY).toBe('Got it, parked.');

    expect(d.store.nodes).toHaveLength(1);
    const node = d.store.nodes[0]!;
    expect(node.id).toBe(r.body.id);
    expect(node.data).toMatchObject({ kind: 'idea', title: 'Bring the projector', private: false, captureSource: 'app', createdAt: new Date(T0).toISOString() });
    expect(node.data.captureHash).toBe(hashText('Bring the projector'));
    expect(d.store.occurrences).toEqual([
      expect.objectContaining({ nodeId: node.id, type: 'captured', source: 'app', at: new Date(T0).toISOString() }),
    ]);
  });
});

describe('handleCapture: validation', () => {
  it('rejects empty and whitespace-only text calmly', async () => {
    const d = deps();
    for (const text of ['', '   \n\t ']) {
      const r = await send(d, { text });
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ ok: false, error: 'empty' });
    }
    expect(d.store.nodes).toHaveLength(0);
  });

  it('rejects text over the limit, accepts text exactly at it', async () => {
    const d = deps();
    const over = await send(d, { text: 'a'.repeat(MAX_TEXT_LENGTH + 1) });
    expect(over.status).toBe(400);
    expect(over.body).toMatchObject({ ok: false, error: 'too_long' });
    const at = await send(d, { text: 'a'.repeat(MAX_TEXT_LENGTH) });
    expect(at.status).toBe(200);
  });

  it('rejects a missing, non-string or malformed body and a bad idempotency key', async () => {
    const d = deps();
    for (const body of [undefined, null, 'text', { text: 42 }, {}, { text: 'ok', idempotencyKey: 'short' }, { text: 'ok', idempotencyKey: 7 }]) {
      const r = await send(d, body);
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ ok: false, error: 'bad_request' });
    }
    expect(d.store.nodes).toHaveLength(0);
  });
});

describe('handleCapture: idempotency and duplicates', () => {
  it('a replayed idempotency key returns the original without a second Idea', async () => {
    const d = deps();
    const a = await send(d, { text: 'one', idempotencyKey: 'cap_abcdefgh1' });
    const b = await send(d, { text: 'one (retyped differently)', idempotencyKey: 'cap_abcdefgh1' });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    if (a.status !== 200 || b.status !== 200) throw new Error('unreachable');
    expect(b.body.id).toBe(a.body.id);
    expect(b.body.duplicate).toBe(true);
    expect(d.store.nodes).toHaveLength(1);
  });

  it('identical text from the same source within 5 minutes counts once, even with different casing and spacing', async () => {
    const d = deps();
    const a = await send(d, { text: 'Call Dana' });
    const b = await handleCapture(deps(d.store, T0 + DUPLICATE_WINDOW_MS - 1), { userId: 'u1', source: 'app', body: { text: '  call   dana ' } });
    if (a.status !== 200 || b.status !== 200) throw new Error('unreachable');
    expect(b.body).toMatchObject({ duplicate: true, id: a.body.id, reply: REPLY });
    expect(d.store.nodes).toHaveLength(1);
  });

  it('saves again once the window has passed, for another source, or for another user', async () => {
    const d = deps();
    await send(d, { text: 'Call Dana' });
    const later = await handleCapture(deps(d.store, T0 + DUPLICATE_WINDOW_MS + 1), { userId: 'u1', source: 'app', body: { text: 'Call Dana' } });
    const otherSource = await handleCapture(d, { userId: 'u1', source: 'claude', body: { text: 'Call Dana' } });
    const otherUser = await send(d, { text: 'Call Dana' }, 'u2');
    for (const r of [later, otherSource, otherUser]) {
      expect(r.status).toBe(200);
      if (r.status === 200) expect(r.body.duplicate).toBe(false);
    }
    expect(d.store.nodes).toHaveLength(4);
  });
});

describe('handleCapture: rate limit', () => {
  it('allows the limit then answers 429 with a retry hint, per user, and recovers after the window', async () => {
    const d = deps();
    for (let i = 0; i < RATE_LIMIT_COUNT; i++) expect((await send(d, { text: `thought ${i}` })).status).toBe(200);
    const blocked = await send(d, { text: 'one more' });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ ok: false, error: 'rate_limited', retryAfterSeconds: 30 });
    expect(d.store.nodes).toHaveLength(RATE_LIMIT_COUNT);

    expect((await send(d, { text: 'someone else' }, 'u2')).status).toBe(200);
    const after = await handleCapture(deps(d.store, T0 + RATE_LIMIT_WINDOW_MS + 1), { userId: 'u1', source: 'app', body: { text: 'one more' } });
    expect(after.status).toBe(200);
  });

  it('does not rate limit replays or duplicates, which create nothing', async () => {
    const d = deps();
    await send(d, { text: 'first', idempotencyKey: 'cap_replaykey1' });
    for (let i = 0; i < RATE_LIMIT_COUNT; i++) await send(d, { text: `thought ${i}` });
    expect((await send(d, { text: 'first', idempotencyKey: 'cap_replaykey1' })).status).toBe(200);
    expect((await send(d, { text: 'thought 3' })).status).toBe(200);
  });
});

describe('handleCapture: failures and logging', () => {
  it('a store failure answers a calm 503 that does not leak details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createMemoryCaptureStore();
    store.failNext = true;
    const r = await send(deps(store), { text: 'private thought' });
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ ok: false, error: 'unavailable' });
    expect(JSON.stringify(r.body)).not.toMatch(/boom|secret|private thought/);
  });

  it('never logs the captured text, on success or on failure', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const secret = 'my very private thought 4711';
    await send(deps(), { text: secret });
    await send(deps(), { text: secret, idempotencyKey: 'cap_logcheck01' });
    const bad = createMemoryCaptureStore();
    bad.failNext = true;
    await send(deps(bad), { text: secret });
    const logged = spies.flatMap((s) => s.mock.calls).map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain('4711');
    expect(logged).not.toContain('boom');
  });
});

// ── the Supabase store, against a recording fake of the client ───────────

function fakeClient(result: Record<string, unknown> = {}) {
  const calls: { table: string; op: string; filters: unknown[]; payload?: unknown }[] = [];
  const from = (table: string) => {
    const call = { table, op: 'select', filters: [] as unknown[], payload: undefined as unknown };
    calls.push(call);
    const done = () => Promise.resolve({ data: result[`${table}.data`] ?? null, count: result[`${table}.count`] ?? 0, error: result[`${table}.error`] ?? null });
    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (p: unknown) => { call.op = 'insert'; call.payload = p; return Promise.resolve({ error: result[`${table}.insertError`] ?? null }); },
      delete: () => { call.op = 'delete'; return chain; },
      eq: (c: string, v: unknown) => { call.filters.push(['eq', c, v]); return chain; },
      gte: (c: string, v: unknown) => { call.filters.push(['gte', c, v]); return chain; },
      limit: () => chain,
      maybeSingle: done,
      then: (res: (v: unknown) => unknown) => done().then(res),
    };
    return chain;
  };
  return { sb: { from } as unknown as SupabaseLike, calls };
}

describe('createSupabaseCaptureStore', () => {
  const capture = { userId: 'u1', nodeId: 'idea_1', occurrenceId: 'occ_1', text: 'hi', createdAt: '2026-09-30T12:00:00.000Z', source: 'app' as const, hash: 'h', idempotencyKey: 'cap_abcdefgh1' };

  it('writes an idea row and a captured occurrence row, both scoped to the user', async () => {
    const { sb, calls } = fakeClient();
    await createSupabaseCaptureStore(sb).create(capture);
    const [node, occ] = calls;
    expect(node).toMatchObject({ table: 'cadence_nodes', op: 'insert', payload: expect.objectContaining({ user_id: 'u1', id: 'idea_1', kind: 'idea', updated_at: capture.createdAt }) });
    expect((node!.payload as { data: unknown }).data).toMatchObject({ kind: 'idea', title: 'hi', captureKey: 'cap_abcdefgh1', captureHash: 'h', captureSource: 'app' });
    expect(occ).toMatchObject({ table: 'cadence_occurrences', op: 'insert', payload: { user_id: 'u1', id: 'occ_1', node_id: 'idea_1', type: 'captured', at: capture.createdAt, source: 'app' } });
  });

  it('removes the Idea if its Occurrence cannot be written', async () => {
    const { sb, calls } = fakeClient({ 'cadence_occurrences.insertError': { code: '23505' } });
    await expect(createSupabaseCaptureStore(sb).create(capture)).rejects.toThrow('capture write failed: 23505');
    expect(calls.at(-1)).toMatchObject({ table: 'cadence_nodes', op: 'delete', filters: [['eq', 'user_id', 'u1'], ['eq', 'id', 'idea_1']] });
  });

  it('looks up replays and duplicates by user, kind and capture metadata', async () => {
    const { sb, calls } = fakeClient({ 'cadence_nodes.data': { id: 'idea_9', data: { createdAt: '2026-09-30T11:59:00.000Z' } } });
    const store = createSupabaseCaptureStore(sb);
    expect(await store.findByIdempotencyKey('u1', 'cap_abcdefgh1')).toEqual({ nodeId: 'idea_9', createdAt: '2026-09-30T11:59:00.000Z' });
    expect(calls[0]!.filters).toEqual([['eq', 'user_id', 'u1'], ['eq', 'kind', 'idea'], ['eq', 'data->>captureKey', 'cap_abcdefgh1']]);
    await store.findRecentDuplicate('u1', 'app', 'h', 'since');
    expect(calls[1]!.filters).toEqual([['eq', 'user_id', 'u1'], ['eq', 'kind', 'idea'], ['eq', 'data->>captureHash', 'h'], ['eq', 'data->>captureSource', 'app'], ['gte', 'updated_at', 'since']]);
  });

  it('counts recent captured occurrences for the user and surfaces store errors as codes only', async () => {
    const ok = fakeClient({ 'cadence_occurrences.count': 7 });
    expect(await createSupabaseCaptureStore(ok.sb).countRecent('u1', 'since')).toBe(7);
    expect(ok.calls[0]!.filters).toEqual([['eq', 'user_id', 'u1'], ['eq', 'type', 'captured'], ['gte', 'at', 'since']]);
    const bad = fakeClient({ 'cadence_occurrences.error': { code: '42501', message: 'row data here' } });
    await expect(createSupabaseCaptureStore(bad.sb).countRecent('u1', 'since')).rejects.toThrow('capture count failed: 42501');
  });
});
