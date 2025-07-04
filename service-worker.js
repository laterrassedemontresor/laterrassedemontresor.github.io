const CACHE_VERSION = '2025-07-03aM';
const CACHE_NAME = `montresor-gate-cache-${CACHE_VERSION}`;
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/guest_logo.png',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-16x16.png',
  '/icons/favicon.ico',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache ouvert pour version:', CACHE_VERSION);
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((err) => {
        console.error('Erreur lors de l\'installation du cache:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Suppression de l\'ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
  );
});
