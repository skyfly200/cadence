import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_ENDPOINT_LENGTH, MIN_ENDPOINT_LENGTH,
  handleSubscribe, handleUnsubscribe, validateSubscription,
  createMemoryPushStore, type PushDeps,
} from './push';

const deps = (store = createMemoryPushStore().store): PushDeps => ({ store });

describe('validateSubscription', () => {
  it('accepts a valid subscription object', () => {
    const sub = {
      endpoint: 'https://example.com/push/abc123',
      keys: { p256dh: 'key1', auth: 'key2' },
    };
    expect(validateSubscription(sub)).toEqual({
      endpoint: 'https://example.com/push/abc123',
      p256dh: 'key1',
      auth: 'key2',
    });
  });

  it('rejects null, non-objects, missing fields, and non-string keys', () => {
    for (const bad of [
      null,
      undefined,
      'string',
      {},
      { endpoint: 'url' },
      { keys: {} },
      { endpoint: 123, keys: { p256dh: 'a', auth: 'b' } },
      { endpoint: 'url', keys: { p256dh: 'a' } },
      { endpoint: 'url', keys: { auth: 'b' } },
      { endpoint: 'url', keys: { p256dh: 123, auth: 'b' } },
    ]) {
      expect(validateSubscription(bad)).toBeNull();
    }
  });
});

describe('handleSubscribe: validation', () => {
  it('rejects non-https endpoints', async () => {
    const d = deps();
    const r = await handleSubscribe(d, { userId: 'u1', body: { endpoint: 'http://example.com/push', keys: { p256dh: 'a', auth: 'b' } } });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ ok: false, error: 'bad_request' });
  });

  it('rejects endpoints below MIN_ENDPOINT_LENGTH or above MAX_ENDPOINT_LENGTH', async () => {
    const d = deps();
    // Create an endpoint that's below minimum: make it short enough to fail the check
    const short = 'https://' + 'x'.repeat(Math.max(0, MIN_ENDPOINT_LENGTH - 8 - 1)); // -8 for https://, -1 to be below minimum
    const rShort = await handleSubscribe(d, { userId: 'u1', body: { endpoint: short, keys: { p256dh: 'a', auth: 'b' } } });
    expect(rShort.status).toBe(400);

    const long = 'https://' + 'x'.repeat(MAX_ENDPOINT_LENGTH - 8 + 1); // -8 for https://, +1 to exceed maximum
    const rLong = await handleSubscribe(d, { userId: 'u1', body: { endpoint: long, keys: { p256dh: 'a', auth: 'b' } } });
    expect(rLong.status).toBe(400);
  });

  it('rejects missing or incomplete keys', async () => {
    const d = deps();
    for (const bad of [
      { endpoint: 'https://example.com/push', keys: {} },
      { endpoint: 'https://example.com/push', keys: { p256dh: 'a' } },
      { endpoint: 'https://example.com/push', keys: { auth: 'b' } },
    ]) {
      const r = await handleSubscribe(d, { userId: 'u1', body: bad });
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ ok: false, error: 'bad_request' });
    }
  });

  it('accepts endpoints at the boundary lengths', async () => {
    const d = deps();
    const atMin = 'x'.repeat(MIN_ENDPOINT_LENGTH);
    const rMin = await handleSubscribe(d, { userId: 'u1', body: { endpoint: `https://${atMin}`, keys: { p256dh: 'a', auth: 'b' } } });
    expect(rMin.status).toBe(200);

    const atMax = 'y'.repeat(MAX_ENDPOINT_LENGTH - 8); // 8 for 'https://'
    const rMax = await handleSubscribe(d, { userId: 'u1', body: { endpoint: `https://${atMax}`, keys: { p256dh: 'a', auth: 'b' } } });
    expect(rMax.status).toBe(200);
  });
});

