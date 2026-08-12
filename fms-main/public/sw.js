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

// ─── Push Notification Handler ───────────────────────────────────────────────
// Handles push events for background notifications (when app is in background)
self.addEventListener('push', (e) => {
  if (!e.data) return;

  let payload;
  try {
    payload = e.data.json();
  } catch (_err) {
    payload = { title: 'FMS Alert', body: e.data.text() };
  }

  const title = payload.title || 'FMS Alert';
  const body = payload.body || payload.message || '';
  const isHighAlert = (payload.alertType || '').startsWith('REQUEST_') || 
                      (payload.alertType || '').startsWith('NO_FUEL') ||
                      (payload.alertType || '').startsWith('ETA_5MIN');
  const isCritical = payload.severity === 'critical' || isHighAlert;

  const options = {
    body,
    icon: '/icon-dark.svg',
    badge: '/icon-dark.svg',
    tag: isCritical ? 'fms-high-alert' : 'fms-alert',
    renotify: true,
    requireInteraction: isCritical, // Don't auto-dismiss critical alerts
    vibrate: isCritical 
      ? [500, 200, 500, 200, 500, 200, 500] // Urgent pattern
      : [200, 100, 200],                      // Standard pattern
    data: {
      url: self.registration.scope,
      alertType: payload.alertType,
      alertId: payload.alertId,
      flightNumber: payload.flightNumber,
    },
    actions: isCritical ? [
      { action: 'acknowledge', title: '✓ Acknowledge' },
      { action: 'open', title: 'Open App' }
    ] : [
      { action: 'open', title: 'Open' }
    ]
  };

  e.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Notification Click Handler ──────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const data = e.notification.data || {};
  const urlToOpen = data.url || self.registration.scope;

  // Build URL with view parameter based on alert type
  let targetUrl = urlToOpen;
  if (data.alertType && data.alertType.startsWith('ETA_')) {
    targetUrl = urlToOpen + '?view=intoplane';
  } else if (data.alertType === 'REQUEST_FUELING' || data.alertType === 'NO_FUEL') {
    targetUrl = urlToOpen + '?view=intoplane';
  }

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          // Post message to the app to show the alert
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            alertId: data.alertId,
            alertType: data.alertType,
            flightNumber: data.flightNumber,
            action: e.action || 'open'
          });
          return client.focus();
        }
      }
      // Open new window if no existing window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Notification Close Handler ──────────────────────────────────────────────
self.addEventListener('notificationclose', (e) => {
  const data = e.notification.data || {};
  // Notify the app that the notification was dismissed
  self.clients.matchAll({ type: 'window' }).then((clientList) => {
    for (const client of clientList) {
      client.postMessage({
        type: 'NOTIFICATION_DISMISSED',
        alertId: data.alertId,
        alertType: data.alertType
      });
    }
  });
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

  // Bypass Auth API — always go to network
  if (url.pathname.includes('/auth/')) return;

  // Bypass Flights API — always go to network
  if (url.hostname.includes('fis.com.mv')) return;

  // Bypass FlightRadar24 — always go to network
  if (url.hostname.includes('flightradar24.com')) return;

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
