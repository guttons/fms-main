const CACHE_NAME = 'fms-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // 1. Only intercept GET requests
  if (e.request.method !== 'GET') return;

  // 2. Only intercept http/https requests (bypasses chrome-extension:// etc.)
  const url = new URL(e.request.url);
  if (!url.protocol.startsWith('http')) return;

  // 3. Bypass Service Worker caching for Vite local development endpoints/HMR
  if (
    url.hostname === 'localhost' || 
    url.hostname === '127.0.0.1' ||
    url.pathname.includes('/@vite/') || 
    url.pathname.includes('/@react-refresh') ||
    url.search.includes('t=')
  ) {
    return; // Let browser handle it directly without SW interception
  }

  // 4. For standard assets/requests, use cache-first / network-fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(e.request).catch((err) => {
        // Fallback for page navigation when offline
        if (e.request.mode === 'navigate') {
          return caches.match('/');
        }
        // Throw error so it doesn't resolve to undefined and trigger 'Failed to convert value to Response'
        throw err;
      });
    })
  );
});
