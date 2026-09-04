# Terra-Core — Global Monitoring Command

A real-time, client-side monitoring console for planet Earth. Satellite
imagery, live aircraft, seismic events, the ISS, weather + air quality,
precipitation radar, space weather, the aurora oval, the day/night terminator,
live TV, and public CCTV cameras — all rendered on a real 3D demographic
globe. Ships as a static web app, an installable PWA, and a native Android
APK.

**100% client-side. No backend, no database, no sign-in.** Every layer is
pulled directly from free public feeds in the browser. Your watchlist is
persisted in `localStorage`, so the entire app runs as a static site.

## Tech stack

- Vite + React 19 + TypeScript
- React Router v7
- Tailwind CSS v4 + shadcn/ui
- globe.gl (WebGL 3D globe) + Leaflet (2D map)
- Framer Motion, Recharts, hls.js
- Capacitor (native Android APK)

Use `bun` as the package manager (or `npm ci --legacy-peer-deps` — the CI
and APK workflow use npm).

## Data sources

| Layer | Source |
| --- | --- |
| Live aircraft | OpenSky Network (proxied via `api/flights.ts` — OpenSky blocks cross-origin browsers) |
| Seismic events | USGS Earthquake Hazards (past 24h) |
| ISS position | WhereTheISS.at |
| Weather / air quality / solar | Open-Meteo + EPA AQI |
| Active NWS alerts | api.weather.gov |
| Precipitation radar | RainViewer tiles |
| Aurora oval | NOAA OVATION Prime |
| Space weather (Kp / DST) | NOAA SWPC |
| Live TV | Publicly available IPTV streams |
| Live CCTV cameras | NASA TV mission feed + always-on HLS reference streams |
| Live wildfire heat | NASA GIBS GOES-East / GOES-West ABI Fire Temperature (Americas) |
| Live satellite positions | Celestrak TLEs, orbit-propagated (proxied via `api/satellites.ts`) |
| Internet radio | radio-browser.info (community directory) |
| World news | GDELT Project (open, proxied) · GNews API (keyed) · Google News RSS (keyless fallback) |
| Satellite imagery / country shapes | ESRI World Imagery / Natural Earth |

Weather probes anywhere: pick any of the 196 embedded countries (conditions
at the capital), use your device location, search a city, or click any point
on the globe — globe clicks reverse-geocode into real place names via
OpenStreetMap Nominatim.

## Local development

```bash
bun install
bun run dev
```

## Console extras

- **⌘K command palette** — jump to any panel, page or country instantly
- **Operator alerts** — Web notifications (and Capacitor local notifications
  in the APK) for quakes ≥ M5.5 and ISS flyovers over watchlisted places
- **Event sonification** — WebAudio cues for new quakes / ISS alerts (toggle
  in the console header)
- **CCTV patrol mode + picture-in-picture** — auto-cycle cameras, or detach
  the player into a floating window
- **Weather compare** — live conditions for two places side by side
- **Fire / satellite map-globe toggles** — GOES fire-temperature overlay on
  the map; live-propagated satellite swarm on the globe (needs the Vercel
  proxy for Celestrak CORS)

## Android APK (Capacitor)

Terra-Core also ships as a **native Android app** built with Capacitor — a
fullscreen activity + splash + app icon around the hosted frontend.

**Live-shell model (install once, always current):** the app is a thin
WebView that loads the hosted site from Vercel
(`server.url` in `capacitor.config.ts`). Users install the APK once and get
whatever the website shows that day — pushes to `main` update the site, and
the app follows automatically. No APK reinstalls when the frontend changes.
As a bonus, relative `/api/*` proxy calls (flights, news, satellites)
resolve to the same Vercel origin, so proxied feeds work inside the app too.
The trade-off is that live data requires a connection.

- `android/` — generated Capacitor project (`appId com.terra.core`)
- `.github/workflows/build-apk.yml` — builds **debug + signed release APKs**
  on every push to `main` (and on `v*.*.*` tags), uploading both as
  artifacts and attaching them to tag releases
- The app opens in a **desktop-style viewport** (1200px-wide, scaled to fit)
  for the full globe + side-panel layout on phones; a **Desktop/Mobile**
  toggle in the console header switches layouts like a browser's
  "desktop site" and remembers the choice per device
- Rebuild the shell only when the native wrapper changes (e.g. new
  Capacitor plugin, a new app icon, or a moved Vercel domain)

Build the APK yourself:

