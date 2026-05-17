/**
 * Helper to dynamically update the PWA manifest and mobile theme colors.
 */
export const updatePWAManifestAndTheme = async (isDark: boolean) => {
  const themeColor = isDark ? '#0f1623' : '#f7f9fb';
  const backgroundColor = isDark ? '#0b121f' : '#ffffff';

  // 1. Update the meta theme-color tag for the mobile status bar
  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) {
    metaThemeColor = document.createElement('meta');
    metaThemeColor.setAttribute('name', 'theme-color');
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.setAttribute('content', themeColor);

  // iOS-specific status bar style
  let metaAppleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (!metaAppleStatus) {
    metaAppleStatus = document.createElement('meta');
    metaAppleStatus.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
    document.head.appendChild(metaAppleStatus);
  }
  // Use black-translucent for full screen theme blend, or just default
  metaAppleStatus.setAttribute('content', 'default');

  // iOS web app title
  let metaAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!metaAppleTitle) {
    metaAppleTitle = document.createElement('meta');
    metaAppleTitle.setAttribute('name', 'apple-mobile-web-app-title');
    document.head.appendChild(metaAppleTitle);
  }
  metaAppleTitle.setAttribute('content', 'Fuel Services');

  // Enable web app standalone mode for iOS
  let metaAppleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
  if (!metaAppleCapable) {
    metaAppleCapable = document.createElement('meta');
    metaAppleCapable.setAttribute('name', 'apple-mobile-web-app-capable');
    document.head.appendChild(metaAppleCapable);
  }
  metaAppleCapable.setAttribute('content', 'yes');

  // Helper to generate PNG data URLs from the same-origin SVG icon
  const svgToPng = (svgUrl: string, size: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, size, size);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      // Force same-origin to prevent canvas tainting
      img.crossOrigin = 'anonymous';
      img.src = svgUrl;
    });
  };

  try {
    const icon192 = await svgToPng('/favicon.svg', 192);
    const icon512 = await svgToPng('/favicon.svg', 512);

    const manifestData = {
      name: 'Fuel Management System',
      short_name: 'FMS',
      description: 'Aviation Fuel Management System',
      start_url: '/',
      display: 'standalone',
      background_color: backgroundColor,
      theme_color: themeColor,
      icons: [
        {
          src: icon192 || '/favicon.svg',
          sizes: '192x192',
          type: icon192 ? 'image/png' : 'image/svg+xml',
          purpose: 'any maskable'
        },
        {
          src: icon512 || '/favicon.svg',
          sizes: '512x512',
          type: icon512 ? 'image/png' : 'image/svg+xml',
          purpose: 'any maskable'
        }
      ]
    };

    // 2. Generate a Blob URL and set the manifest link to it
    const stringManifest = JSON.stringify(manifestData);
    const blob = new Blob([stringManifest], { type: 'application/manifest+json' });
    const manifestURL = URL.createObjectURL(blob);

    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.setAttribute('rel', 'manifest');
      document.head.appendChild(manifestLink);
    }
    manifestLink.setAttribute('href', manifestURL);

    // Also update apple-touch-icon dynamically to the generated high-quality PNG
    if (icon192) {
      let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (!appleTouchIcon) {
        appleTouchIcon = document.createElement('link');
        appleTouchIcon.setAttribute('rel', 'apple-touch-icon');
        document.head.appendChild(appleTouchIcon);
      }
      appleTouchIcon.setAttribute('href', icon192);
    }
  } catch (error) {
    console.error('Failed to dynamically update PWA manifest:', error);
  }
};