describe('handleSubscribe: success', () => {
  it('saves a subscription and is idempotent', async () => {
    const { store, subscriptions } = createMemoryPushStore();
    const d = deps(store);
    const endpoint = 'https://example.com/push/abc123';
    const sub = { endpoint, keys: { p256dh: 'key1', auth: 'key2' } };
    const r1 = await handleSubscribe(d, { userId: 'u1', body: sub });
    expect(r1.status).toBe(200);
    expect(subscriptions).toHaveLength(1);

    const r2 = await handleSubscribe(d, { userId: 'u1', body: sub });
    expect(r2.status).toBe(200);
    expect(subscriptions).toHaveLength(1); // Still one; upserted.
  });

  it('allows multiple subscriptions per user', async () => {
    const { store, subscriptions } = createMemoryPushStore();
    const d = deps(store);
    for (let i = 0; i < 3; i++) {
      const r = await handleSubscribe(d, { userId: 'u1', body: { endpoint: `https://example.com/push/${i}`, keys: { p256dh: 'k1', auth: 'k2' } } });
      expect(r.status).toBe(200);
    }
    expect(subscriptions.filter((s) => s.userId === 'u1')).toHaveLength(3);
  });

  it('isolates subscriptions by user', async () => {
    const { store, subscriptions } = createMemoryPushStore();
    const d = deps(store);
    const endpoint = 'https://example.com/push/shared';
    await handleSubscribe(d, { userId: 'u1', body: { endpoint, keys: { p256dh: 'a', auth: 'b' } } });
    await handleSubscribe(d, { userId: 'u2', body: { endpoint, keys: { p256dh: 'c', auth: 'd' } } });
    expect(subscriptions).toHaveLength(2);
    expect(subscriptions[0]?.p256dh).toBe('a');
    expect(subscriptions[1]?.p256dh).toBe('c');
  });
});

describe('handleUnsubscribe: success', () => {
  it('removes a subscription', async () => {
    const { store, subscriptions } = createMemoryPushStore();
    const d = deps(store);
    const endpoint = 'https://example.com/push/abc123';
    await handleSubscribe(d, { userId: 'u1', body: { endpoint, keys: { p256dh: 'a', auth: 'b' } } });
    expect(subscriptions).toHaveLength(1);

    const r = await handleUnsubscribe(d, { userId: 'u1', body: { endpoint } });
    expect(r.status).toBe(200);
    expect(subscriptions).toHaveLength(0);
  });

  it('only removes the owner\'s subscription, not others', async () => {
    const { store, subscriptions } = createMemoryPushStore();
    const d = deps(store);
    const endpoint = 'https://example.com/push/shared';
    await handleSubscribe(d, { userId: 'u1', body: { endpoint, keys: { p256dh: 'a', auth: 'b' } } });
    await handleSubscribe(d, { userId: 'u2', body: { endpoint, keys: { p256dh: 'c', auth: 'd' } } });

    const r = await handleUnsubscribe(d, { userId: 'u1', body: { endpoint } });
    expect(r.status).toBe(200);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.userId).toBe('u2');
  });

  it('is safe when the subscription does not exist', async () => {
    const d = deps();
    const r = await handleUnsubscribe(d, { userId: 'u1', body: { endpoint: 'https://example.com/push/nonexistent' } });
    expect(r.status).toBe(200);
  });

  it('rejects missing or invalid body', async () => {
    const d = deps();
    for (const bad of [null, undefined, {}, { endpoint: 123 }, { endpoint: '' }]) {
      const r = await handleUnsubscribe(d, { userId: 'u1', body: bad });
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ ok: false, error: 'bad_request' });
    }
  });
});

describe('handleSubscribe/Unsubscribe: failures', () => {
  it('answers 503 and logs only the error name on store failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store } = createMemoryPushStore();
    store.subscribe = vi.fn().mockRejectedValueOnce(new Error('secret row data'));
    const d = deps(store);
    const r = await handleSubscribe(d, { userId: 'u1', body: { endpoint: 'https://example.com/push', keys: { p256dh: 'a', auth: 'b' } } });
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ ok: false, error: 'unavailable' });
    expect(JSON.stringify(r.body)).not.toContain('secret row data');
  });
});
