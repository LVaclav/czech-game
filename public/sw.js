const CACHE_NAME = 'czech-trainer-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Handle incoming Web Push notifications (iOS 16.4+ Home Screen PWA, Android, Desktop)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Čeština — Czech Verb Trainer',
    body: 'Time to practice your Czech verb conjugations!',
    tag: 'czech-trainer-notification',
    url: '/',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
      };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const showPromise = self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'czech-trainer-notification',
    renotify: true,
    data: {
      url: payload.url || '/',
      type: payload.type || 'general',
      fromDisplayName: payload.fromDisplayName,
    },
  });

  const notifyClientsPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        client.postMessage({
          type: 'PUSH_NOTIFICATION_RECEIVED',
          payload,
        });
      }
    });

  event.waitUntil(Promise.all([showPromise, notifyClientsPromise]));
});

// Handle tapping on a native notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});

// Allow the client app to trigger native Service Worker notifications or force SW update
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'SHOW_NOTIFICATION' && data.payload) {
    const { title, body, tag, url } = data.payload;
    if (self.registration && self.registration.showNotification) {
      event.waitUntil(
        self.registration.showNotification(title || 'Čeština', {
          body: body || '',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: tag || `local-${Date.now()}`,
          data: { url: url || '/' },
        })
      );
    }
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls or Vite dev module endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/.netlify/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  // Network-first for HTML navigation, stale-while-revalidate for assets
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
