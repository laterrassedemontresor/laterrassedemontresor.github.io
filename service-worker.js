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

self.addEventListener
