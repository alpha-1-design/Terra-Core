import { motion } from "framer-motion";
import { BookOpen, ExternalLink, Home, Radio } from "lucide-react";
import { Link } from "react-router";

const SOURCE_ROWS: [string, string, string][] = [
  ["3D globe imagery", "NASA GIBS (Blue Marble · MODIS live · Black Marble)", "No"],
  ["Country shapes · population", "Natural Earth", "No"],
  ["Live aircraft", "OpenSky Network (ADS-B)", "No"],
  ["Earthquakes (24h)", "USGS Earthquake Hazards", "No"],
  ["ISS position", "WhereTheISS.at", "No"],
  ["Weather · solar · air quality", "Open-Meteo · EPA AQI", "No"],
  ["Active weather alerts", "NOAA / NWS", "No"],
  ["Precipitation radar", "RainViewer", "No"],
  ["Aurora oval", "NOAA OVATION Prime", "No"],
  ["Space weather (Kp / DST)", "NOAA SWPC", "No"],
  ["City search / geocoding", "Nominatim", "No"],
  ["Live TV index", "iptv-org", "No"],
  ["World news", "GDELT (open) · GNews API · Google News RSS", "Optional key"],
];

const TOC = [
  ["overview", "Overview"],
  ["sources", "Live data sources"],
  ["architecture", "Architecture"],
  ["api-keys", "API keys"],
  ["pwa", "PWA & offline"],
  ["troubleshooting", "Troubleshooting"],
  ["credits", "Credits"],
];

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="scroll-mt-20 border-2 border-ink bg-chalk shadow-[4px_4px_0_0_#141414]"
    >
      <div className="flex items-center justify-between border-b-2 border-ink bg-muted px-4 py-2">
        <h2 className="font-sans text-lg font-bold uppercase tracking-tight">
          {title}
        </h2>
        <span className="font-mono text-xs font-bold text-muted-foreground">
          {n}
        </span>
      </div>
      <div className="p-4 text-sm leading-relaxed text-ink-soft">{children}</div>
    </motion.section>
  );
}

