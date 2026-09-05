const CACHE_NAME = 'ghostkey-pwa-cache-v5';
const urlsToCache = [
  './index.html',
  './css/style.css',
  './css/mobile-dock.css',
  './js/dock.js',
  './manifest.json',
  './img/ghost-logo.png',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/favicon-32x32.png',
  './img/favicon-16x16.png',
  './img/apple-touch-icon.png'
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Fallback if offline and request fails
          // Optionally return a fallback page here
        });
      })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
