// SERVICE WORKER – VERSION AUTOMATIQUE

// BUILD_TIMESTAMP unique pour chaque déploiement
// Sur Netlify, on peut remplacer __BUILD_ID__ par process.env.DEPLOY_ID pendant le build
const BUILD_TIMESTAMP = '__BUILD_ID__';
const CACHE_VERSION = `v-${BUILD_TIMESTAMP}`;
const CACHE_NAME = `montresor-gate-cache-${CACHE_VERSION}`;

// Assets à mettre en cache avec versioning
const ASSETS_TO_CACHE = [
  '/',
  `/index.html?t=${BUILD_TIMESTAMP}`,
  `/style.css?t=${BUILD_TIMESTAMP}`,
  `/script.js?t=${BUILD_TIMESTAMP}`,
  `/manifest.json?t=${BUILD_TIMESTAMP}`,
  `/icons/guest_logo.png?t=${BUILD_TIMESTAMP}`,
  `/icons/android-chrome-192x192.png?t=${BUILD_TIMESTAMP}`,
  `/icons/android-chrome-512x512.png?t=${BUILD_TIMESTAMP}`,
  `/icons/apple-touch-icon.png?t=${BUILD_TIMESTAMP}`,
  `/icons/favicon-32x32.png?t=${BUILD_TIMESTAMP}`,
  `/icons/favicon-16x16.png?t=${BUILD_TIMESTAMP}`,
  `/icons/favicon.ico?t=${BUILD_TIMESTAMP}`,
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installation version', CACHE_VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(err => console.error('Erreur cache:', err))
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activation version', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.map(name => name !== CACHE_NAME && caches.delete(name))
      ))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(clients => {
            clients.forEach(client => client.postMessage({ type: 'NEW_VERSION_AVAILABLE' }));
          })
      )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;

        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
