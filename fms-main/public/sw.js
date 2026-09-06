const CACHE_NAME = 'fms-v7';
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

// ─── Push Event Listener (Web Push for Android & iOS 16.4+) ─────────────────
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (err) {
      payload = { title: 'FMS Operational Alert', body: event.data.text() };
    }
  }

  const title = payload.title || 'FMS Alert';
  const alertType = payload.alertType || payload.data?.alertType;

  // Custom vibration patterns based on urgency
  let vibrationPattern = [300, 150, 300, 150, 400];
  if (alertType === 'NO_FUEL' || alertType === 'ETA_5MIN' || payload.urgency === 'high') {
    vibrationPattern = [500, 100, 500, 100, 500, 100, 500];
  } else if (alertType === 'LANDED') {
    vibrationPattern = [200, 100, 300];
  }

  const notificationOptions = {
    body: payload.body || 'New operational flight update',
    icon: '/icon-dark.svg',
    badge: '/icon-dark.svg',
    tag: payload.tag || `fms-alert-${alertType || 'general'}-${payload.flightNumber || Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: vibrationPattern,
    data: {
      url: payload.url || '/',
      alertType: alertType,
      flightNumber: payload.flightNumber,
      metadata: payload.metadata || {}
    },
    actions: [
      { action: 'open', title: 'Open Alert' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// ─── Notification Click Handler ─────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          // Send message to open alert in current window
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: event.notification.data
          });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
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

  // Bypass Planespotters & Aviation APIs — always go to network
  if (url.hostname.includes('planespotters.net') || url.hostname.includes('airport-data.com')) return;

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
          if (response && response.ok && response.type !== 'opaque') {
            try {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, responseToCache).catch(() => {});
              });
            } catch (err) {
              // Ignore cloning errors if body already consumed
            }
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
