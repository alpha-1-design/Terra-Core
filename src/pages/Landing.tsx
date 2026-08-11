import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CloudLightning,
  Crosshair,
  Globe2,
  MonitorPlay,
  Plane,
  Radar,
  Satellite,
  Search,
  Signal,
  Tv,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fetchIss, fetchQuakes, fetchSpaceWeather } from "@/lib/monitor/api/events";
import { fetchFlights } from "@/lib/monitor/api/flights";
import {
  fetchPopulatedPlaces,
  placesToCities,
} from "@/lib/monitor/api/staticData";
import { fmtNum } from "@/lib/monitor/format";

interface LandingStats {
  flights: number | null;
  quakes: number | null;
  cities: number;
  kp: number | null;
  iss: string | null;
}

function useLandingStats(): LandingStats {
  const [stats, setStats] = useState<LandingStats>({
    flights: null,
    quakes: null,
    cities: 0,
    kp: null,
    iss: null,
  });

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const f = await fetchFlights();
        if (on) setStats((s) => ({ ...s, flights: f.length }));
      } catch { /* non-fatal */ }
      try {
        const q = await fetchQuakes();
        if (on) setStats((s) => ({ ...s, quakes: q.length }));
      } catch { /* non-fatal */ }
      try {
        const fc = await fetchPopulatedPlaces();
        if (on) setStats((s) => ({ ...s, cities: placesToCities(fc).length }));
      } catch { /* non-fatal */ }
      try {
        const sp = await fetchSpaceWeather();
        if (on) setStats((s) => ({ ...s, kp: sp.kp }));
      } catch { /* non-fatal */ }
      try {
        const i = await fetchIss();
        if (on)
          setStats((s) => ({
            ...s,
            iss: `${Math.abs(i.lat).toFixed(1)}°${i.lat >= 0 ? "N" : "S"} ${Math.abs(i.lng).toFixed(1)}°${i.lng >= 0 ? "E" : "W"}`,
          }));
      } catch { /* non-fatal */ }
    })();
    return () => {
      on = false;
    };
  }, []);

  return stats;
}

const FEATURES = [
  {
    n: "01",
    color: "#ff4d00",
    icon: Satellite,
    title: "Satellite Imagery",
    copy: "A real 3D globe textured with NASA GIBS imagery — Blue Marble, daily MODIS captures, and Black Marble night lights. Toggle live layers mid-flight.",
    source: "NASA GIBS WMTS",
  },
  {
    n: "02",
    color: "#1e5bff",
    icon: Plane,
    title: "Live Flight Radar",
    copy: "Thousands of ADS-B aircraft streamed in real time from the OpenSky Network — altitude, speed, track and origin country for every transponder in the sky.",
    source: "OpenSky Network",
  },
  {
    n: "03",
    color: "#00a651",
    icon: CloudLightning,
    title: "Weather + Air Quality",
    copy: "Current conditions, 24-hour temperature chart and 7-day forecast for any point on the planet, plus live US AQI and particulate readings.",
    source: "Open-Meteo · EPA AQI",
  },
  {
    n: "04",
    color: "#ff2e2e",
    icon: Activity,
    title: "Seismic + Space Weather",
    copy: "Every earthquake on Earth in the last 24h from USGS, the live ISS orbit, and NOAA planetary Kp / DST geomagnetic indices.",
    source: "USGS · NOAA SWPC · WhereTheISS",
  },
  {
    n: "05",
    color: "#ffd400",
    icon: Tv,
    title: "Live TV Broadcasts",
    copy: "A real index of broadcast channels per country from iptv-org — logos, playlists and HLS playback right in the console.",
    source: "iptv-org",
  },
  {
    n: "06",
    color: "#00c2d1",
    icon: Radar,
    title: "Precipitation Radar",
    copy: "Animated weather-radar overlay from RainViewer on top of OSM streets or full-res satellite maps of any city on Earth.",
    source: "RainViewer · OSM · Esri",
  },
];

const SOURCES = [
  "NASA GIBS",
  "OpenSky Network",
  "USGS",
  "Open-Meteo",
  "NOAA SWPC",
  "iptv-org",
  "RainViewer",
  "OpenStreetMap",
  "Nominatim",
  "WhereTheISS",
  "GDELT",
  "GNews",
  "Google News",
];

const MARQUEE = [
  "LIVE SATELLITE IMAGERY",
  "ADS-B FLIGHT TRACKING",
  "REAL-TIME WEATHER",
  "SEISMIC EVENT FEED",
  "SPACE WEATHER",
  "GLOBAL TV INDEX",
  "PRECIPITATION RADAR",
  "WORLD NEWS WIRE",
  "ANY CITY ON EARTH",
];