function BrandHeader() {
  return (
    <header className="flex items-center justify-between border-b-2 border-ink bg-chalk px-4 py-3 lg:px-8">
      <Link to="/" className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center border-2 border-ink bg-volt font-mono text-sm font-bold shadow-[3px_3px_0_0_#141414]">
          TC
        </span>
        <div className="leading-tight">
          <span className="block font-sans text-base font-bold uppercase tracking-tight">
            Terra-Core
          </span>
          <span className="nb-label">Global Monitoring Command</span>
        </div>
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/"
          className="hidden border-2 border-ink bg-chalk px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-volt/30 sm:block"
        >
          <span className="flex items-center gap-1.5">
            <Home className="size-3" /> Home
          </span>
        </Link>
        <Link
          to="/faq"
          className="hidden border-2 border-ink bg-chalk px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-volt/30 sm:block"
        >
          FAQ
        </Link>
        <Link
          to="/dashboard"
          className="border-2 border-ink bg-ink px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-paper shadow-[3px_3px_0_0_#ffd400] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          Launch Console
        </Link>
      </nav>
    </header>
  );
}

export default function Docs() {
  return (
    <div className="min-h-screen bg-paper">
      <BrandHeader />

      {/* Hero */}
      <section className="border-b-2 border-ink bg-grid">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 border-2 border-ink bg-chalk px-2 py-1 shadow-[3px_3px_0_0_#141414]">
              <BookOpen className="size-3.5 text-cobalt" />
              <span className="nb-label-ink">// Documentation</span>
            </div>
            <h1 className="mt-5 font-sans text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-5xl">
              Field Manual
            </h1>
            <p className="mt-4 max-w-2xl font-sans text-base leading-relaxed text-ink-soft">
              Everything about Terra-Core: where the data comes from, how the
              architecture works, how to unlock keyed feeds, and how to fix the
              things that can occasionally go sideways.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[220px_1fr] lg:px-8">
        {/* TOC */}
        <nav className="hidden lg:block">
          <div className="sticky top-6 border-2 border-ink bg-chalk p-3 shadow-[3px_3px_0_0_#141414]">
            <span className="nb-label-ink">// Contents</span>
            <ul className="mt-2 flex flex-col gap-1">
              {TOC.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block border-l-2 border-ink/20 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-cobalt hover:text-ink"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content */}
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="overview" n="01" title="Overview">
            <p>
              Terra-Core is a real-time command console over the entire planet:
              satellite imagery on a 3D demographic globe, every aircraft in
              the sky, live weather and air quality for any point, seismic
              events, space weather, the aurora oval, precipitation radar,
              broadcast TV and a worldwide news wire.
            </p>
            <p className="mt-3">
              It is <b>100% client-side</b> — there is no app server and no
              account. Every layer is pulled directly from free public feeds
              into your browser, and the only persistence is your watchlist,
              stored in your browser&apos;s local storage.
            </p>
          </Section>

          <Section id="sources" n="02" title="Live data sources">
            <p>All layers below are real, live public data — no stubs:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b-2 border-ink bg-muted">
                    <th className="border-2 border-ink px-2 py-1.5 text-left font-bold uppercase tracking-wider">
                      Layer
                    </th>
                    <th className="border-2 border-ink px-2 py-1.5 text-left font-bold uppercase tracking-wider">
                      Source
                    </th>
                    <th className="border-2 border-ink px-2 py-1.5 text-left font-bold uppercase tracking-wider">
                      Key
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SOURCE_ROWS.map(([layer, source, key]) => (
                    <tr key={layer}>
                      <td className="border-2 border-ink px-2 py-1.5 font-semibold">
                        {layer}
                      </td>
                      <td className="border-2 border-ink px-2 py-1.5 text-muted-foreground">
                        {source}
                      </td>
                      <td className="border-2 border-ink px-2 py-1.5">
                        {key === "No" ? (
                          <span className="text-verdant">no</span>
                        ) : (
                          <span className="text-cobalt">optional</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Feeds that are rate-limited or temporarily down degrade
              gracefully — the status bar at the bottom of the console shows
              each feed&apos;s health.
            </p>
          </Section>

          <Section id="architecture" n="03" title="Architecture">
            <ul className="flex list-none flex-col gap-3">
              {[
                [
                  "Static frontend",
                  "React 19 + Vite + Tailwind. WebGL globe (globe.gl), Leaflet map, HLS video. Builds to a static site — deploy anywhere.",
                ],
                [
                  "No backend, no database",
                  "All feeds are fetched browser-side from public APIs. Your watchlist lives in localStorage on your own device.",
                ],
                [
                  "Optional edge layer",
                  "Keyed integrations run as small Vercel functions (see API keys) that keep secrets server-side. Without them, everything still works.",
                ],
                [
                  "PWA",
                  "Installable with an offline app shell; the live data simply waits for a connection when you are offline.",
                ],
              ].map(([t, c]) => (
                <li
                  key={t}
                  className="flex gap-3 border-2 border-ink bg-paper p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-ink bg-ink font-mono text-xs font-bold text-paper">
                    {t.slice(0, 1)}
                  </span>
                  <div>
                    <h3 className="font-sans text-sm font-bold uppercase tracking-tight">
                      {t}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                      {c}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="api-keys" n="04" title="API keys">
            <p>
              Everything works with zero configuration. A few feeds can be{" "}
              <b>upgraded with an API key</b> — the key is stored as a Vercel
              environment variable and read server-side, so it never reaches
              your browser.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b-2 border-ink bg-muted">
                    <th className="border-2 border-ink px-2 py-1.5 text-left font-bold uppercase tracking-wider">
                      Env var
                    </th>
                    <th className="border-2 border-ink px-2 py-1.5 text-left font-bold uppercase tracking-wider">
                      Unlocks
                    </th>
                    <th className="border-2 border-ink px-2 py-1.5 text-left font-bold uppercase tracking-wider">
                      Get it
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-2 border-ink px-2 py-1.5 font-semibold">
                      NEWS_API_KEY
                    </td>
                    <td className="border-2 border-ink px-2 py-1.5 text-muted-foreground">
                      Keyed GNews world-news feed (100 free req/day)
                    </td>
                    <td className="border-2 border-ink px-2 py-1.5">
                      <a
                        href="https://gnews.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cobalt underline hover:text-ink"
                      >
                        gnews.io <ExternalLink className="size-3" />
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ol className="mt-3 flex list-none flex-col gap-2">
              {[
                "Vercel project → Settings → Environment Variables",
                "Add NEWS_API_KEY and paste your key, then redeploy",
                "The console switches the news feed to KEYED // GN (responses are CDN-cached, so one upstream call serves all visitors)",
                "No key? The feed auto-falls back to the open GDELT wire (keyless, proxied via api/news.ts), then Google News RSS — the console is never dead",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center border-2 border-ink bg-volt font-mono text-[9px] font-bold">
                    {i + 1}
                  </span>
                  <span className="text-xs leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="pwa" n="05" title="PWA & offline">
            <p>
              Terra-Core is an installable PWA. On desktop, click the install
              icon in the address bar; on mobile, use{" "}
              <i>Add to Home Screen</i>. It then opens fullscreen with its own
              icon.
            </p>
            <p className="mt-3">
              The app shell (landing + console UI) is precached by the service
              worker, so it loads offline. Live data needs a connection — feeds
              simply wait and resume. After visiting the console online once,
              it is available offline too.
            </p>
          </Section>

          <Section id="troubleshooting" n="06" title="Troubleshooting">
            <ul className="flex list-none flex-col gap-3">
              {[
                [
                  "A feed shows red in the status bar",
                  "Public APIs occasionally rate-limit or go down. The app keeps the last good snapshot and retries on the poll cycle — most feeds recover by themselves.",
                ],
                [
                  "Some TV channels won't play",
                  "Broadcast streams are geo-blocked or offline more often than not. The panel auto-advances to the next working source, and the reference feeds always play.",
                ],
                [
                  "Flight list is empty",
                  "OpenSky rate-limits anonymous clients (roughly once per 10 seconds per IP). It refills on the next poll.",
                ],
                [
                  "Offline shows the shell but no live data",
                  "That is by design — live feeds require a connection; your watchlist and settings still work.",
                ],
              ].map(([t, c]) => (
                <li
                  key={t}
                  className="border-2 border-ink bg-paper p-3"
                >
                  <h3 className="font-sans text-sm font-bold uppercase tracking-tight">
                    {t}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{c}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="credits" n="07" title="Credits">
            <p className="font-sans text-sm">
              <b>Terra-Core</b> is an extension of{" "}
              <a
                href="https://github.com/alpha-1-design/Core-x"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-cobalt underline hover:text-ink"
              >
                Core-X (Global Watch) <ExternalLink className="size-3" />
              </a>
              , the real-time global monitoring system built by{" "}
              <a
                href="https://github.com/alpha-1-design/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-cobalt underline hover:text-ink"
              >
                Samuel Mensah <ExternalLink className="size-3" />
              </a>
              .
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              <b>The lineage:</b> Core-X put situational awareness on a 3D globe
              with a Python ingestion pipeline and WebSocket broadcasts.{" "}
              <b>Terra-Core</b> carries that mission forward — same globe, same
              multi-source monitoring, same instant-fly-to awareness — but
              rebuilt as a fully client-side app: no server to run, no
              database, and a far wider feed suite, from ADS-B aircraft to the
              aurora oval. Both are MIT-licensed parts of the Alpha-1 ecosystem.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Grateful to the free public infrastructure this console runs on:
              NASA GIBS, OpenSky Network, USGS, NOAA SWPC, NOAA OVATION,
              Open-Meteo, EPA, NWS, RainViewer, WhereTheISS, Natural Earth,
              OpenStreetMap / Nominatim, iptv-org, the GDELT Project, GNews and Google News.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Radio className="size-4 text-signal blink-dot" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                All systems nominal — thanks for monitoring with us.
              </span>
            </div>
          </Section>
        </div>
      </div>

      <footer className="border-t-2 border-ink bg-chalk">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 lg:px-8">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Terra-Core © 2026 · Built by Samuel Mensah · Core-X Global
          </span>
          <Link
            to="/dashboard"
            className="border-2 border-ink bg-volt px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest shadow-[3px_3px_0_0_#141414] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Launch Console
          </Link>
        </div>
      </footer>
    </div>
  );
}
