const CACHE_VERSION = '2025-07-03d'; // Version mise à jour
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

// Installation du Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`Cache ouvert pour version: ${CACHE_VERSION}`);
        return cache.addAll(ASSETS_TO_CACHE)
          .catch((err) => {
            console.error('Erreur lors du cache des assets:', err);
            throw err; // Propage l'erreur pour échouer l'installation
          });
      })
      .catch((err) => {
        console.error("Échec de l'installation du cache:", err);
        throw err; // Important pour que l'installation échoue clairement
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('montresor-gate-cache-')) {
              console.log("Suppression de l'ancien cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activé et anciens caches nettoyés');
        return self.clients.claim();
      })
      .catch((err) => {
        console.error('Erreur lors de l\'activation:', err);
        throw err;
      })
  );
});

// Gestion des requêtes réseau
self.addEventListener('fetch', (event) => {
  // Ne traiter que les requêtes GET
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Ne pas mettre en cache les requêtes chrome-extension ou autres schémas spéciaux
  if (!['http:', 'https:'].includes(requestUrl.protocol)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Renvoyer la réponse en cache si disponible
        if (cachedResponse) {
          console.log('Ressource servie depuis le cache:', event.request.url);
          return cachedResponse;
        }

        // Sinon, faire la requête réseau
        return fetch(event.request)
          .then((response) => {
            // Vérifier si la réponse est valide pour la mise en cache
            if (!response || 
                response.status !== 200 || 
                response.type !== 'basic' ||
                requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
              return response;
            }

            // Cloner la réponse pour la mettre en cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache)
                  .then(() => {
                    console.log('Ressource mise en cache:', event.request.url);
                  })
                  .catch((err) => {
                    console.warn('Échec de la mise en cache:', event.request.url, err);
                  });
              });

            return response;
          })
          .catch((err) => {
            console.error('Échec de la requête fetch:', event.request.url, err);
            // Vous pourriez retourner une page de fallback ici si vous en avez une
            throw err;
          });
      })
  );
});