import { fmtNum, timeAgo, timeStr } from "@/lib/monitor/format";
import type {
  FocusTarget,
  IssState,
  Quake,
  SpaceWeather,
} from "@/lib/monitor/types";
import { Activity, Globe2, Satellite, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface EventsPanelProps {
  quakes: Quake[];
  iss: IssState | null;
  space: SpaceWeather;
  onFocus: (t: FocusTarget) => void;
}

function magColor(mag: number): string {
  if (mag < 3) return "#00a651";
  if (mag < 4.5) return "#ffd400";
  if (mag < 6) return "#ff4d00";
  return "#ff2e2e";
}

function kpColor(kp: number): string {
  if (kp < 4) return "#00a651";
  if (kp < 5) return "#ffd400";
  if (kp < 7) return "#ff4d00";
  return "#ff2e2e";
}

function dstColor(dst: number): string {
  if (dst > -30) return "#00a651";
  if (dst > -70) return "#ffd400";
  return "#ff2e2e";
}

export default function EventsPanel({
  quakes,
  iss,
  space,
  onFocus,
}: EventsPanelProps) {
  const top = quakes.slice(0, 14);

  /* Relative timestamps + hourly-count update off the render path. */
  const [labels, setLabels] = useState<
    Record<string, { ago: string; abs: string }>
  >({});
  const [active, setActive] = useState(0);
  useEffect(() => {
    const update = () => {
      const m: Record<string, { ago: string; abs: string }> = {};
      for (const q of quakes) {
        m[q.id] = { ago: timeAgo(q.time), abs: timeStr(q.time).slice(0, 12) };
      }
      setLabels(m);
      setActive(quakes.filter((q) => Date.now() - q.time < 3_600_000).length);
    };
    const t0 = setTimeout(update, 0);
    const t = setInterval(update, 30_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [quakes]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="size-4" />
          <span className="nb-label-ink">Seismic // 24h</span>
        </div>
        <span className="nb-chip border-alert text-alert">
          <span className="blink-dot size-2 bg-alert" /> {quakes.length} events
        </span>
      </div>

      {/* Space weather + ISS strip */}
      <div className="grid grid-cols-3 gap-2 border-b-2 border-ink bg-muted p-2">
        <div className="border-2 border-ink bg-chalk p-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="size-3" />
            <span className="nb-label">Kp Index</span>
          </div>
          <div
            className="mt-1 font-mono text-2xl font-bold"
            style={{ color: space.kp === null ? "#6b6557" : kpColor(space.kp) }}
          >
            {space.kp === null ? "--" : space.kp.toFixed(1)}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {space.kpTime ?? "offline"}
          </div>
        </div>
        <div className="border-2 border-ink bg-chalk p-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="size-3" />
            <span className="nb-label">DST (nT)</span>
          </div>
          <div
            className="mt-1 font-mono text-2xl font-bold"
            style={{ color: space.dst === null ? "#6b6557" : dstColor(space.dst) }}
          >
            {space.dst === null ? "--" : space.dst}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            geomag storm
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            iss &&
            onFocus({
              id: "iss",
              kind: "iss",
              lat: iss.lat,
              lng: iss.lng,
              label: "ISS",
            })
          }
          className="border-2 border-ink bg-chalk p-2 text-left transition-colors hover:bg-volt/25"
        >
          <div className="flex items-center gap-1 text-muted-foreground">
            <Satellite className="size-3" />
            <span className="nb-label">ISS Live</span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold">
            {iss ? `${Math.abs(iss.lat).toFixed(1)}°${iss.lat >= 0 ? "N" : "S"}` : "--"}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {iss ? `${fmtNum(iss.altitudeKm)} km · ${fmtNum(iss.velocityKmH)} km/h` : "locating"}
          </div>
        </button>
      </div>

      {active > 0 && (
        <div className="border-b-2 border-ink bg-alert px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
          ⚠ {active} quake{active > 1 ? "s" : ""} in the last hour
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {top.length === 0 && (
          <div className="flex h-full items-center justify-center px-6 text-center font-mono text-xs text-muted-foreground">
            No seismic events in the last 24h. Quiet planet.
          </div>
        )}
        {top.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() =>
              onFocus({
                id: q.id,
                kind: "quake",
                lat: q.lat,
                lng: q.lng,
                label: q.place,
              })
            }
            className="flex w-full items-center gap-2 border-b border-ink/15 px-3 py-2 text-left transition-colors hover:bg-alert/10 active:bg-alert/20"
          >
            <span
              className="flex h-8 w-10 shrink-0 items-center justify-center border-2 border-ink font-mono text-[11px] font-bold text-white"
              style={{ background: magColor(q.mag) }}
            >
              M{q.mag.toFixed(1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-sans text-xs font-semibold leading-tight">
                {q.place}
              </span>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                depth {fmtNum(q.depth, 1)} km · {labels[q.id]?.ago ?? "—"}
              </span>
            </span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {labels[q.id]?.abs ?? ""}
            </span>
          </button>
        ))}
      </div>
      <div className="border-t-2 border-ink bg-muted px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">
          <Globe2 className="size-3" /> USGS · NOAA SWPC · WhereTheISS
        </span>
      </div>
    </div>
  );
}
