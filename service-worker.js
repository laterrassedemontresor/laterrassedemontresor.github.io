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
  // Xtof debut modif
  // Ignorer les requêtes vers le webhook pour éviter les problèmes CORS
  if (event.request.url.includes('virtualsmarthome.xyz')) {
    return; // Laisser la requête passer normalement sans interception du service worker
  }
  // Xtof fin modif
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
