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
  appleTouchIcon.setAttribute('href', '/apple-touch-icon.png');

  // ── 4. Ensure stable static manifest link (WebAPK required) ───────────────
  const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (manifestLink) {
    if (manifestLink.href.startsWith('blob:')) {
      URL.revokeObjectURL(manifestLink.href);
      manifestLink.setAttribute('href', '/manifest.json');
    }
  } else {
    const newManifestLink = document.createElement('link');
    newManifestLink.setAttribute('rel', 'manifest');
    newManifestLink.setAttribute('href', '/manifest.json');
    document.head.appendChild(newManifestLink);
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
 * Utility to convert URL-safe base64 string to Uint8Array for pushManager.subscribe()
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get active Web Push subscription if it already exists.
 */
export const getPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[PWA] Failed to get push subscription:', err);
    return null;
  }
};

export interface SerializedPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Subscribes this browser/device to Web Push using the VAPID public key.
 */
export const subscribeToWebPush = async (vapidPublicKey: string): Promise<SerializedPushSubscription | null> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[PWA] PushManager is not supported in this browser.');
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('[PWA] Notification permission was not granted:', permission);
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');

    if (!p256dhKey || !authKey) {
      console.error('[PWA] Push subscription missing encryption keys');
      return null;
    }

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

    return {
      endpoint: subscription.endpoint,
      p256dh,
      auth
    };
  } catch (error) {
    console.error('[PWA] Failed to subscribe to Web Push:', error);
    return null;
  }
};

/**
 * Unsubscribes this device from Web Push.
 */
export const unsubscribeFromWebPush = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return await subscription.unsubscribe();
    }
    return true;
  } catch (err) {
    console.error('[PWA] Failed to unsubscribe:', err);
    return false;
  }
};

