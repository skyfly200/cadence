import { describe, expect, it, vi } from 'vitest';
import { createMemoryDispatchStore, handleDispatch, type DispatchDeps, type DispatchStore, type QueuedNudge } from './nudges';

const NOW = new Date(Date.UTC(2026, 8, 30, 12, 0, 0));
const SECRET = 'test-secret-key';

const queued = (over: Partial<QueuedNudge> = {}): QueuedNudge => ({
  userId: 'u1', id: 'leave_by|a|2026-09-30', kind: 'leave_by', title: 'Leave by 14:40', body: 'Dentist is at 15:00.', tag: 'leave_by|a|2026-09-30',
  fireAt: new Date(NOW.getTime() - 60_000).toISOString(), dropAfter: new Date(NOW.getTime() + 600_000).toISOString(), ...over,
});

function setup(over: Partial<DispatchDeps> = {}) {
  const store = createMemoryDispatchStore();
  const send = vi.fn().mockResolvedValue({});
  const deps: DispatchDeps = { store, send, nudgeCronSecret: SECRET, sendTimeout: 50, now: () => NOW, ...over };
  return { store, send, deps, run: (secret: string | null = SECRET) => handleDispatch(deps, { secret }) };
}

const sub = (userId = 'u1', endpoint = 'https://push.example/1') => ({ userId, endpoint, p256dh: 'k', auth: 'a' });

describe('handleDispatch: secret', () => {
  it('rejects a missing or wrong secret and sends nothing', async () => {
    const { run, send, store } = setup();
    store.nudges.push(queued());
    store.subscriptions.push(sub());
    expect((await run(null)).status).toBe(401);
    expect((await run('wrong')).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
    expect(await store.claimDue(10)).toHaveLength(1); // nothing was claimed
  });

  it('answers 503 when no secret is configured, even for an empty provided one', async () => {
    const { run } = setup({ nudgeCronSecret: '' });
    expect((await run('')).status).toBe(503);
  });
});

describe('handleDispatch: sending', () => {
  it('sends a due nudge to each of the user subscriptions with the nudge payload and a TTL to drop_after', async () => {
    const { run, send, store } = setup();
    store.nudges.push(queued());
    store.subscriptions.push(sub('u1', 'https://push.example/1'), sub('u1', 'https://push.example/2'), sub('u2', 'https://push.example/3'));
    const r = await run();
    expect(r).toMatchObject({ status: 202, body: { ok: true, sent: 1 } });
    expect(send).toHaveBeenCalledTimes(2);
    const [s, payload, ttl] = send.mock.calls[0]!;
    expect(s).toEqual({ endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } });
    expect(JSON.parse(payload)).toEqual({ title: 'Leave by 14:40', body: 'Dentist is at 15:00.', tag: 'leave_by|a|2026-09-30', data: { id: 'leave_by|a|2026-09-30' } });
    expect(ttl).toBe(600);
  });

  it('never sends a nudge past its drop_after', async () => {
    const { run, send, store } = setup();
    store.nudges.push(queued({ dropAfter: new Date(NOW.getTime() - 1000).toISOString() }));
    store.subscriptions.push(sub());
    expect(await run()).toMatchObject({ status: 202, body: { sent: 0 } });
    expect(send).not.toHaveBeenCalled();
  });

  it('is idempotent: a second run sends nothing', async () => {
    const { run, send, store } = setup();
    store.nudges.push(queued());
    store.subscriptions.push(sub());
    await run();
    expect(await run()).toMatchObject({ body: { sent: 0 } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('handles an empty queue and a user with no subscriptions', async () => {
    const { run, send, store } = setup();
    expect(await run()).toMatchObject({ status: 202, body: { sent: 0 } });
    store.nudges.push(queued());
    expect(await run()).toMatchObject({ status: 202, body: { sent: 0 } });
    expect(send).not.toHaveBeenCalled();
  });

  it('claims at most 50 per run', async () => {
    const { run, store } = setup();
    for (let i = 0; i < 60; i++) store.nudges.push(queued({ id: `n${i}` }));
    store.subscriptions.push(sub());
    expect(await run()).toMatchObject({ body: { sent: 50 } });
  });
});

describe('handleDispatch: failures', () => {
  it('deletes a subscription the push service says is gone (404 or 410), keeps others', async () => {
    const { run, send, store } = setup();
    store.nudges.push(queued());
    store.subscriptions.push(sub('u1', 'https://push.example/gone'), sub('u1', 'https://push.example/ok'), sub('u1', 'https://push.example/old'));
    send.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      if (s.endpoint.endsWith('old')) throw Object.assign(new Error('nf'), { statusCode: 404 });
    });
    expect(await run()).toMatchObject({ body: { sent: 1 } });
    expect(store.subscriptions.map((x) => x.endpoint)).toEqual(['https://push.example/ok']);
  });

  it('does not retry or delete on a 5xx or a timeout', async () => {
    const { run, send, store } = setup();
    store.nudges.push(queued());
    store.subscriptions.push(sub('u1', 'https://push.example/a'), sub('u1', 'https://push.example/b'));
    send.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith('a')) throw Object.assign(new Error('down'), { statusCode: 503 });
      await new Promise(() => {}); // never answers: hits the timeout
    });
    expect(await run()).toMatchObject({ status: 202, body: { sent: 0 } });
    expect(send).toHaveBeenCalledTimes(2);
    expect(store.subscriptions).toHaveLength(2);
  });

  it('answers 503 when the store fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad: DispatchStore = { claimDue: vi.fn().mockRejectedValue(new Error('boom')), getSubscriptions: vi.fn(), deleteSubscription: vi.fn() };
    const r = await handleDispatch({ store: bad, send: vi.fn(), nudgeCronSecret: SECRET }, { secret: SECRET });
    expect(r).toMatchObject({ status: 503, body: { ok: false, error: 'unavailable' } });
  });
});
