import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { enablePush, disablePush, urlBase64ToUint8Array, type PushOutcome } from './push-client';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url key to Uint8Array', () => {
    // Simple test: 'a' encoded as 'YQ==' in base64, 'YQ' in base64url
    const result = urlBase64ToUint8Array('YQ');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0x61); // 'a' in ASCII
  });

  it('handles - and _ replacements (base64url to base64 conversion)', () => {
    // Test with - and _ which should be replaced with + and /
    // This is a valid base64url encoded value
    const base64url = 'YQ-_';
    const result = urlBase64ToUint8Array(base64url);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles padding correctly', () => {
    // 'YWI=' is 'ab' encoded in base64
    const result = urlBase64ToUint8Array('YWI');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(2);
  });
});

describe('enablePush', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockGetRegistration: ReturnType<typeof vi.fn>;
  let mockPushSubscribe: ReturnType<typeof vi.fn>;
  let mockRegistration: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    mockGetRegistration = vi.fn();
    mockPushSubscribe = vi.fn();
    mockRegistration = {
      pushManager: {
        subscribe: mockPushSubscribe,
        getSubscription: vi.fn().mockResolvedValue(null),
      },
    };

    vi.stubGlobal('window', {
      PushManager: {},
    });

    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: mockGetRegistration,
      },
    });

    vi.stubGlobal('Notification', {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
  })

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns unsupported if PushManager is missing', async () => {
    vi.stubGlobal('PushManager', undefined);
    const r = await enablePush({ accessToken: 'tok', vapidPublicKey: 'YQ' });
    expect(r.status).toBe('unsupported');
  });

  it('returns unsupported if service worker is missing', async () => {
    vi.stubGlobal('navigator', { serviceWorker: undefined });
    const r = await enablePush({ accessToken: 'tok', vapidPublicKey: 'YQ' });
    expect(r.status).toBe('unsupported');
  });

  it('returns signed_out without an access token', async () => {
    const r = await enablePush({ accessToken: null, vapidPublicKey: 'YQ' });
    expect(r.status).toBe('signed_out');
  });

  it('returns blocked if Notification.permission is denied', async () => {
    vi.stubGlobal('Notification', {
      permission: 'denied' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('denied'),
    });
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    const r = await enablePush({ accessToken: 'tok', vapidPublicKey: 'YQ' });
    expect(r.status).toBe('blocked');
  });

  it('returns unsupported if getRegistration returns undefined', async () => {
    mockGetRegistration.mockResolvedValueOnce(undefined);
    const r = await enablePush({ accessToken: 'tok', vapidPublicKey: 'YQ' });
    expect(r.status).toBe('unsupported');
  });

  it('requests permission and subscribes on success', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    mockPushSubscribe.mockResolvedValueOnce({
      endpoint: 'https://example.com/push/123',
      toJSON: () => ({ endpoint: 'https://example.com/push/123', keys: { p256dh: 'x', auth: 'y' } }),
    });
    mockFetch.mockResolvedValueOnce(json({ ok: true }));

    const r = await enablePush({
      accessToken: 'tok',
      vapidPublicKey: 'YQ',
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(r.status).toBe('subscribed');
    expect(r).toMatchObject({ endpoint: 'https://example.com/push/123' });
    expect(mockFetch).toHaveBeenCalledWith('/api/push/subscribe', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
    }));
  });

  it('handles already subscribed case by reusing subscription', async () => {
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    const existingSub = {
      endpoint: 'https://example.com/push/existing',
      toJSON: () => ({ endpoint: 'https://example.com/push/existing', keys: { p256dh: 'a', auth: 'b' } }),
    };
    mockRegistration.pushManager.getSubscription = vi.fn().mockResolvedValue(existingSub);
    mockFetch.mockResolvedValueOnce(json({ ok: true }));

    const r = await enablePush({
      accessToken: 'tok',
      vapidPublicKey: 'YQ',
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(r.status).toBe('already_subscribed');
    expect(r).toMatchObject({ endpoint: 'https://example.com/push/existing' });
  });

  it('denies blocked after requesting permission', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('denied'),
    });
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    const r = await enablePush({ accessToken: 'tok', vapidPublicKey: 'YQ' });
    expect(r.status).toBe('blocked');
  });

  it('handles subscribe failure', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    mockPushSubscribe.mockRejectedValueOnce(new Error('Network error'));

    const r = await enablePush({
      accessToken: 'tok',
      vapidPublicKey: 'YQ',
    });

    expect(r.status).toBe('failed');
    expect(r.retryable).toBe(true);
  });

  it('handles server error when posting subscription', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    mockPushSubscribe.mockResolvedValueOnce({
      endpoint: 'https://example.com/push/123',
      toJSON: () => ({ endpoint: 'https://example.com/push/123', keys: { p256dh: 'x', auth: 'y' } }),
    });
    mockFetch.mockResolvedValueOnce(json({ ok: false }, 503));

    const r = await enablePush({
      accessToken: 'tok',
      vapidPublicKey: 'YQ',
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(r.status).toBe('failed');
  });

  it('handles no VAPID key', async () => {
    const r = await enablePush({ accessToken: 'tok', vapidPublicKey: null });
    expect(r.status).toBe('failed');
  });
});

