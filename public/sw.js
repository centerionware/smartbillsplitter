const CACHE_NAME = 'smart-bill-splitter-cache-v11';
const ASSETS_TO_CACHE = [
  '/',
  '/app.html',
  '/icon.svg',
];

// Install event: open a cache, add app shell files, and skip waiting.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Force the new service worker to activate immediately
      .catch(error => {
        console.error('Failed to cache app shell:', error);
      })
  );
});

// Activate event: clean up old caches and claim clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients
  );
});

// Fetch event: Apply different caching strategies based on the request type.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  console.log('On notification click: ', event.notification.tag);
  event.notification.close();

  event.waitUntil(clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clientList) => {
    for (const client of clientList) {
      if (client.url.endsWith('/app.html') && 'focus' in client) {
        return client.focus();
      }
    }
    if (clients.openWindow) {
      return clients.openWindow('/app.html');
    }
  }));
});

// --- Fallback Notification Scheduling ---
const timeoutIds = new Map();

self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, tag } = event.data;

  if (type === 'schedule-notification') {
    const { title, options, triggerTimestamp } = event.data;
    const delay = triggerTimestamp - Date.now();

    if (delay > 0) {
      console.log(`[SW] Scheduling notification "${tag}" via setTimeout in ${delay}ms.`);
      // If a timeout already exists for this tag, clear it first.
      if (timeoutIds.has(tag)) {
        clearTimeout(timeoutIds.get(tag));
      }

      const timeoutId = setTimeout(() => {
        self.registration.showNotification(title, options)
          .then(() => {
            console.log(`[SW] Notification "${tag}" shown via setTimeout.`);
            timeoutIds.delete(tag);
          })
          .catch(err => {
            console.error(`[SW] Error showing notification for tag "${tag}":`, err);
            timeoutIds.delete(tag);
          });
      }, delay);

      timeoutIds.set(tag, timeoutId);
    } else {
      console.log(`[SW] Skipped scheduling notification "${tag}" via setTimeout as it's in the past.`);
    }
  } else if (type === 'cancel-notification') {
    if (timeoutIds.has(tag)) {
      console.log(`[SW] Cancelling scheduled setTimeout for notification "${tag}".`);
      clearTimeout(timeoutIds.get(tag));
      timeoutIds.delete(tag);
    }
  }
});
