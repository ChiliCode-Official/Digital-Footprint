const CACHE_NAME = 'ghostkey-pwa-cache-v6';
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
        return Promise.allSettled(urlsToCache.map((url) => cache.add(url)));
      })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isPageOrAppAsset = event.request.mode === 'navigate' || ['document', 'script', 'style'].includes(event.request.destination);
  if (isPageOrAppAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><body style="margin:0;background:#0B0E14;color:white;font-family:system-ui;padding:32px"><h1>GhostKey</h1><p>No se pudo cargar la tienda. Revisa tu conexión y vuelve a intentar.</p><button onclick="location.reload()">Reintentar</button></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
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