describe('disablePush', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockGetRegistration: ReturnType<typeof vi.fn>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let mockSubscription: any;
  let mockRegistration: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    mockGetRegistration = vi.fn();
    mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
    mockSubscription = {
      endpoint: 'https://example.com/push/123',
      unsubscribe: mockUnsubscribe,
    };
    mockRegistration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(mockSubscription),
      },
    };

    vi.stubGlobal('window', {
      PushManager: {},
    });

    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: mockGetRegistration,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns unsupported if service worker is missing', async () => {
    vi.stubGlobal('navigator', {});
    const r = await disablePush({ accessToken: 'tok', vapidPublicKey: null });
    expect(r.status).toBe('unsupported');
  });

  it('returns signed_out without an access token', async () => {
    const r = await disablePush({ accessToken: null, vapidPublicKey: null });
    expect(r.status).toBe('signed_out');
  });

  it('returns unsupported if getRegistration returns undefined', async () => {
    mockGetRegistration.mockResolvedValueOnce(undefined);
    const r = await disablePush({ accessToken: 'tok', vapidPublicKey: null });
    expect(r.status).toBe('unsupported');
  });

  it('unsubscribes and posts to server on success', async () => {
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    mockFetch.mockResolvedValueOnce(json({ ok: true }));

    const r = await disablePush({
      accessToken: 'tok',
      vapidPublicKey: null,
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(r.status).toBe('already_subscribed');
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith('/api/push/unsubscribe', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
    }));
    const body = JSON.parse((mockFetch.mock.calls[0]![1] as any).body);
    expect(body).toEqual({ endpoint: 'https://example.com/push/123' });
  });

  it('returns already_subscribed if no subscription exists', async () => {
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    mockRegistration.pushManager.getSubscription = vi.fn().mockResolvedValue(null);

    const r = await disablePush({ accessToken: 'tok', vapidPublicKey: null });

    expect(r.status).toBe('already_subscribed');
  });

  it('handles unsubscribe failure', async () => {
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    mockUnsubscribe.mockRejectedValueOnce(new Error('Failed'));

    const r = await disablePush({ accessToken: 'tok', vapidPublicKey: null });

    expect(r.status).toBe('failed');
  });

  it('handles server error on unsubscribe post', async () => {
    mockGetRegistration.mockResolvedValueOnce(mockRegistration);
    mockFetch.mockResolvedValueOnce(json({ ok: false }, 503));

    const r = await disablePush({
      accessToken: 'tok',
      vapidPublicKey: null,
      fetch: mockFetch as unknown as typeof fetch,
    });

    expect(r.status).toBe('failed');
  });
});
