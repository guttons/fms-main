const CACHE_NAME = 'fms-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-light.svg',
  '/icon-dark.svg',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  // Only GET requests
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Only http/https
  if (!url.protocol.startsWith('http')) return;

  // Bypass SW for local dev (Vite HMR / dev server)
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@react-refresh') ||
    url.search.includes('t=')
  ) {
    return;
  }

  // Bypass Supabase API — always go to network
  if (url.hostname.includes('supabase.co')) return;

  // Bypass external CDN modules (esm.sh, tailwindcss, etc.)
  if (
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('cdn.tailwindcss.com')
  ) return;

  // Navigation (page requests): network-first, fallback to cached /
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match('/').then((r) => r || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Static assets: cache-first, update cache in background
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchAndCache = fetch(e.request).then((response) => {
        if (response && response.ok && response.type !== 'opaque') {
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, response.clone()));
        }
        return response;
      });
      return cached || fetchAndCache;
    }).catch(() => {
      // For image/icon requests, return a cached fallback if possible
      return caches.match('/favicon.svg');
    })
  );
});

// ─── Message: skip waiting ────────────────────────────────────────────────────
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
