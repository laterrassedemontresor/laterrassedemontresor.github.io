// service-worker.js

// 🚨 ÉTAPE 1 : TOUJOURS INCRÉMENTER CETTE VERSION À CHAQUE DÉPLOIEMENT
// Par exemple, passez de 'v1.2' à 'v1.3' pour la prochaine mise à jour.
const CACHE_VERSION = 'v1.5'; 
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
  self.skipWaiting(); // <-- Force l'activation immédiate du nouveau Service Worker
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
      .then(() => self.clients.claim()) // <-- Prend le contrôle de tous les onglets ouverts
      .then(() => {
        // Notifier les clients qu'une nouvelle version est disponible
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'NEW_VERSION_AVAILABLE' }));
        });
      })
  );
});

// Gestion des fetch requests : Stratégie "Cache First, puis Network comme repli"
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Ignore les requêtes vers des domaines externes (Firebase, webhooks, Google)
  if (url.origin !== location.origin) return; 
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // 1. Tente de servir du cache (qui est le nouveau cache v1.3)
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 2. Si la ressource manque dans le cache (cause de l'écran blanc), essaie le réseau
        return fetch(event.request)
          .catch(() => {
            // 3. Si tout échoue, pour une navigation (le chargement de la page), retourne l'index en cache.
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});
