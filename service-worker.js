const CACHE_VERSION = 'v1.3a'; // 🔥 Incrémente à chaque déploiement
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
  console.log('[SW] Installation nouvelle version:', CACHE_VERSION);
  self.skipWaiting(); // active le nouveau SW immédiatement

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((err) => console.error('Erreur de cache:', err))
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.map((name) => name !== CACHE_NAME && caches.delete(name))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // 🔥 Force le rechargement de toutes les pages actives
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => {
            clients.forEach((client) => {
              console.log('[SW] Envoi message reload à:', client.url);
              client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
            });
          });
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
