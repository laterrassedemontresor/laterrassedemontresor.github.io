const CACHE_NAME = 'my-app-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  // Ajoutez ici votre fichier JSON existant
  '/package.json', // REMPLACEZ ceci par le nom exact de votre fichier JSON
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
