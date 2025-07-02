// Xtof debut modif
const CACHE_VERSION = '2025-07-02i'; // Incrémentez cette version à chaque modification
const CACHE_NAME = `my-app-cache-${CACHE_VERSION}`;
// Xtof fin modif
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  // Ajoutez ici votre fichier JSON existant
  //'/package.json', utilisé par Netlify pendant le Build donc pas utile ici
  '/manifest.json',
  // Si vous avez d'autres fichiers importants (images, polices, etc.), ajoutez-les ici aussi
  // Exemple : '/images/mon-logo.png', '/fonts/ma-police.woff'
];

self.addEventListener('install', (event) => {
  // Xtof debut modif
  self.skipWaiting(); // Force l'activation immédiate du nouveau SW
  // Xtof fin modif
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
});

// Xtof debut modif
// Nettoyer les anciens caches lors de l'activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim(); // Prend le contrôle immédiatement
      })
  );
});
// Xtof fin modif
