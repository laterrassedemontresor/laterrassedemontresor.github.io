// Version du cache
const CACHE_VERSION = 'v1.1';
const CACHE_NAME = `montresor-gate-cache-${CACHE_VERSION}`;

// Liste des assets à pré-cacher
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

// Installation du service worker et pré-cache des assets
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

// Activation : suppression des anciens caches et notification des clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Notifier les clients qu'une nouvelle version est disponible
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'NEW_VERSION_AVAILABLE' }));
        });
      })
  );
});

// Gestion des fetch requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => cachedResponse || fetch(event.request))
      .then((response) => {
        // Mettre à jour le cache avec la nouvelle réponse
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => {
        // Fallback si tout échoue (ex: offline)
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});
