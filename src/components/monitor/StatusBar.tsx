import type { NewsFeed } from "@/lib/monitor/api/news";
import { fmtNum, timeAgo, utcClock } from "@/lib/monitor/format";
import type {
  AuroraState,
  ImageryMode,
  IssState,
  RadarData,
  SpaceWeather,
} from "@/lib/monitor/types";
import { useEffect, useState } from "react";

interface StatusBarProps {
  flightCount: number;
  flightUpdatedAt: number | null;
  flightError: string | null;
  quakeCount: number;
  iss: IssState | null;
  space: SpaceWeather;
  radar: RadarData | null;
  aurora: AuroraState | null;
  auroraOk: boolean;
  imagery: ImageryMode;
  cityCount: number;
  tvCount: number;
  news: NewsFeed | null;
}

const IMAGERY_LABEL: Record<ImageryMode, string> = {
  day: "BlueMarble",
  live: "MODIS live",
  night: "BlackMarble",
};

export default function StatusBar({
  flightCount,
  flightUpdatedAt,
  flightError,
  quakeCount,
  iss,
  space,
  radar,
  aurora,
  auroraOk,
  imagery,
  cityCount,
  tvCount,
  news,
}: StatusBarProps) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const streams: { label: string; value: string; ok: boolean }[] = [
    { label: "ADS-B", value: `${fmtNum(flightCount)} acft`, ok: !flightError },
    { label: "Seismic", value: `${quakeCount} / 24h`, ok: true },
    {
      label: "ISS",
      value: iss ? `${Math.abs(iss.lat).toFixed(1)}°` : "—",
      ok: !!iss,
    },
    { label: "Kp", value: space.kp === null ? "—" : space.kp.toFixed(1), ok: space.kp !== null },
    {
      label: "Radar",
      value: radar && radar.frames.length ? `${radar.frames.length} frm` : "—",
      ok: !!radar && radar.frames.length > 0,
    },
    {
      label: "Aurora",
      value: aurora ? `ovl ${Math.round(aurora.maxIntensity)}` : "—",
      ok: auroraOk,
    },
    { label: "Imagery", value: IMAGERY_LABEL[imagery], ok: true },
    { label: "Cities", value: fmtNum(cityCount), ok: cityCount > 0 },
    { label: "TV", value: `${tvCount} ch`, ok: true },
    {
      label: "News",
      value: news ? `${news.articles.length} hd${news.source === "gnews" ? "·K" : ""}` : "—",
      ok: !!(news && news.articles.length > 0),
    },
  ];

  return (
    <div className="flex h-9 items-stretch border-t-2 border-ink bg-chalk">
      <div className="flex items-center gap-1.5 overflow-x-auto px-2">
        {streams.map((s) => (
          <div key={s.label} className="flex shrink-0 items-center gap-1.5 border-2 border-ink bg-paper px-2 py-1">
            <span
              className={`size-2 ${s.ok ? "bg-verdant" : "bg-alert"} ${s.ok ? "blink-dot" : ""}`}
              style={{ border: "1px solid #141414" }}
            />
            <span className="nb-label-ink">{s.label}</span>
            <span className="font-mono text-[10px] font-bold">{s.value}</span>
          </div>
        ))}
        {flightUpdatedAt && (
          <span className="nb-label hidden lg:block">
            ADS-B sync {timeAgo(flightUpdatedAt)}
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 border-l-2 border-ink px-3">
        <span className="nb-label">UTC</span>
        <span className="font-mono text-sm font-bold tabular-nums">{utcClock(now)}</span>
        <span className="hidden font-mono text-[10px] text-muted-foreground md:block">
          {now.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
