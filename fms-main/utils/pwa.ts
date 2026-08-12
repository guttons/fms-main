/**
 * Dynamically updates the PWA manifest and browser meta-theme to match
 * the current app theme (light/dark). Also switches the home-screen icon
 * between icon-light.svg and icon-dark.svg.
 */
export const updatePWAManifestAndTheme = async (theme: 'light' | 'dark' | 'black') => {
  const isDark          = theme !== 'light';
  const themeColor      = theme === 'black' ? '#0E0E0E' : (theme === 'dark' ? '#0b121f' : '#0b121f');
  const backgroundColor = theme === 'black' ? '#0E0E0E' : '#0b121f';
  const iconSrc         = isDark ? '/icon-dark.svg' : '/icon-light.svg';

  // ── 1. meta[name="theme-color"] ─────────────────────────────────────────
  let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.setAttribute('name', 'theme-color');
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.setAttribute('content', themeColor);

  // ── 2. iOS status bar style ─────────────────────────────────────────────
  let metaAppleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement | null;
  if (!metaAppleStatus) {
    metaAppleStatus = document.createElement('meta');
    metaAppleStatus.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
    document.head.appendChild(metaAppleStatus);
  }
  metaAppleStatus.setAttribute('content', isDark ? 'black-translucent' : 'default');

  // ── 3. apple-touch-icon (for iOS home screen) ───────────────────────────
  let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (!appleTouchIcon) {
    appleTouchIcon = document.createElement('link');
    appleTouchIcon.setAttribute('rel', 'apple-touch-icon');
    document.head.appendChild(appleTouchIcon);
  }
  // Point directly at the SVG — iOS 14.5+ supports SVG apple-touch-icons
  appleTouchIcon.setAttribute('href', iconSrc);

  // ── 4. Dynamic manifest blob ─────────────────────────────────────────────
  try {
    const origin = window.location.origin;
    const absIconSrc = origin + iconSrc;

    const manifestData = {
      name: 'Fuel Management System',
      short_name: 'FMS',
      description: 'MACL Aviation Fuel Management System — real-time operations, fueling logs, and fleet tracking.',
      start_url: origin + '/',
      scope: origin + '/',
      display: 'standalone',
      orientation: 'any',
      background_color: backgroundColor,
      theme_color: themeColor,
      categories: ['business', 'productivity', 'utilities'],
      prefer_related_applications: false,
      icons: [
        {
          src: absIconSrc,
          sizes: '192x192 512x512 any',
          type: 'image/svg+xml',
          purpose: 'any'
        },
        {
          src: absIconSrc,
          sizes: '192x192 512x512 any',
          type: 'image/svg+xml',
          purpose: 'maskable'
        }
      ],
      shortcuts: [
        {
          name: 'Dashboard',
          short_name: 'Dashboard',
          description: 'Open the operations dashboard',
          url: origin + '/?view=dashboard',
          icons: [{ src: absIconSrc, sizes: 'any' }]
        },
        {
          name: 'Into-Plane Fueling',
          short_name: 'Into-Plane',
          description: 'Log a fueling operation',
          url: origin + '/?view=intoplane',
          icons: [{ src: absIconSrc, sizes: 'any' }]
        }
      ]
    };

    // Revoke previous blob URL to avoid memory leaks
    const existingLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (existingLink?.href?.startsWith('blob:')) {
      URL.revokeObjectURL(existingLink.href);
    }

    const blob = new Blob([JSON.stringify(manifestData)], { type: 'application/manifest+json' });
    const manifestURL = URL.createObjectURL(blob);

    let manifestLink = existingLink;
    if (!manifestLink) {
      manifestLink = document.createElement('link') as HTMLLinkElement;
      manifestLink.setAttribute('rel', 'manifest');
      document.head.appendChild(manifestLink);
    }
    manifestLink.setAttribute('href', manifestURL);

  } catch (error) {
    console.warn('[PWA] Failed to update dynamic manifest:', error);
  }
};

/**
 * Request permission for sending native push notifications.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.warn('[PWA] Browser does not support desktop notifications');
    return 'default';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('[PWA] Error requesting notification permission:', err);
    return 'default';
  }
};

/**
 * Triggers a native device notification using Service Worker (or fallback constructor).
 */
export const sendNativeNotification = async (title: string, body: string) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: '/icon-dark.svg',
        badge: '/icon-dark.svg',
        tag: 'fms-alert',
        renotify: true,
        vibrate: [200, 100, 200]
      } as any);
    } else {
      new Notification(title, {
        body,
        icon: '/icon-dark.svg'
      });
    }
  } catch (error) {
    console.warn('[PWA] Service Worker notification failed, falling back to Constructor:', error);
    try {
      new Notification(title, {
        body,
        icon: '/icon-dark.svg'
      });
    } catch (fallbackError) {
      console.error('[PWA] Fallback native notification failed:', fallbackError);
    }
  }
};

/**
 * Sends a high-priority native notification that persists until user interacts.
 * Used for critical alerts: Request Fueling, No Fuel Required, ETA 5-min warnings.
 */
export const sendHighPriorityNotification = async (
  title: string, 
  body: string,
  options?: {
    alertType?: string;
    alertId?: string;
    flightNumber?: string;
  }
) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: '/icon-dark.svg',
        badge: '/icon-dark.svg',
        tag: 'fms-high-alert',
        renotify: true,
        requireInteraction: true, // Don't auto-dismiss — user must tap
        vibrate: [500, 200, 500, 200, 500, 200, 500], // Urgent vibration pattern
        data: {
          url: window.location.origin,
          alertType: options?.alertType,
          alertId: options?.alertId,
          flightNumber: options?.flightNumber,
        },
        actions: [
          { action: 'acknowledge', title: '✓ Acknowledge' },
          { action: 'open', title: 'Open App' }
        ]
      } as any);
    } else {
      // Fallback: basic notification (no requireInteraction support)
      new Notification(title, {
        body,
        icon: '/icon-dark.svg',
        tag: 'fms-high-alert',
        requireInteraction: true,
      } as any);
    }
  } catch (error) {
    console.warn('[PWA] High-priority notification failed:', error);
    try {
      new Notification(title, { body, icon: '/icon-dark.svg' });
    } catch (fallbackError) {
      console.error('[PWA] Fallback high-priority notification failed:', fallbackError);
    }
  }
};

/**
 * Listen for messages from the Service Worker (e.g., notification clicks).
 * Returns an unsubscribe function.
 */
export const onServiceWorkerMessage = (callback: (data: any) => void): (() => void) => {
  if (!('serviceWorker' in navigator)) return () => {};
  
  const handler = (event: MessageEvent) => {
    if (event.data && (event.data.type === 'NOTIFICATION_CLICKED' || event.data.type === 'NOTIFICATION_DISMISSED')) {
      callback(event.data);
    }
  };
  
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
};