export default function Landing() {
  const stats = useLandingStats();

  const statItems: { label: string; value: string; live: boolean }[] = [
    { label: "Aircraft in the sky", value: stats.flights === null ? "…" : fmtNum(stats.flights), live: true },
    { label: "Seismic events / 24h", value: stats.quakes === null ? "…" : String(stats.quakes), live: true },
    { label: "Places indexed", value: stats.cities ? fmtNum(stats.cities) : "…", live: false },
    { label: "Kp geomag index", value: stats.kp === null ? "…" : stats.kp.toFixed(1), live: true },
  ];

  const terminalLines = [
    "[BOOT] TERRA-CORE v2.46 · all systems nominal",
    `[ADS-B] ${stats.flights === null ? "SYNC…" : `${fmtNum(stats.flights)} aircraft tracked`}`,
    `[USGS] ${stats.quakes === null ? "SYNC…" : `${stats.quakes} seismic events / 24h`}`,
    `[PLACES] ${stats.cities ? `${fmtNum(stats.cities)} populated places` : "SYNC…"}`,
    `[ISS] ${stats.iss ?? "SYNC…"}`,
    `[NOAA] Kp ${stats.kp === null ? "…" : stats.kp.toFixed(1)} · geomagnetic field nominal`,
    "[OVATION] aurora oval · computed from SWPC forecast",
    "[RADAR] 24 frames buffered · animating",
    "[TV] 18 broadcast markets indexed",
    "[NEWS] world headlines · open GDELT / keyed GNews / public RSS",
  ];

  return (
    <div className="min-h-screen bg-paper">
      {/* ── Top bar ────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b-2 border-ink bg-chalk px-4 py-3 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center border-2 border-ink bg-volt font-mono text-sm font-bold shadow-[3px_3px_0_0_#141414]">
            TC
          </span>
          <div className="leading-tight">
            <span className="block font-sans text-base font-bold uppercase tracking-tight">
              Terra-Core
            </span>
            <span className="nb-label">Global Monitoring Command</span>
          </div>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/docs"
            className="hidden border-2 border-ink bg-chalk px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-volt/30 md:block"
          >
            Docs
          </Link>
          <Link
            to="/faq"
            className="hidden border-2 border-ink bg-chalk px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-volt/30 md:block"
          >
            FAQ
          </Link>
          <Link
            to="/dashboard"
            className="hidden border-2 border-ink bg-chalk px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-volt/30 sm:block"
          >
            Console
          </Link>
          <Link
            to="/dashboard"
            className="border-2 border-ink bg-ink px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-paper shadow-[3px_3px_0_0_#ffd400] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Launch Console
          </Link>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="bg-grid border-b-2 border-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.15fr_1fr] lg:px-8 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 border-2 border-ink bg-chalk px-2 py-1 shadow-[3px_3px_0_0_#141414]">
              <span className="size-2 bg-alert blink-dot" style={{ border: "1px solid #141414" }} />
              <span className="nb-label-ink">// Global Monitoring Command</span>
            </div>

            <h1 className="mt-6 font-sans text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              See the whole planet.
              <br />
              <span className="relative inline-block bg-volt px-2" style={{ boxShadow: "4px 4px 0 0 #141414" }}>
                Live.
              </span>
            </h1>

            <p className="mt-6 max-w-xl font-sans text-base leading-relaxed text-ink-soft sm:text-lg">
              A real-time command console over the entire Earth — satellite
              imagery, every aircraft in the sky, weather and air quality,
              seismic events, space weather, live TV and precipitation radar —
              all rendered on a real 3D demographic globe. Zoom to any country
              or city. Go anywhere, virtually.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 border-2 border-ink bg-volt px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest shadow-[4px_4px_0_0_#141414] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                Launch Console <ArrowRight className="size-4" />
              </Link>
              <a
                href="#sources"
                className="inline-flex items-center gap-2 border-2 border-ink bg-chalk px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest shadow-[4px_4px_0_0_#141414] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                Data Sources
              </a>
            </div>

            {/* Stats */}
            <div className="mt-10 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
              {statItems.map((s) => (
                <div key={s.label} className="border-2 border-ink bg-chalk p-2 shadow-[3px_3px_0_0_#141414]">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {s.live && <span className="size-1.5 bg-verdant blink-dot" style={{ border: "1px solid #141414" }} />}
                    <span className="nb-label">{s.label}</span>
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Terminal panel */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col justify-center"
          >
            <div className="border-2 border-ink bg-chalk shadow-[6px_6px_0_0_#141414]">
              <div className="flex items-center gap-2 border-b-2 border-ink bg-muted px-3 py-2">
                <span className="size-3 border-2 border-ink bg-alert" />
                <span className="size-3 border-2 border-ink bg-volt" />
                <span className="size-3 border-2 border-ink bg-verdant" />
                <span className="ml-2 font-mono text-[10px] font-bold uppercase tracking-widest">
                  terra-core://streams
                </span>
              </div>
              <div className="scanlines space-y-2 p-4 font-mono text-[11px] leading-relaxed sm:text-xs">
                {terminalLines.map((line, i) => (
                  <div key={i} className={i === 0 ? "text-cobalt" : ""}>
                    <span className="text-muted-foreground">❯ </span>
                    {line}
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <span className="text-signal">▊</span>
                  <span className="blink-dot">_</span>
                </div>
              </div>
            </div>

            {/* Rotating live badge */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full border-[3px] border-dashed border-ink"
                  style={{ animation: "spin 12s linear infinite" }}
                />
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-volt shadow-[3px_3px_0_0_#141414]">
                  <span className="size-3 rounded-full bg-alert blink-dot" style={{ border: "1px solid #141414" }} />
                </div>
              </div>
              <div className="font-mono text-[10px] uppercase leading-relaxed tracking-widest text-muted-foreground">
                Every layer below is
                <br />
                <span className="font-bold text-ink">real-time public data.</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Marquee ────────────────────────────────────── */}
      <div className="flex h-9 items-center overflow-hidden border-b-2 border-ink bg-ink text-paper">
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track">
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0 items-center">
                {MARQUEE.map((m) => (
                  <span key={`${k}-${m}`} className="flex items-center">
                    <span className="px-4 font-mono text-[11px] font-bold uppercase tracking-widest">{m}</span>
                    <span className="text-volt">◆</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sources strip ──────────────────────────────── */}
      <section id="sources" className="border-b-2 border-ink bg-chalk">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="nb-chip-solid">
              <Signal className="size-3" /> Powered by real public infrastructure
            </span>
            {SOURCES.map((s) => (
              <span key={s} className="nb-chip">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="nb-label-ink">// Capabilities</span>
            <h2 className="mt-2 font-sans text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              One console. Every signal.
            </h2>
          </div>
          <Globe2 className="hidden size-12 sm:block" strokeWidth={1.5} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className="group border-2 border-ink bg-chalk shadow-[4px_4px_0_0_#141414] transition-all hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_0_#141414]"
            >
              <div className="flex items-center justify-between border-b-2 border-ink p-3" style={{ background: f.color }}>
                <f.icon className="size-5 text-white" strokeWidth={2.2} />
                <span className="font-mono text-xs font-bold text-white/90">{f.n}</span>
              </div>
              <div className="p-4">
                <h3 className="font-sans text-lg font-bold uppercase tracking-tight">{f.title}</h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-ink-soft">{f.copy}</p>
                <div className="mt-4 inline-block border-2 border-ink bg-paper px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest">
                  {f.source}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Go anywhere ────────────────────────────────── */}
      <section className="border-t-2 border-ink bg-chalk">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="nb-label-ink">// Anywhere, Virtually</span>
            <h2 className="mt-2 font-sans text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              Type a city. Fly there.
            </h2>
            <p className="mt-4 max-w-md font-sans text-base leading-relaxed text-ink-soft">
              Search any place on Earth — Nominatim geocoding takes you there.
              The 3D globe swings over, the map zooms in, and live weather,
              air quality and local broadcast TV load for that exact point.
            </p>
            <div className="mt-6 flex items-center gap-3 border-2 border-ink bg-paper px-3 py-2 shadow-[3px_3px_0_0_#141414]">
              <Search className="size-4 text-signal" />
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                e.g. “Ushuaia”, “Kathmandu”, “Reykjavík”, “Timbuktu”…
              </span>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <Crosshair className="size-4 text-cobalt" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Click any point on the globe to probe its atmosphere
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {[
              ["01", "Search", "Nominatim autocomplete over the whole planet."],
              ["02", "Zoom", "3D globe fly-to + satellite map, down to street level."],
              ["03", "Monitor", "Track the place on your watchlist; live conditions, around the clock."],
            ].map(([n, title, copy]) => (
              <div key={n} className="flex items-center gap-4 border-2 border-ink bg-chalk p-4 shadow-[4px_4px_0_0_#141414]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-ink bg-ink font-mono text-sm font-bold text-paper">
                  {n}
                </span>
                <div>
                  <h3 className="font-sans text-lg font-bold uppercase tracking-tight">{title}</h3>
                  <p className="font-sans text-sm text-ink-soft">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section className="border-t-2 border-ink bg-ink">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center lg:px-8">
          <span className="nb-chip border-signal bg-signal text-white">
            <MonitorPlay className="size-3" /> Free · No sign-in required
          </span>
          <h2 className="mt-6 font-sans text-4xl font-bold uppercase leading-[0.95] tracking-tight text-paper sm:text-6xl">
            The most advanced monitoring system
            <span className="text-volt"> in the universe.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-sans text-base text-paper/70">
            No stubs. No mock data. Every number on this page was pulled from a
            live public feed seconds ago.
          </p>
          <Link
            to="/dashboard"
            className="mt-10 inline-flex items-center gap-2 border-2 border-ink bg-volt px-8 py-4 font-mono text-sm font-bold uppercase tracking-widest shadow-[5px_5px_0_0_#ff4d00] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Launch the Console <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t-2 border-ink bg-chalk">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center border-2 border-ink bg-volt font-mono text-[10px] font-bold">
              TC
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Terra-Core © 2026 · Built by{" "}
              <a
                href="https://github.com/alpha-1-design/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline transition-colors hover:text-cobalt"
              >
                Samuel Mensah
              </a>{" "}
              · extension of Core-X Global
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            NASA GIBS · OpenSky · USGS · Open-Meteo · NOAA · iptv-org · RainViewer · OSM
          </span>
        </div>
      </footer>
    </div>
  );
}
