import { Capacitor } from "@capacitor/core";
import CitySearch from "@/components/monitor/CitySearch";
import StatusBar from "@/components/monitor/StatusBar";
import Ticker from "@/components/monitor/Ticker";
import { useEventAlerts } from "@/lib/monitor/useEventAlerts";
import { useOtaUpdate } from "@/lib/monitor/useOtaUpdate";
import { openReleasePage } from "@/lib/monitor/ota";
import {
  isSoundEnabled,
  playUiBlip,
  setSoundEnabled,
} from "@/lib/monitor/sound";
import type {
  WeatherLocation,
} from "@/components/monitor/panels/WeatherPanel";
import { fetchAurora, AURORA_POLL_MS } from "@/lib/monitor/api/aurora";
import { fetchCctvStreams, CCTV_POLL_MS } from "@/lib/monitor/api/cctv";
import { fetchFlights, FLIGHT_POLL_MS } from "@/lib/monitor/api/flights";
import { fetchSatellites, SAT_POLL_MS } from "@/lib/monitor/api/satellites";
import { reverseGeocode } from "@/lib/monitor/api/geocode";
import {
  fetchIss,
  fetchQuakes,
  fetchSpaceWeather,
} from "@/lib/monitor/api/events";
import { fetchNewsFeed, NEWS_POLL_MS } from "@/lib/monitor/api/news";
import { latestFireDate } from "@/lib/monitor/api/fires";
import { fetchRadarFrames } from "@/lib/monitor/api/radar";
import {
  fetchPopulatedPlaces,
  placesToCities,
} from "@/lib/monitor/api/staticData";
import { DEMO_STREAMS } from "@/lib/monitor/api/tv";
import type {
  Country,
  FocusTarget,
  ImageryMode,
} from "@/lib/monitor/types";
import { usePolling } from "@/lib/monitor/usePolling";
import { useWatchlist } from "@/lib/monitor/watchlist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Flame,
  HardDrive,
  MonitorSmartphone,
  Radio,
  Satellite,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { lazyWithRetry } from "@/lib/monitor/lazyWithRetry";
import ChunkErrorBoundary from "@/components/monitor/ChunkErrorBoundary";

/*
 * These are the heaviest dependencies in the app by a wide margin
 * (globe.gl + three ~90MB unpacked, leaflet, recharts) — statically
 * importing them all here was what made the Dashboard route ship as one
 * ~3.3MB/960KB-gzip chunk, which is why tapping "Launch Console" had a
 * long, blank-looking delay before anything appeared, especially on a
 * slow connection. Splitting each into its own lazy chunk means:
 *   - the Dashboard shell (header, tabs, layout) downloads and becomes
 *     interactive almost immediately;
 *   - the globe and map load in parallel, in their own chunks, instead of
 *     blocking the whole page behind one giant bundle; and
 *   - inactive tab panels (TV, CCTV, Radio, News, Watch, Events) never
 *     download at all until the operator actually clicks that tab.
 *
 * lazyWithRetry + ChunkErrorBoundary (below) exist because splitting into
 * separate network requests means any one of them can now fail on its own
 * (stale hash after a redeploy, or a dropped request on a slow/flaky
 * connection) — without them that failure crashed the whole dashboard
 * instead of just the one piece that couldn't load.
 */
const GlobeView = lazyWithRetry(() => import("@/components/monitor/GlobeView"), "globe");
const MapView = lazyWithRetry(() => import("@/components/monitor/MapView"), "map");
const CommandPalette = lazyWithRetry(() => import("@/components/monitor/CommandPalette"), "palette");
const FlightsPanel = lazyWithRetry(() => import("@/components/monitor/panels/FlightsPanel"), "flights");
const EventsPanel = lazyWithRetry(() => import("@/components/monitor/panels/EventsPanel"), "events");
const WeatherPanel = lazyWithRetry(() => import("@/components/monitor/panels/WeatherPanel"), "weather");
const TvPanel = lazyWithRetry(() => import("@/components/monitor/panels/TvPanel"), "tv");
const CctvPanel = lazyWithRetry(() => import("@/components/monitor/panels/CctvPanel"), "cctv");
const RadioPanel = lazyWithRetry(() => import("@/components/monitor/panels/RadioPanel"), "radio");
const NewsPanel = lazyWithRetry(() => import("@/components/monitor/panels/NewsPanel"), "news");
const WatchlistPanel = lazyWithRetry(() => import("@/components/monitor/panels/WatchlistPanel"), "watchlist");

