/* TERRA-CORE service worker — hand-rolled, zero dependencies.
 *
 * Strategy:
 *  - install: precache the app shell by fetching "/" and collecting every
 *    same-origin src/href asset out of the HTML (works with hashed filenames,
 *    no build-time integration needed), plus the manifest/icons.
 *  - navigate: network-first, falling back to the cached shell (offline).
 *  - same-origin GET: cache-first (hashed assets are immutable); live data
 *    feeds are cross-origin and intentionally left to the network.
 *
 * Bump VERSION to force clients to re-precache after a deploy.
 */
const VERSION = "v1";
const SHELL_CACHE = `terra-core-shell-${VERSION}`;

const STATIC = ["/", "/favicon.svg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png"];

function sameOrigin(url) {
  return new URL(url, self.location.href).origin === self.location.origin;
}

async function collectShellAssets() {
  const res = await fetch("/", { cache: "no-store" });
  const html = await res.text();
  const assets = [];
  const re = /(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    if (url.startsWith("/") && !url.startsWith("//")) assets.push(url);
  }
  return assets;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const assets = await collectShellAssets();
        const cache = await caches.open(SHELL_CACHE);
        const unique = [...new Set([...STATIC, ...assets])];
        await cache.addAll(unique);
      } catch (err) {
        console.warn("[sw] shell precache failed (will retry on next visit):", err);
      }
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Live data feeds and anything cross-origin: default network behavior.
  if (!sameOrigin(url.href)) return;

  // Page navigations: network-first, offline falls back to the shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/", res.clone());
          return res;
        } catch {
          const cached = await caches.match("/");
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed build assets: cache-first, populate on first fetch.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    })(),
  );
});
