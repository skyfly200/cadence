/**
 * Web push event handler. Imported by workbox in nuxt.config.ts.
 * Shows notifications from the nudge payload and handles clicks.
 */

// eslint-disable-next-line no-undef
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const { title, body, tag, data } = payload;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag,
        badge: '/pwa-192x192.png',
        data,
      }),
    );
  } catch {
    // Ignore parse errors; the notification is not shown.
  }
});

// eslint-disable-next-line no-undef
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { id } = event.notification.data || {};
  const action = event.action || '';

  let targetUrl = '/';
  if (id && action) {
    targetUrl = `/?nudge=${encodeURIComponent(id)}&action=${encodeURIComponent(action)}`;
  } else if (id) {
    targetUrl = `/?nudge=${encodeURIComponent(id)}`;
  }

  event.waitUntil(
    // eslint-disable-next-line no-undef
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Look for an existing window focused on this origin.
      for (const client of windowClients) {
        if (client.url === new URL(targetUrl, self.location.origin).href && 'focus' in client) {
          return client.focus();
        }
      }
      // If not found, open a new window.
      // eslint-disable-next-line no-undef
      if (clients.openWindow) {
        // eslint-disable-next-line no-undef
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
