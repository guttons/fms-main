const CACHE_NAME = 'fms-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-light.svg',
  '/icon-dark.svg',
];

// ─── Install ─────────────────────────────────────────────────────────────────
// Cache each asset individually so one failure doesn't abort the whole install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const results = await Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Could not pre-cache ${url}:`, err);
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        console.warn(`[SW] ${failed.length} asset(s) failed to pre-cache.`);
      }
    }).then(() => self.skipWaiting())
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
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Only http/https
  if (!url.protocol.startsWith('http')) return;

  // Bypass SW for Vite local dev (HMR, dev server)
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
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) return;

  // Bypass BigQuery API — always go to network
  if (url.pathname.includes('/operations-log') || url.pathname.includes('/external-flights') || url.hostname.includes('run.app')) return;

  // Bypass Flights API — always go to network
  if (url.hostname.includes('fis.com.mv')) return;

  // Bypass external CDN modules (esm.sh, tailwindcss CDN, etc.)
  if (
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) return;

  // Navigation (page requests): network-first, fallback to cached /
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match('/').then((r) => r || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // Static assets: cache-first, update cache in background (stale-while-revalidate)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchAndUpdate = fetch(e.request)
        .then((response) => {
          if (response && response.ok && response.type !== 'opaque' && !response.bodyUsed) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached || caches.match('/favicon.svg'));

      // Return cache immediately if available, else wait for network
      return cached || fetchAndUpdate;
    })
  );
});

// ─── Message: force update ────────────────────────────────────────────────────
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
