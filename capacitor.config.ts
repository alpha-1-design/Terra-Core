import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Live-shell configuration: the Android app is a thin WebView that loads the
 * hosted frontend from Vercel, so users install the APK once and always get
 * the current build (no APK reinstalls when the site changes). Relative
 * /api/* calls (flights/news/satellite proxies) resolve to the same origin.
 *
 * If the Vercel deployment moves to a different domain, update `server.url`
 * and rebuild the APK.
 */
const config: CapacitorConfig = {
  appId: 'com.terra.core',
  appName: 'terra-core',
  webDir: 'dist',
  androidScheme: 'https',
  server: {
    url: 'https://terra-core-nu.vercel.app',
    cleartext: false,
  },
};

export default config;
