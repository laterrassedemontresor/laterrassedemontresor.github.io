// Update du 1er juillet 2025 - V1.1
const CACHE_NAME = 'my-app-cache-v1';
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Le cache répond en premier
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});
