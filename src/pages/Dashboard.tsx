import CitySearch from "@/components/monitor/CitySearch";
import GlobeView from "@/components/monitor/GlobeView";
import MapView from "@/components/monitor/MapView";
import StatusBar from "@/components/monitor/StatusBar";
import Ticker from "@/components/monitor/Ticker";
import EventsPanel from "@/components/monitor/panels/EventsPanel";
import FlightsPanel from "@/components/monitor/panels/FlightsPanel";
import NewsPanel from "@/components/monitor/panels/NewsPanel";
import TvPanel from "@/components/monitor/panels/TvPanel";
import WatchlistPanel from "@/components/monitor/panels/WatchlistPanel";
import CctvPanel from "@/components/monitor/panels/CctvPanel";
import WeatherPanel, {
  type WeatherLocation,
} from "@/components/monitor/panels/WeatherPanel";
import { fetchAurora, AURORA_POLL_MS } from "@/lib/monitor/api/aurora";
import { fetchCctvStreams, CCTV_POLL_MS } from "@/lib/monitor/api/cctv";
import { fetchFlights, FLIGHT_POLL_MS } from "@/lib/monitor/api/flights";
import { reverseGeocode } from "@/lib/monitor/api/geocode";
import {
  fetchIss,
  fetchQuakes,
  fetchSpaceWeather,
} from "@/lib/monitor/api/events";
import { fetchNewsFeed, NEWS_POLL_MS } from "@/lib/monitor/api/news";
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
import { HardDrive, Radio } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const watchlist = useWatchlist();

  /* ── Live data streams ─────────────────────────────── */
  const flights = usePolling(fetchFlights, { intervalMs: FLIGHT_POLL_MS });
  const cctv = usePolling(fetchCctvStreams, { intervalMs: CCTV_POLL_MS });
  const quakes = usePolling(fetchQuakes, { intervalMs: 60_000 });
  const iss = usePolling(fetchIss, { intervalMs: 10_000 });
  const space = usePolling(fetchSpaceWeather, { intervalMs: 5 * 60_000 });
  const radar = usePolling(fetchRadarFrames, { intervalMs: 5 * 60_000 });
  const aurora = usePolling(fetchAurora, { intervalMs: AURORA_POLL_MS });

  const [newsRegion, setNewsRegion] = useState("world");
  const newsFetcher = useCallback(() => fetchNewsFeed(newsRegion), [newsRegion]);
  const news = usePolling(newsFetcher, { intervalMs: NEWS_POLL_MS });
  // Refetch immediately when the operator switches news region.
  const prevNewsRegion = useRef(newsRegion);
  useEffect(() => {
    if (prevNewsRegion.current !== newsRegion) {
      prevNewsRegion.current = newsRegion;
      void news.refresh();
    }
  }, [newsRegion, news.refresh]);

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
  const [auroraEnabled, setAuroraEnabled] = useState(true);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [tab, setTab] = useState("flights");
  const [tvIndexed, setTvIndexed] = useState(0);
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
          <span className="nb-chip border-verdant text-verdant">
            <Radio className="size-3 blink-dot" /> Live
          </span>
          <span className="nb-chip border-cobalt text-cobalt">
            <HardDrive className="size-3" />
            Local mode · no sign-in
          </span>
        </div>
      </header>

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
          <GlobeView
            imagery={imagery}
            flights={flights.data ?? []}
            quakes={quakes.data ?? []}
            iss={iss.data}
            aurora={aurora.data}
            auroraEnabled={auroraEnabled}
            focus={focus}
            onSelectPoint={handleGlobePoint}
          />

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
            <MapView
              baseLayer={baseLayer}
              radar={radar.data}
              radarEnabled={radarEnabled}
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
            <button
              type="button"
              onClick={() => setRadarEnabled((v) => !v)}
              className={`absolute right-2 top-2 z-[1000] border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
                radarEnabled
                  ? "bg-verdant text-white shadow-[2px_2px_0_0_#141414]"
                  : "bg-chalk hover:bg-volt/30"
              }`}
            >
              Radar {radarEnabled ? "On" : "Off"}
            </button>
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
              <FlightsPanel
                flights={flights.data ?? []}
                error={flights.error}
                updatedAt={flights.updatedAt}
                loading={flights.loading}
                onFocus={handleFocus}
              />
            </TabsContent>

            <TabsContent value="events" className="min-h-0 flex-1">
              <EventsPanel
                quakes={quakes.data ?? []}
                iss={iss.data}
                space={space.data ?? { kp: null, kpTime: null, dst: null, dstTime: null }}
                onFocus={handleFocus}
              />
            </TabsContent>

            <TabsContent value="weather" className="min-h-0 flex-1">
              <WeatherPanel
                location={weatherLoc}
                isWatched={isWatched}
                onFocus={handleFocus}
                onWatchToggle={handleWatchToggle}
                onCountryPick={handleCountryPick}
                onUseMyLocation={handleUseMyLocation}
              />
            </TabsContent>

            <TabsContent value="tv" className="min-h-0 flex-1">
              <TvPanel onIndexed={setTvIndexed} />
            </TabsContent>

            <TabsContent value="cctv" className="min-h-0 flex-1">
              <CctvPanel streams={cctv.data ?? []} />
            </TabsContent>

            <TabsContent value="news" className="min-h-0 flex-1">
              <NewsPanel
                region={newsRegion}
                onRegionChange={setNewsRegion}
                feed={news.data}
                loading={news.loading}
                error={news.error}
                updatedAt={news.updatedAt}
              />
            </TabsContent>

            <TabsContent value="watch" className="min-h-0 flex-1">
              <WatchlistPanel onFocus={handleFocus} />
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
    </div>
  );
}