```bash
npm ci --legacy-peer-deps
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

The debug APK lands at
`android/app/build/outputs/apk/debug/app-debug.apk` (Android 6+ / API 23+).

> Keep all `@capacitor/*` packages on the **same major version** (currently
> v7, matching the committed `android/` template). Mixing CLI 7 with
> core/android 8 breaks the Gradle build with a `compileSdk` mismatch.

## PWA (installable + offline shell)

Terra-Core is a PWA: install it from the browser (desktop: the address-bar
install icon; mobile: Add to Home Screen) and it opens fullscreen with its own
icon. The app shell is precached, so the console loads offline — live data
feeds simply wait for a connection. (Prefer native? Install the Android APK
above.)

- `public/manifest.webmanifest` — install metadata (branding, colors, icons)
- `public/sw.js` — hand-rolled service worker (no workbox). It precaches the
  shell by parsing `index.html`, serves navigations network-first, and
  runtime-caches hashed assets. Bump `VERSION` after deploys.
- `public/icons/` — generated icon set. Regenerate or tweak the logo with:

  ```bash
  bun run scripts/generate-icons.mjs
  ```

The logo is the neobrutalist TC mark: volt-yellow square, ink border, "TC" in a
bitmap font. The same mark is the favicon and the in-app header badge.

## Typecheck & build

```bash
bun tsc -b --noEmit   # typecheck
bun run build         # production build (tsc + vite build)
```

## Deploying to Vercel (free, no backend required)

1. Push this repo to GitHub.
2. In [vercel.com](https://vercel.com), click **Add New → Project** and import
   the GitHub repo.
3. Vercel auto-detects Vite. Keep the defaults:
   - **Build command:** `bun run build`
   - **Output directory:** `dist`
4. Deploy. The included `vercel.json` rewrites all client-side routes
   (`/dashboard`, …) to `index.html`, so deep links work.

No environment variables, API keys, or serverless functions are required. The
app talks directly to public APIs from the browser.

> Note: some data feeds (OpenSky, NOAA) are free but rate-limited or subject to
> uptime — the status bar shows live feed health. Everything degrades
> gracefully to the last good snapshot.

> Local build note: `bun run build` needs ~2GB free; if it is killed on a
> memory-constrained machine while a dev server is running, verify with
> `bun run build -- --minify false` — the deployed build on Vercel runs in a
> fresh environment and uses full minification.

## API key integrations (Vercel environment variables)

All data feeds are free and keyless out of the box. Some integrations can be
**upgraded with an API key** — the key stays server-side in a Vercel
environment variable and is never shipped to the browser:

| Env var | Service | What it unlocks | Where to get it |
| --- | --- | --- | --- |
| `NEWS_API_KEY` | GNews | Keyed world-news feed (100 free req/day) | https://gnews.io |

**How to enable:**

1. Vercel project → **Settings → Environment Variables** → add `NEWS_API_KEY`
   with your key, then redeploy.
2. The `api/news.ts` Vercel function reads it server-side and proxies GNews.
   Responses are cached on the Vercel CDN (`s-maxage=600`), so the free quota
   is used once per 10 minutes per region — not once per visitor.
3. Without a key the app degrades gracefully to the **GDELT Project** wire
   (free, open, no key — the same source Core-X used). GDELT rate-limits
   every IP to ~1 request/5s and only sets CORS on success, so it is proxied
   through the same function (`?source=gdelt`, CDN-cached `s-maxage=300`):
   one upstream request per region per cache window serves all visitors.
   Last resort is the keyless Google News RSS feed (`PUBLIC // RSS`). The
   panel chip shows which wire is live: `KEYED // GN`, `OPEN // GDELT`, or
   `PUBLIC // RSS`.

**Extending the layer:** add a new keyed service by dropping a small function
in `api/` that reads `process.env.YOUR_KEY`, proxies the upstream call, and
returns JSON. Update the README table so operators know which env var to set.

## SEO & sharing

- `index.html` ships Open Graph, Twitter card, canonical, robots and
  JSON-LD structured data (author: Samuel Mensah, parent project: Core-X Global).
- `public/sitemap.xml` + `public/robots.txt` list all routes.
- `public/og-image.png` is the 1200×630 social preview card (regenerate with
  `bun run scripts/generate-icons.mjs`).

SEO metadata points at the live deployment domain
(`https://terra-core-nu.vercel.app/`) in `index.html` (canonical, `og:url`,
JSON-LD), `public/sitemap.xml` and `public/robots.txt`. If you deploy under a
different URL, update those three files.

## Credits

Terra-Core is an extension of
[**Core-X (Global Watch)**](https://github.com/alpha-1-design/Core-x), the
real-time 3D-globe world monitoring system by
**Samuel Mensah** ([github.com/alpha-1-design](https://github.com/alpha-1-design/)).

Core-X aggregated USGS earthquakes, Reddit, Hacker News and GDELT events over a
Python + Flask-SocketIO pipeline. Terra-Core carries the same mission forward
as a fully client-side app — no server to host, no database — with an expanded
feed suite and an optional keyed-API layer. Both are MIT-licensed parts of the
Alpha-1 ecosystem.

## Project layout

- `src/pages/` — `Landing`, `Dashboard`, `Docs`, `Faq`, `NotFound`
- `src/components/monitor/` — globe, map, ticker, status bar, panels (incl. `CctvPanel`)
- `android/` — Capacitor Android project (APK builds)
- `src/lib/monitor/api/` — one module per live data feed
- `src/lib/monitor/watchlist.ts` — localStorage watchlist store
- `api/` — Vercel serverless functions (keyed integrations, e.g. `api/news.ts`)
- `scripts/generate-icons.mjs` — regenerates the PWA icon set
