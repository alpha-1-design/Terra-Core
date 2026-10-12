/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Cesium ion access token. Optional — when present, the console exposes a
   * "Photoreal 3D" globe mode. Vite inlines VITE_* into the public bundle, so
   * the token is not secret; restrict it by Allowed origins in ion.cesium.com.
   */
  readonly Config?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
