# Terra-Core — Global Monitoring Command

A real-time, client-side monitoring console for planet Earth. Satellite
imagery, live aircraft, seismic events, the ISS, weather + air quality,
precipitation radar, space weather, the aurora oval, the day/night terminator,
and live TV — all rendered on a real 3D demographic globe.

**100% client-side. No backend, no database, no sign-in.** Every layer is
pulled directly from free public feeds in the browser. Your watchlist is
persisted in `localStorage`, so the entire app runs as a static site.

## Tech stack

- Vite + React 19 + TypeScript
- React Router v7
- Tailwind CSS v4 + shadcn/ui
- globe.gl (WebGL 3D globe) + Leaflet (2D map)
- Framer Motion, Recharts, hls.js

Use `bun` as the package manager.

## Data sources

| Layer | Source |
| --- | --- |
| Live aircraft | OpenSky Network `states/all` |
| Seismic events | USGS Earthquake Hazards (past 24h) |
| ISS position | WhereTheISS.at |
| Weather / air quality / solar | Open-Meteo + EPA AQI |
| Active NWS alerts | api.weather.gov |
| Precipitation radar | RainViewer tiles |
| Aurora oval | NOAA OVATION Prime |
| Space weather (Kp / DST) | NOAA SWPC |
| Live TV | Publicly available IPTV streams |
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

## PWA (installable + offline shell)

Terra-Core is a PWA: install it from the browser (desktop: the address-bar
install icon; mobile: Add to Home Screen) and it opens fullscreen with its own
icon. The app shell is precached, so the console loads offline — live data
feeds simply wait for a connection.

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

> **After your first Vercel deploy**, replace the placeholder domain
> `terra-core.vercel.app` in `index.html` (canonical, `og:url`, JSON-LD),
> `public/sitemap.xml` and `public/robots.txt` with your real deployment URL.

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
- `src/components/monitor/` — globe, map, ticker, status bar, panels
- `src/lib/monitor/api/` — one module per live data feed
- `src/lib/monitor/watchlist.ts` — localStorage watchlist store
- `api/` — Vercel serverless functions (keyed integrations, e.g. `api/news.ts`)
- `scripts/generate-icons.mjs` — regenerates the PWA icon set
