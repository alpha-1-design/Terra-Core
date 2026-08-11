import type { NewsFeed } from "@/lib/monitor/api/news";
import { fmtNum } from "@/lib/monitor/format";
import type { AuroraState, IssState, Quake, SpaceWeather } from "@/lib/monitor/types";

interface TickerProps {
  quakes: Quake[];
  iss: IssState | null;
  space: SpaceWeather;
  aurora: AuroraState | null;
  news: NewsFeed | null;
}

export default function Ticker({ quakes, iss, space, aurora, news }: TickerProps) {
  const items: string[] = [];

  for (const q of quakes.slice(0, 6)) {
    items.push(
      `SEISMIC M${q.mag.toFixed(1)} · ${q.place} (depth ${fmtNum(q.depth, 1)} km)`,
    );
  }
  if (iss) {
    items.push(
      `ISS ORBIT · ${Math.abs(iss.lat).toFixed(1)}°${iss.lat >= 0 ? "N" : "S"} ${Math.abs(
        iss.lng,
      ).toFixed(1)}°${iss.lng >= 0 ? "E" : "W"} · ALT ${fmtNum(iss.altitudeKm)} km · ${fmtNum(
        iss.velocityKmH,
      )} km/h`,
    );
  }
  if (space.kp !== null) {
    items.push(
      `SPACE WEATHER · Kp ${space.kp.toFixed(1)} · DST ${space.dst ?? "--"} nT`,
    );
  }
  if (aurora && aurora.points.length > 0) {
    items.push(
      `AURORA OVAL · max intensity ${Math.round(aurora.maxIntensity)} · NOAA OVATION · ${aurora.points.length} cells rendered`,
    );
  }
  if (news && news.articles.length > 0) {
    const h = news.articles[0];
    items.push(
      `WORLD NEWS · ${h.source ? `${h.source.toUpperCase()} · ` : ""}${h.title.slice(0, 110)}`,
    );
  }
  if (items.length === 0) {
    items.push("ALL STREAMS NOMINAL · AWAITING EVENTS");
  }

  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center">
      {items.map((it, i) => (
        <span key={i} className="flex items-center">
          <span className="px-4 font-mono text-[11px] font-semibold uppercase tracking-wider">
            {it}
          </span>
          <span className="text-signal">◆</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="flex h-8 items-center overflow-hidden border-t-2 border-ink bg-ink text-paper">
      <div className="flex h-full shrink-0 items-center border-r-2 border-ink bg-signal px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
        Live Feed
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="ticker-track">
          {row("a")}
          {row("b")}
        </div>
      </div>
    </div>
  );
}