/* Lightweight, non-blocking placeholders — shown only for the split-off
   chunk's own brief load time, not the whole page. */
function PaneLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[160px] w-full items-center justify-center bg-chalk">
      <span className="animate-pulse font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Loading {label}…
      </span>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const watchlist = useWatchlist();

  /* ── Live data streams ─────────────────────────────── */
  const [satsEnabled, setSatsEnabled] = useState(false);
  const flights = usePolling(fetchFlights, { intervalMs: FLIGHT_POLL_MS });
  const cctv = usePolling(fetchCctvStreams, { intervalMs: CCTV_POLL_MS });
  const sats = usePolling(fetchSatellites, {
    enabled: satsEnabled,
    intervalMs: SAT_POLL_MS,
  });
  const quakes = usePolling(fetchQuakes, { intervalMs: 60_000 });
  const iss = usePolling(fetchIss, { intervalMs: 10_000 });
  const space = usePolling(fetchSpaceWeather, { intervalMs: 5 * 60_000 });
  const radar = usePolling(fetchRadarFrames, { intervalMs: 5 * 60_000 });
  const aurora = usePolling(fetchAurora, { intervalMs: AURORA_POLL_MS });

  const [newsRegion, setNewsRegion] = useState("world");
  const newsFetcher = useCallback(() => fetchNewsFeed(newsRegion), [newsRegion]);
  const news = usePolling(newsFetcher, { intervalMs: NEWS_POLL_MS });
  // Refetch immediately when the operator switches news region.
  // Refetch news immediately when the region changes (the polling cadence
  // would otherwise be too slow). The guard makes the extra `news` dependency
  // a no-op on poll updates — it only acts when the region actually changes.
  const prevNewsRegion = useRef(newsRegion);
  useEffect(() => {
    if (prevNewsRegion.current !== newsRegion) {
      prevNewsRegion.current = newsRegion;
      void news.refresh();
    }
  }, [newsRegion, news]);

  const [cityCount, setCityCount] = useState(0);
  useEffect(() => {
    fetchPopulatedPlaces()
      .then((fc) => setCityCount(placesToCities(fc).length))
      .catch(() => setCityCount(0));
  }, []);

  /* ── UI state ──────────────────────────────────────── */
  const [imagery, setImagery] = useState<ImageryMode>("day");
  const [baseLayer, setBaseLayer] = useState<"streets" | "satellite">("satellite");
  const [radarEnabled, setRadarEnabled] = useState(true);
  const [firesEnabled, setFiresEnabled] = useState(true);
  const firesDate = latestFireDate();
  const [auroraEnabled, setAuroraEnabled] = useState(true);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [tab, setTab] = useState("flights");
  const [tvIndexed, setTvIndexed] = useState(0);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [paletteOpen, setPaletteOpen] = useState(false);

  /* In the Android app: "desktop site" viewport toggle (like a browser). */
  const isNative = Capacitor.isNativePlatform();
  const [desktopView, setDesktopView] = useState(() => {
    try {
      return (
        document
          .getElementById("viewport-meta")
          ?.getAttribute("content")
          ?.includes("width=1200") ?? false
      );
    } catch {
      return false;
    }
  });
  const handleDesktopToggle = () => {
    (window as unknown as { toggleDesktopView?: () => void })
      .toggleDesktopView?.();
    setDesktopView((v) => !v);
  };

  /* ── Alerts: big quakes + ISS flyovers over the watchlist ── */
  const alerts = useEventAlerts({
    quakes: quakes.data,
    iss: iss.data,
    watch: watchlist.items.map((w) => ({
      id: w.id,
      name: w.name,
      lat: w.lat,
      lng: w.lng,
    })),
  });
  const alertTotal = alerts.counts.quakeCount + alerts.counts.flyoverCount;

  /* ── OTA: native updates from GitHub Releases ── */
  const ota = useOtaUpdate();

  const handleSoundToggle = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playUiBlip();
  };

  const handleAlertBell = () => {
    if (alerts.enabled) {
      alerts.disable();
      toast.info("Alerts muted");
      return;
    }
    void alerts.enable().then((ok) => {
      if (ok) toast.success("Alerts on — big quakes + ISS flyovers");
      else toast.info("Notifications are blocked by the browser");
    });
  };
  /* Mission default probe point — replaced the moment a real location is
     chosen (search, globe, country picker, or geolocation). */
  const [weatherLoc, setWeatherLoc] = useState<WeatherLocation>({
    name: "San Francisco",
    lat: 37.7749,
    lng: -122.4194,
  });
  const defaultLocRef = useRef(true);
  const applyLoc = useCallback((loc: WeatherLocation) => {
    defaultLocRef.current = false;
    setWeatherLoc(loc);
  }, []);

  /* If the operator grants location, probe from there instead of the
     San Francisco default — one silent attempt, never an error surface. */
  useEffect(() => {
    if (!defaultLocRef.current || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!defaultLocRef.current) return;
        const loc: WeatherLocation = {
          name: "Your location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        defaultLocRef.current = false;
        setWeatherLoc(loc);
        void reverseGeocode(loc.lat, loc.lng).then((n) => {
          if (n && defaultLocRef.current === false) {
            setWeatherLoc({ name: n, lat: loc.lat, lng: loc.lng });
          }
        });
      },
      () => {
        /* permission denied / unavailable — keep the mission default */
      },
      { timeout: 8000, maximumAge: 10 * 60_000 },
    );
  }, []);

  const isWatched = watchlist.isWatched(weatherLoc.name);

  /* ── Handlers ──────────────────────────────────────── */
  const handlePick = (name: string, lat: number, lng: number) => {
    applyLoc({ name, lat, lng });
    setFocus({ id: `city-${name}`, kind: "city", lat, lng, label: name });
    setTab("weather");
  };

  const handleCountryPick = (c: Country) => {
    const label = `${c.name} — ${c.capital}`;
    applyLoc({ name: label, lat: c.lat, lng: c.lng });
    setFocus({ id: `country-${c.code}`, kind: "city", lat: c.lat, lng: c.lng, label });
    setTab("weather");
  };

  const handleUseMyLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: WeatherLocation = {
          name: "Your location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        applyLoc(loc);
        setFocus({ id: "my-location", kind: "city", lat: loc.lat, lng: loc.lng, label: loc.name });
        setTab("weather");
        void reverseGeocode(loc.lat, loc.lng).then((n) => {
          if (n) setWeatherLoc({ name: n, lat: loc.lat, lng: loc.lng });
        });
      },
      () => toast.error("Location permission denied — keeping current probe"),
      { timeout: 10_000 },
    );
  };

  const handleFocus = (t: FocusTarget) => {
    setFocus(t);
    if (t.kind === "city" || t.kind === "watch") {
      applyLoc({ name: t.label, lat: t.lat, lng: t.lng });
    }
  };

  /* Globe clicks start as a raw POINT and resolve to a real place name via
     reverse geocoding when it lands (Nominatim ≈1 req/s, click-driven). */
  const globeClickSeq = useRef(0);
  const handleGlobePoint = (lat: number, lng: number) => {
    const seq = ++globeClickSeq.current;
    const name = `POINT ${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(
      lng,
    ).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
    applyLoc({ name, lat, lng });
    setFocus({ id: name, kind: "point", lat, lng, label: name });
    void reverseGeocode(lat, lng).then((resolved) => {
      if (!resolved || seq !== globeClickSeq.current) return;
      setWeatherLoc({ name: resolved, lat, lng });
      setFocus({ id: resolved, kind: "point", lat, lng, label: resolved });
    });
  };

  const handleWatchToggle = (loc: WeatherLocation) => {
    const added = watchlist.add(loc.name, loc.lat, loc.lng, "manual");
    if (added) {
      toast.success(`Now tracking ${loc.name}`);
    } else {
      toast.info(`${loc.name} is already tracked`);
    }
  };

  const imageryButtons: { mode: ImageryMode; label: string }[] = [
    { mode: "day", label: "DAY" },
    { mode: "live", label: "LIVE SAT" },
    { mode: "night", label: "NIGHT" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-paper lg:h-screen lg:overflow-hidden">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-ink bg-chalk px-4 py-2">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex shrink-0 items-center gap-2"
          title="Back to mission control page"
        >
          <span className="flex h-9 w-9 items-center justify-center border-2 border-ink bg-volt font-mono text-sm font-bold shadow-[3px_3px_0_0_#141414]">
            TC
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block font-sans text-sm font-bold uppercase tracking-tight">
              Terra-Core
            </span>
            <span className="nb-label">Global Monitoring Command</span>
          </span>
        </button>

        <div className="min-w-[220px] flex-1">
          <CitySearch onPick={handlePick} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isNative && (
            <button
              type="button"
              onClick={handleDesktopToggle}
              className={`flex items-center gap-1 border-2 border-ink px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors ${
                desktopView ? "bg-ink text-paper" : "bg-chalk hover:bg-volt/30"
              }`}
              title={
                desktopView
                  ? "Desktop layout — tap for mobile layout"
                  : "Mobile layout — tap for desktop site"
              }
            >
              <MonitorSmartphone className="size-3.5" />
              {desktopView ? "Desktop" : "Mobile"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="border-2 border-ink bg-chalk px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors hover:bg-volt/30"
            title="Command palette (⌘K)"
          >
            ⌘K
          </button>
          <button
            type="button"
            onClick={handleSoundToggle}
            className={`border-2 border-ink p-1.5 transition-colors ${
              soundOn ? "bg-volt" : "bg-chalk hover:bg-volt/30"
            }`}
            title={soundOn ? "Mute event sounds" : "Enable event sounds"}
          >
            {soundOn ? (
              <Volume2 className="size-3.5" />
            ) : (
              <VolumeX className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleAlertBell}
            className={`relative border-2 border-ink p-1.5 transition-colors ${
              alerts.enabled ? "bg-cobalt text-white" : "bg-chalk hover:bg-cobalt/20"
            }`}
            title={
              alerts.enabled
                ? "Alerts on — click to mute"
                : "Enable quake + ISS flyover alerts"
            }
          >
            <Bell className="size-3.5" />
            {alertTotal > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-ink bg-alert px-0.5 font-mono text-[8px] font-bold text-white">
                {alertTotal}
              </span>
            )}
          </button>
          <span className="nb-chip border-verdant text-verdant">
            <Radio className="size-3 blink-dot" /> Live
          </span>
          <span className="nb-chip border-cobalt text-cobalt">
            <HardDrive className="size-3" />
            Local mode · no sign-in
          </span>
        </div>
      </header>

      {/* ── Native update banner (APK-only, from GitHub Releases) ── */}
      {ota.isNative && ota.update && (
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-volt/30 px-3 py-1.5">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest">
            <Satellite className="size-3" /> Native update {ota.update.tag} available
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {ota.currentVersion ? `Installed ${ota.currentVersion} · ` : ""}app shell change
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void openReleasePage(ota.update!.htmlUrl)}
            className="border-2 border-ink bg-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-paper transition-colors hover:bg-cobalt"
          >
            Download APK
          </button>
          <button
            type="button"
            onClick={() => ota.dismiss(ota.update!.tag)}
            className="border-2 border-ink bg-chalk px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors hover:bg-alert hover:text-white"
            title="Hide until the next release"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Live event ticker ──────────────────────────── */}
      <Ticker
        quakes={quakes.data ?? []}
        iss={iss.data}
        space={space.data ?? { kp: null, kpTime: null, dst: null, dstTime: null }}
        aurora={aurora.data}
        news={news.data}
      />

      {/* ── Main command area ──────────────────────────── */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 3D globe */}
        <section className="relative h-[52vh] min-h-[360px] overflow-hidden border-b-2 border-ink lg:h-auto lg:min-h-0 lg:flex-1 lg:border-b-0 lg:border-r-2">
          <ChunkErrorBoundary label="globe">
            <Suspense fallback={<PaneLoading label="globe" />}>
              <GlobeView
                imagery={imagery}
                flights={flights.data ?? []}
                quakes={quakes.data ?? []}
                iss={iss.data}
                aurora={aurora.data}
                auroraEnabled={auroraEnabled}
                satellites={sats.data ?? []}
                focus={focus}
                onSelectPoint={handleGlobePoint}
              />
            </Suspense>
          </ChunkErrorBoundary>

          {/* Imagery + aurora toggles */}
          <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
            {imageryButtons.map((b) => (
              <button
                key={b.mode}
                type="button"
                onClick={() => setImagery(b.mode)}
                className={`border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                  imagery === b.mode
                    ? "bg-ink text-paper shadow-[2px_2px_0_0_#ffd400]"
                    : "bg-chalk hover:bg-volt/30"
                }`}
              >
                {b.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAuroraEnabled((v) => !v)}
              className={`border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                auroraEnabled
                  ? "bg-verdant text-white shadow-[2px_2px_0_0_#141414]"
                  : "bg-chalk hover:bg-verdant/20"
              }`}
            >
              Aurora {auroraEnabled ? "On" : "Off"}
            </button>
            <button
              type="button"
              onClick={() => setSatsEnabled((v) => !v)}
              className={`flex items-center gap-1 border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                satsEnabled
                  ? "bg-cobalt text-white shadow-[2px_2px_0_0_#141414]"
                  : "bg-chalk hover:bg-cobalt/20"
              }`}
              title="Live satellite positions (TLE) · needs the Vercel proxy"
            >
              <Satellite className="size-3" />
              Sats {satsEnabled ? "On" : "Off"}
            </button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-2 left-2 z-10 hidden border-2 border-ink bg-chalk p-2 sm:block">
            <div className="nb-label mb-1">Layers</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <span className="size-2 border border-ink bg-verdant" /> Population
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 border border-ink bg-cobalt" /> Aircraft
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 border border-ink bg-alert" /> Seismic
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 border border-ink bg-volt" /> ISS
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 border border-ink" style={{ background: "#46ffaa" }} /> Aurora
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 border border-ink bg-volt" style={{ opacity: 0.85 }} /> Terminator
              </span>
            </div>
          </div>

          <div className="absolute bottom-2 right-2 z-10 hidden border-2 border-ink bg-chalk px-2 py-1 font-mono text-[9px] uppercase tracking-wider md:block">
            Drag to rotate · scroll to zoom · click to probe
          </div>
        </section>

        {/* Right column: map + panels */}
        <aside className="flex w-full shrink-0 flex-col lg:w-[420px]">
          <div className="relative h-[260px] shrink-0 border-b-2 border-ink">
            <ChunkErrorBoundary label="map">
              <Suspense fallback={<PaneLoading label="map" />}>
                <MapView
                  baseLayer={baseLayer}
                  radar={radar.data}
                  radarEnabled={radarEnabled}
                  firesDate={firesDate}
                  firesEnabled={firesEnabled}
                  flights={flights.data ?? []}
                  quakes={quakes.data ?? []}
                  iss={iss.data}
                  watch={watchlist.items.map((w) => ({
                    id: w.id,
                    name: w.name,
                    lat: w.lat,
                    lng: w.lng,
                  }))}
                  focus={focus}
                  onFocus={handleFocus}
                />
              </Suspense>
            </ChunkErrorBoundary>
            <div className="absolute left-2 top-2 z-[1000] flex gap-1">
              {(["satellite", "streets"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBaseLayer(b)}
                  className={`border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                    baseLayer === b
                      ? "bg-ink text-paper shadow-[2px_2px_0_0_#1e5bff]"
                      : "bg-chalk hover:bg-cobalt/20"
                  }`}
                >
                  {b === "satellite" ? "Sat" : "Map"}
                </button>
              ))}
            </div>
            <div className="absolute right-2 top-2 z-[1000] flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setRadarEnabled((v) => !v)}
                className={`flex items-center gap-1 border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                  radarEnabled
                    ? "bg-verdant text-white shadow-[2px_2px_0_0_#141414]"
                    : "bg-chalk hover:bg-volt/30"
                }`}
              >
                <Satellite className="size-3" /> Radar {radarEnabled ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={() => setFiresEnabled((v) => !v)}
                className={`flex items-center gap-1 border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                  firesEnabled
                    ? "bg-alert text-white shadow-[2px_2px_0_0_#141414]"
                    : "bg-chalk hover:bg-alert/20"
                }`}
                title="Live wildfire heat · NASA GOES (Americas)"
              >
                <Flame className="size-3" /> Fires {firesEnabled ? "On" : "Off"}
              </button>
            </div>
          </div>

          {/* Panels */}
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex min-h-[440px] flex-col border-2 border-ink bg-chalk lg:min-h-0 lg:flex-1"
          >
            <TabsList className="h-10 gap-0 rounded-none border-0 border-b-2 border-ink bg-muted p-0 shadow-none">
              {[
                ["flights", "Flights"],
                ["events", "Events"],
                ["weather", "Weather"],
                ["tv", "TV"],
                ["cctv", "CCTV"],
                ["radio", "Radio"],
                ["news", "News"],
                ["watch", "Watch"],
              ].map(([id, label]) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="h-full flex-1 rounded-none px-1 font-mono text-[10px] uppercase tracking-wider"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="flights" className="min-h-0 flex-1">
              <ChunkErrorBoundary label="flights panel">
                <Suspense fallback={<PaneLoading label="flights" />}>
                  <FlightsPanel
                    flights={flights.data ?? []}
                    error={flights.error}
                    updatedAt={flights.updatedAt}
                    loading={flights.loading}
                    onFocus={handleFocus}
                  />
                </Suspense>
              </ChunkErrorBoundary>
            </TabsContent>

            <TabsContent value="events" className="min-h-0 flex-1">
              <ChunkErrorBoundary label="events panel">
                <Suspense fallback={<PaneLoading label="events" />}>
                  <EventsPanel
                    quakes={quakes.data ?? []}
                    iss={iss.data}
                    space={space.data ?? { kp: null, kpTime: null, dst: null, dstTime: null }}
                    onFocus={handleFocus}
                  />
                </Suspense>
              </ChunkErrorBoundary>
            </TabsContent>

            <TabsContent value="weather" className="min-h-0 flex-1">
              <ChunkErrorBoundary label="weather panel">
                <Suspense fallback={<PaneLoading label="weather" />}>
                  <WeatherPanel
                    location={weatherLoc}
                    isWatched={isWatched}
                    onFocus={handleFocus}
                    onWatchToggle={handleWatchToggle}
                    onCountryPick={handleCountryPick}
                    onUseMyLocation={handleUseMyLocation}
                  />
                </Suspense>
              </ChunkErrorBoundary>
            </TabsContent>

            <TabsContent value="tv" className="min-h-0 flex-1">
              <ChunkErrorBoundary label="tv panel">
                <Suspense fallback={<PaneLoading label="tv" />}>
                  <TvPanel onIndexed={setTvIndexed} />
                </Suspense>
              </ChunkErrorBoundary>
            </TabsContent>

            <TabsContent value="cctv" className="min-h-0 flex-1">
              <ChunkErrorBoundary label="cctv panel">
                <Suspense fallback={<PaneLoading label="cctv" />}>
                  <CctvPanel streams={cctv.data ?? []} />
                </Suspense>
              </ChunkErrorBoundary>
            </TabsContent>

            <TabsContent value="radio" className="min-h-0 flex-1">
              <ChunkErrorBoundary label="radio panel">
                <Suspense fallback={<PaneLoading label="radio" />}>
                  <RadioPanel />
                </Suspense>
              </ChunkErrorBoundary>
            </TabsContent>

            <TabsContent value="news" className="min-h-0 flex-1">
              <ChunkErrorBoundary label="news panel">
                <Suspense fallback={<PaneLoading label="news" />}>
                  <NewsPanel
                    region={newsRegion}
                    onRegionChange={setNewsRegion}
                    feed={news.data}
                    loading={news.loading}
                    error={news.error}
                    updatedAt={news.updatedAt}
                  />
                </Suspense>
              </ChunkErrorBoundary>
            </TabsContent>

            <TabsContent value="watch" className="min-h-0 flex-1">
              <ChunkErrorBoundary label="watchlist panel">
                <Suspense fallback={<PaneLoading label="watchlist" />}>
                  <WatchlistPanel onFocus={handleFocus} />
                </Suspense>
              </ChunkErrorBoundary>
            </TabsContent>
          </Tabs>
        </aside>
      </main>

      {/* ── Floating navigation ───────────────────────────── */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="border-2 border-ink bg-volt text-paper rounded-full p-2 shadow-lg hover:bg-cobalt/20 transition-colors"
          title="Top"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </button>
        <button
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
          className="border-2 border-ink bg-volt text-paper rounded-full p-2 shadow-lg hover:bg-cobalt/20 transition-colors"
          title="Bottom"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </button>
      </div>

      {/* ── Status strip ───────────────────────────────── */}
      <StatusBar
        flightCount={flights.data?.length ?? 0}
        flightUpdatedAt={flights.updatedAt}
        flightError={flights.error}
        quakeCount={quakes.data?.length ?? 0}
        iss={iss.data}
        space={space.data ?? { kp: null, kpTime: null, dst: null, dstTime: null }}
        radar={radar.data}
        aurora={aurora.data}
        auroraOk={!aurora.error && (aurora.data?.points.length ?? 0) > 0}
        imagery={imagery}
        cityCount={cityCount}
        tvCount={tvIndexed + DEMO_STREAMS.length + (cctv.data?.length ?? 0)}
        news={news.data}
      />

      {/* ── Command palette (⌘K) ──────────────────────── */}
      <ChunkErrorBoundary label="command palette">
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            onSelectTab={setTab}
            onSelectCountry={handleCountryPick}
            onNavigate={(to) => navigate(to)}
          />
        </Suspense>
      </ChunkErrorBoundary>
    </div>
  );
}
