// Workbox Service Worker for U& Couples PWA
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (workbox) {
  workbox.setConfig({ debug: false });

  // Precache app shell static files
  workbox.precaching.precacheAndRoute([
    { url: '/', revision: 'v2' },
    { url: '/icon.svg', revision: 'v2' },
  ]);

  // Stale-While-Revalidate for static assets (excluding dynamic Next.js HMR chunks)
  workbox.routing.registerRoute(
    ({ request, url }) =>
      (request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'font') &&
      !url.pathname.includes('/_next/webpack') &&
      !url.pathname.includes('/_next/static/chunks/'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
    })
  );

  // Cache images using Cache First with expiration
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Network-first with fallback to cache for page navigation
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
        }),
      ],
    })
  );
}

// Push notification handling for Spark daily prompts and Nudges
self.addEventListener('push', (event) => {
  let data = { title: 'U&', body: 'Your partner is thinking of you! 💕' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'open', title: 'Open U&' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});
