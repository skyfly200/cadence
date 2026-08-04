/**
 * Local (client-side) notifications. Fired while the app is open — an
 * installed PWA counts. No push server, so nothing fires when fully closed.
 */

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showNotification(title: string, options: NotificationOptions = {}): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const opts: NotificationOptions = { icon: '/logo.svg', badge: '/logo.svg', ...options };
  try {
    // Prefer the service worker so notifications behave well and de-dupe by tag.
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification(title, opts); return; }
    }
    // eslint-disable-next-line no-new
    new Notification(title, opts);
  } catch {
    /* ignore — best effort */
  }
}
