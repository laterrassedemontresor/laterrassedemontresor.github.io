// Version du cache
// 🚨 IMPORTANT : Incrémenter cette constante à chaque déploiement pour déclencher la mise à jour !
const CACHE_VERSION = 'v1.2'; // <-- Incrémenté
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
  self.skipWaiting(); // <-- Gardé : Force le passage de 'waiting' à 'activating'
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
      .then(() => self.clients.claim()) // <-- Gardé : Prend le contrôle immédiatement
      .then(() => {
        // Notifier les clients qu'une nouvelle version est disponible
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'NEW_VERSION_AVAILABLE' }));
        });
      })
  );
});

// Gestion des fetch requests (Stratégie: Cache, puis Network pour le reste)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Pour les ressources pré-cachées (votre app), utilisez 'Cache Only'.
  // Pour les autres ressources (Firebase, webhooks, etc.), utilisez 'Cache, puis Network'.
  if (ASSETS_TO_CACHE.includes(new URL(event.request.url).pathname)) {
    // Si c'est un asset critique, servez-le DIRECTEMENT du cache de la nouvelle version
    event.respondWith(caches.match(event.request));
    return;
  }


  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Si c'est dans le cache, retournez-le (pour les dépendances comme Firebase si elles y sont)
        if (cachedResponse) return cachedResponse;
        
        // Sinon, faites une requête réseau
        return fetch(event.request)
          .catch(() => {
            // Fallback si la requête réseau échoue et que c'est une navigation (index.html)
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});
