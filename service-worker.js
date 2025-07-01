// Update du 1er juillet 2025 - V1.1
// Modifie le nom du cache à chaque nouvelle version de ton app
const CACHE_NAME = 'my-app-cache-v4'; // <-- Change 'v2' à 'v3' ou plus
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  // Ajoute ici tes autres fichiers importants si nécessaire
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
  // Optionnel : Forcer l'activation immédiate du nouveau service worker.
  // Utilise ceci avec prudence car ça peut potentiellement interrompre les utilisateurs.
  // self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});

// --- Nettoyage des anciens caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Optionnel : Prendre immédiatement le contrôle des clients existants.
  // À utiliser avec self.skipWaiting() dans l'événement 'install' pour un effet immédiat.
  // event.waitUntil(clients.claim());
});
