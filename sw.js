const CACHE_NAME = 'smart-bill-splitter-cache-v10';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
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

  // Strategy: Network-first for navigation requests (the HTML page itself).
  // This ensures users always get the latest version of the app shell if they are online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If the fetch is successful, cache the new version for offline use.
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // If the network fails (offline), serve the page from the cache.
          return caches.match(event.request);
        })
    );
    return;
  }

  // Strategy: Cache-first for all other assets (JS, CSS, images, etc.).
  // These assets are less likely to change frequently, so serving from cache is faster.
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});