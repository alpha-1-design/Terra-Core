import CountryPicker from "@/components/monitor/CountryPicker";
import { fetchAlerts, severityColor } from "@/lib/monitor/api/alerts";
import { aqiInfo, fetchWeather, wmoInfo } from "@/lib/monitor/api/weather";
import { fmtNum, timeAgo } from "@/lib/monitor/format";
import { compassPoint, fmtDaylight, sunAltitudeAzimuth } from "@/lib/monitor/sun";
import type { Country, FocusTarget, WeatherAlert } from "@/lib/monitor/types";
import { usePolling } from "@/lib/monitor/usePolling";
import {
  AlertTriangle,
  ArrowLeftRight,
  Cloud,
  Droplets,
  Eye,
  Gauge,
  LocateFixed,
  MapPinPlus,
  Navigation,
  RefreshCw,
  Sunrise,
  Wind,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface WeatherLocation {
  name: string;
  lat: number;
  lng: number;
}

interface WeatherPanelProps {
  location: WeatherLocation | null;
  isWatched: boolean;
  onFocus: (t: FocusTarget) => void;
  onWatchToggle: (loc: WeatherLocation) => void;
  onCountryPick: (c: Country) => void;
  onUseMyLocation: () => void;
}

/** Compact live-conditions card used for the side-by-side compare mode. */
function MiniConditions({ loc }: { loc: WeatherLocation }) {
  const { data } = usePolling(
    () => fetchWeather(loc.lat, loc.lng, loc.name),
    { enabled: true, intervalMs: 10 * 60_000 },
  );
  return (
    <div className="border-2 border-ink bg-chalk p-2">
      <div className="truncate font-sans text-[11px] font-bold uppercase leading-tight">
        {loc.name}
      </div>
      {!data ? (
        <div className="py-3 text-center font-mono text-[9px] text-muted-foreground">
          SYNCING…
        </div>
      ) : (
        <>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl leading-none">
              {wmoInfo(data.current.weatherCode).glyph}
            </span>
            <span className="font-mono text-2xl font-bold leading-none">
              {Math.round(data.current.temperature)}°C
            </span>
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {wmoInfo(data.current.weatherCode).label}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[9px]">
            <span>💨 {Math.round(data.current.windSpeed)} km/h</span>
            <span>💧 {Math.round(data.current.humidity)}%</span>
            {data.aq.usAqi !== null && (
              <span className="col-span-2">
                AQI{" "}
                <span
                  className="px-1 font-bold text-white"
                  style={{ background: aqiInfo(data.aq.usAqi).color }}
                >
                  {Math.round(data.aq.usAqi)} {aqiInfo(data.aq.usAqi).label}
                </span>
              </span>
            )}
            {data.daily.tMax[0] !== undefined && (
              <span className="col-span-2">
                H {Math.round(data.daily.tMax[0])}° · L{" "}
                {Math.round(data.daily.tMin[0])}° ·☔{" "}
                {data.daily.precipProb[0]}%
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function WeatherPanel({
  location,
  isWatched,
  onFocus,
  onWatchToggle,
  onCountryPick,
  onUseMyLocation,
}: WeatherPanelProps) {
  const { data, error, loading, refresh } = usePolling(
    () =>
      location
        ? fetchWeather(location.lat, location.lng, location.name)
        : Promise.reject(new Error("no-location")),
    { enabled: !!location, intervalMs: 10 * 60_000 },
  );

  const alerts = usePolling<WeatherAlert[]>(
    () => fetchAlerts(location!.lat, location!.lng),
    { enabled: !!location, intervalMs: 5 * 60_000 },
  );

  /* Live solar readout — recomputed every 30s. */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const sun = location ? sunAltitudeAzimuth(now, location.lat, location.lng) : null;

  /* Refetch immediately when the probed location changes (poll cadence is
     otherwise too slow to keep the panel honest). */
  useEffect(() => {
    if (!location) return;
    void refresh();
    void alerts.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng]);

  /* ── Compare mode: a second live location shown side-by-side ── */
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoc, setCompareLoc] = useState<WeatherLocation | null>(null);

  if (!location) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1.5 border-b-2 border-ink px-3 py-2">
          <CountryPicker onPick={onCountryPick} />
          <button
            type="button"
            onClick={onUseMyLocation}
            className="flex items-center gap-1.5 border-2 border-ink bg-chalk px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all hover:bg-cobalt/20"
            style={{ boxShadow: "2px 2px 0 0 #141414" }}
          >
            <Navigation className="size-3" />
            My location
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Cloud className="size-8 text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Pick a country, use your location, search a city, or probe any
            point on the globe for live conditions + air quality.
          </p>
        </div>
      </div>
    );
  }

  const hourlyData = data
    ? data.hourly.time.map((t, i) => ({
        label: t.slice(11, 16),
        temp: Math.round(data.hourly.temperature[i]),
        rain: data.hourly.precipProb[i] ?? 0,
      }))
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink px-3 py-2">
        <div className="min-w-0">
          <span className="nb-label">Weather // Atmosphere</span>
          <div className="truncate font-sans text-sm font-bold uppercase leading-tight">
            {location.name}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setCompareOpen((v) => {
                if (v) setCompareLoc(null);
                return !v;
              });
            }}
            className={`border-2 border-ink p-1.5 transition-colors ${
              compareOpen ? "bg-ink text-paper" : "bg-chalk hover:bg-volt/30"
            }`}
            title="Compare with another place"
          >
            <ArrowLeftRight className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => refresh()}
            className="border-2 border-ink bg-chalk p-1.5 transition-colors hover:bg-volt/30"
            title="Refresh"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() =>
              onFocus({
                id: `w-${location.lat}-${location.lng}`,
                kind: "city",
                lat: location.lat,
                lng: location.lng,
                label: location.name,
              })
            }
            className="border-2 border-ink bg-chalk p-1.5 transition-colors hover:bg-cobalt/20"
            title="Locate on globe"
          >
            <LocateFixed className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onWatchToggle(location)}
            disabled={isWatched}
            className={`border-2 border-ink p-1.5 transition-colors disabled:opacity-40 ${
              isWatched ? "bg-verdant text-white" : "bg-chalk hover:bg-volt/30"
            }`}
            title={isWatched ? "Tracked" : "Track location"}
          >
            <MapPinPlus className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Probe source: country picker + device location */}
      <div className="flex items-center gap-1.5 border-b-2 border-ink px-3 py-1.5">
        <CountryPicker onPick={onCountryPick} />
        <button
          type="button"
          onClick={onUseMyLocation}
          className="flex items-center gap-1.5 border-2 border-ink bg-chalk px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all hover:bg-cobalt/20 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          style={{ boxShadow: "2px 2px 0 0 #141414" }}
        >
          <Navigation className="size-3" />
          My location
        </button>
      </div>

      {/* Compare strip */}
      {compareOpen && (
        <div className="border-b-2 border-ink bg-muted/40 p-2">
          <div className="flex items-center gap-2">
            <span className="nb-label">Compare</span>
            <span className="flex-1" />
            {compareLoc && (
              <button
                type="button"
                onClick={() => setCompareLoc(null)}
                className="border-2 border-ink bg-chalk px-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors hover:bg-alert hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          {!compareLoc && (
            <div className="mt-1.5">
              <CountryPicker
                onPick={(c) =>
                  setCompareLoc({
                    name: `${c.name} — ${c.capital}`,
                    lat: c.lat,
                    lng: c.lng,
                  })
                }
              />
            </div>
          )}
          {compareLoc && location && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <MiniConditions
                key={`a-${location.lat}-${location.lng}`}
                loc={location}
              />
              <MiniConditions
                key={`b-${compareLoc.lat}-${compareLoc.lng}`}
                loc={compareLoc}
              />
            </div>
          )}
        </div>
      )}

      {error && error !== "no-location" && (
        <div className="border-b-2 border-ink bg-alert px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white">
          {error}
        </div>
      )}

      {/* Active NWS alerts */}
      {alerts.data && alerts.data.length > 0 && (
        <div className="border-b-2 border-ink">
          <div className="flex items-center gap-2 bg-ink px-3 py-1.5">
            <AlertTriangle className="size-3 text-volt" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-paper">
              Active alerts · {alerts.data.length}
            </span>
          </div>
          {alerts.data.map((a) => (
            <div
              key={a.id}
              className="border-b border-ink/15 px-3 py-2 last:border-b-0"
              style={{ borderLeft: `6px solid ${severityColor(a.severity)}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-sans text-xs font-bold uppercase leading-tight">
                  {a.event}
                </span>
                <span
                  className="shrink-0 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-white"
                  style={{ background: severityColor(a.severity) }}
                >
                  {a.severity}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 font-sans text-[11px] leading-snug text-ink-soft">
                {a.headline}
              </p>
              <div className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                {new Date(a.effective).toUTCString().slice(5, 22)} →{" "}
                {new Date(a.expires).toUTCString().slice(5, 22)} UTC · {a.areaDesc}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!data && loading && (
          <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
            SYNCING OPEN-METEO…
          </div>
        )}

        {data && (
          <>
            {/* Current conditions */}
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 border-b-2 border-ink p-3">
              <div className="text-6xl font-bold leading-none">{wmoInfo(data.current.weatherCode).glyph}</div>
              <div>
                <div className="font-mono text-5xl font-bold leading-none">
                  {Math.round(data.current.temperature)}°
                  <span className="text-xl text-muted-foreground">C</span>
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {wmoInfo(data.current.weatherCode).label} · feels like{" "}
                  {Math.round(data.current.apparentTemperature)}°
                </div>
              </div>
              <div className="col-span-2 mt-2 grid grid-cols-4 gap-1.5">
                {[
                  { icon: Wind, label: "Wind", value: `${fmtNum(data.current.windSpeed)} km/h` },
                  { icon: Droplets, label: "Humidity", value: `${Math.round(data.current.humidity)}%` },
                  { icon: Gauge, label: "Pressure", value: `${Math.round(data.current.pressure)} hPa` },
                  { icon: Eye, label: "Clouds", value: `${data.current.cloudCover}%` },
                ].map((s) => (
                  <div key={s.label} className="border-2 border-ink bg-muted p-1.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <s.icon className="size-3" />
                      <span className="nb-label">{s.label}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] font-bold">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Solar readout */}
            <div className="grid grid-cols-4 gap-1.5 border-b-2 border-ink p-3">
              <div className="border-2 border-ink bg-muted p-1.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Sunrise className="size-3" />
                  <span className="nb-label">Sunrise</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] font-bold">
                  {data.daily.sunrise[0] ? data.daily.sunrise[0].slice(11, 16) : "—"}
                </div>
              </div>
              <div className="border-2 border-ink bg-muted p-1.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Sunrise className="size-3 rotate-180" />
                  <span className="nb-label">Sunset</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] font-bold">
                  {data.daily.sunset[0] ? data.daily.sunset[0].slice(11, 16) : "—"}
                </div>
              </div>
              <div className="border-2 border-ink bg-muted p-1.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="nb-label">Daylight</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] font-bold">
                  {data.daily.daylightDuration[0]
                    ? fmtDaylight(data.daily.daylightDuration[0])
                    : "—"}
                </div>
              </div>
              <div className="border-2 border-ink bg-muted p-1.5">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="nb-label">Sun now</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] font-bold">
                  {sun ? `${sun.altitude.toFixed(1)}° ${compassPoint(sun.azimuth)}` : "—"}
                </div>
              </div>
            </div>

            {/* Air quality */}
            {data.aq.usAqi !== null && (
              <div
                className="flex items-center justify-between border-b-2 border-ink px-3 py-2"
                style={{ background: aqiInfo(data.aq.usAqi).color }}
              >
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                    Air Quality · US AQI
                  </span>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-white/85">
                    PM2.5 {data.aq.pm25 ?? "--"} µg · PM10 {data.aq.pm10 ?? "--"} µg
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-3xl font-bold text-white">
                    {Math.round(data.aq.usAqi)}
                  </span>
                  <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white/90">
                    {aqiInfo(data.aq.usAqi).label}
                  </span>
                </div>
              </div>
            )}

            {/* Hourly chart */}
            <div className="border-b-2 border-ink p-3">
              <span className="nb-label">Next 24h · temp / rain%</span>
              <div className="mt-2 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 0, left: -28 }}>
                    <CartesianGrid stroke="#141414" strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fontFamily: "IBM Plex Mono" }}
                      interval={3}
                      stroke="#141414"
                    />
                    <YAxis
                      yAxisId="temp"
                      tick={{ fontSize: 9, fontFamily: "IBM Plex Mono" }}
                      stroke="#141414"
                    />
                    <YAxis yAxisId="rain" orientation="right" hide />
                    <Tooltip
                      contentStyle={{
                        border: "2px solid #141414",
                        borderRadius: 0,
                        boxShadow: "3px 3px 0 0 #141414",
                        fontFamily: "IBM Plex Mono",
                        fontSize: 11,
                      }}
                      labelStyle={{ fontWeight: 700 }}
                    />
                    <Bar
                      yAxisId="rain"
                      dataKey="rain"
                      fill="#1e5bff"
                      opacity={0.35}
                      barSize={6}
                    />
                    <Area
                      yAxisId="temp"
                      type="monotone"
                      dataKey="temp"
                      stroke="#ff4d00"
                      strokeWidth={2}
                      fill="#ffd400"
                      fillOpacity={0.5}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 7-day forecast */}
            <div className="grid grid-cols-7 gap-1 p-3">
              {data.daily.time.map((d, i) => {
                const day = new Date(d + "T12:00:00");
                return (
                  <div key={d} className="border-2 border-ink bg-chalk p-1.5 text-center">
                    <div className="font-mono text-[9px] font-bold uppercase">
                      {i === 0 ? "TODAY" : day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                    </div>
                    <div className="mt-1 text-xl leading-none">{wmoInfo(data.daily.code[i]).glyph}</div>
                    <div className="mt-1 font-mono text-[11px] font-bold">
                      {Math.round(data.daily.tMax[i])}°
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground">
                      {Math.round(data.daily.tMin[i])}°
                    </div>
                    <div className="mt-0.5 font-mono text-[8px] text-cobalt">
                      {data.daily.precipProb[i]}%☔
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="border-t-2 border-ink bg-muted px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {data ? `Updated ${timeAgo(data.updatedAt)} · ` : ""}Open-Meteo · EPA AQI
      </div>
    </div>
  );
}
