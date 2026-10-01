/**
 * Browser helper for Web Push subscription.
 * Pure and testable: enable/disable push notifications with full Notification
 * permission and service worker handling.
 *
 * Returns typed outcomes for every branch: unsupported, blocked, success,
 * already subscribed, or server error.
 */

export type PushOutcome =
  | { status: 'unsupported'; message: string }
  | { status: 'blocked'; message: string }
  | { status: 'subscribed'; endpoint: string; message: string }
  | { status: 'already_subscribed'; endpoint: string; message: string }
  | { status: 'failed'; retryable: boolean; message: string }
  | { status: 'signed_out'; message: string };

interface Opts {
  accessToken: string | null | undefined;
  vapidPublicKey: string | null | undefined;
  fetch?: typeof fetch;
}

/**
 * Convert base64url to Uint8Array for the VAPID public key.
 * Swaps - to + and _ to / for padding, then adds = as needed.
 */
export function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Enable Web Push notifications: request permission, get service worker,
 * subscribe, and POST subscription to /api/push/subscribe.
 */
export async function enablePush(opts: Opts): Promise<PushOutcome> {
  // Check support
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    return { status: 'unsupported', message: 'Notifications are not supported on this device.' };
  }

  if (!opts.accessToken) {
    return { status: 'signed_out', message: 'Sign in first to enable notifications.' };
  }

  if (!opts.vapidPublicKey) {
    return { status: 'failed', retryable: false, message: 'Push is not configured.' };
  }

  // Check if already blocked
  if (Notification.permission === 'denied') {
    return { status: 'blocked', message: 'Notifications are blocked in settings.' };
  }

  // Get service worker registration (avoid .ready which hangs without a SW)
  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await navigator.serviceWorker.getRegistration();
  } catch {
    return { status: 'unsupported', message: 'Service workers are not supported.' };
  }

  if (!registration) {
    return { status: 'unsupported', message: 'Service worker is not installed.' };
  }

  // Request permission if not yet granted
  if (Notification.permission !== 'granted') {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'denied') {
        return { status: 'blocked', message: 'Notifications are blocked in settings.' };
      }
    } catch {
      return { status: 'failed', retryable: false, message: 'Could not request notification permission.' };
    }
  }

  // Check for existing subscription
  let subscription: PushSubscription | null;
  try {
    subscription = await registration.pushManager.getSubscription();
  } catch {
    return { status: 'failed', retryable: false, message: 'Could not check subscription status.' };
  }

  // Reuse existing subscription
  if (subscription) {
    const endpoint = subscription.endpoint;
    const result = await postSubscription(endpoint, subscription.toJSON(), opts.accessToken, opts.fetch);
    if (result.ok) {
      return { status: 'already_subscribed', endpoint, message: 'Notifications are on.' };
    }
    return { status: 'failed', retryable: true, message: result.message };
  }

  // Subscribe to push
  let newSubscription: PushSubscription;
  try {
    newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(opts.vapidPublicKey),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not subscribe to push.';
    return { status: 'failed', retryable: true, message };
  }

  const endpoint = newSubscription.endpoint;
  const result = await postSubscription(endpoint, newSubscription.toJSON(), opts.accessToken, opts.fetch);
  if (result.ok) {
    return { status: 'subscribed', endpoint, message: 'Notifications are on.' };
  }
  return { status: 'failed', retryable: true, message: result.message };
}

/**
 * Disable Web Push: unsubscribe from push manager and POST to /api/push/unsubscribe.
 */
export async function disablePush(opts: Opts): Promise<PushOutcome> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { status: 'unsupported', message: 'Notifications are not supported on this device.' };
  }

  if (!opts.accessToken) {
    return { status: 'signed_out', message: 'Sign in first.' };
  }

  // Get service worker registration
  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await navigator.serviceWorker.getRegistration();
  } catch {
    return { status: 'failed', retryable: false, message: 'Could not access service worker.' };
  }

  if (!registration) {
    return { status: 'unsupported', message: 'Service worker is not installed.' };
  }

  // Get current subscription
  let subscription: PushSubscription | null;
  try {
    subscription = await registration.pushManager.getSubscription();
  } catch {
    return { status: 'failed', retryable: false, message: 'Could not check subscription status.' };
  }

  if (!subscription) {
    return { status: 'already_subscribed', endpoint: '', message: 'Notifications are already off.' };
  }

  const endpoint = subscription.endpoint;

  // Unsubscribe from push manager
  try {
    await subscription.unsubscribe();
  } catch {
    return { status: 'failed', retryable: true, message: 'Could not unsubscribe.' };
  }

  // POST to /api/push/unsubscribe
  const doFetch = opts.fetch ?? fetch;
  try {
    const res = await doFetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    if (res.ok) {
      return { status: 'already_subscribed', endpoint, message: 'Notifications are off.' };
    }
  } catch {
    return { status: 'failed', retryable: true, message: 'Could not notify the server. Try again later.' };
  }

  return { status: 'failed', retryable: true, message: 'Could not turn off notifications.' };
}

/**
 * POST subscription to /api/push/subscribe. Internal helper.
 */
async function postSubscription(
  endpoint: string,
  body: unknown,
  accessToken: string,
  fetch_?: typeof fetch
): Promise<{ ok: boolean; message: string }> {
  const doFetch = fetch_ ?? fetch;
  try {
    const res = await doFetch('/api/push/subscribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return { ok: true, message: 'Subscribed.' };
    }
    return { ok: false, message: 'Server error. Try again in a moment.' };
  } catch {
    return { ok: false, message: 'No connection. Try again when you are back online.' };
  }
}
