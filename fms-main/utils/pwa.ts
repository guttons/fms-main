/**
 * Dynamically updates the PWA manifest and browser meta-theme to match
 * the current app theme (light/dark). Also switches the home-screen icon
 * between icon-light.svg and icon-dark.svg.
 */
export const updatePWAManifestAndTheme = async (isDark: boolean) => {
  const themeColor      = isDark ? '#0b121f' : '#f7f9fb';
  const backgroundColor = isDark ? '#0b121f' : '#f7f9fb';
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
    const manifestData = {
      name: 'Fuel Management System',
      short_name: 'FMS',
      description: 'MACL Aviation Fuel Management System — real-time operations, fueling logs, and fleet tracking.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      background_color: backgroundColor,
      theme_color: themeColor,
      categories: ['business', 'productivity', 'utilities'],
      prefer_related_applications: false,
      icons: [
        {
          src: iconSrc,
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any'
        },
        {
          src: iconSrc,
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'maskable'
        }
      ],
      shortcuts: [
        {
          name: 'Dashboard',
          short_name: 'Dashboard',
          description: 'Open the operations dashboard',
          url: '/?view=dashboard',
          icons: [{ src: iconSrc, sizes: 'any' }]
        },
        {
          name: 'Into-Plane Fueling',
          short_name: 'Into-Plane',
          description: 'Log a fueling operation',
          url: '/?view=intoplane',
          icons: [{ src: iconSrc, sizes: 'any' }]
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
