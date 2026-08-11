import { fetchWeather, wmoInfo } from "@/lib/monitor/api/weather";
import { fmtNum, timeAgo } from "@/lib/monitor/format";
import type { FocusTarget } from "@/lib/monitor/types";
import { useWatchlist } from "@/lib/monitor/watchlist";
import { usePolling } from "@/lib/monitor/usePolling";
import { Bookmark, Crosshair, MapPinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

function WatchCard({
  name,
  lat,
  lng,
  onRemove,
  onFocus,
}: {
  name: string;
  lat: number;
  lng: number;
  onRemove: () => void;
  onFocus: () => void;
}) {
  const { data } = usePolling(
    () => fetchWeather(lat, lng, name),
    { enabled: true, intervalMs: 5 * 60_000 },
  );

  return (
    <div className="border-2 border-ink bg-chalk p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-sans text-xs font-bold uppercase">{name}</span>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onFocus}
            className="border-2 border-ink bg-chalk p-1 transition-colors hover:bg-cobalt/20"
            title="Locate"
          >
            <Crosshair className="size-3" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="border-2 border-ink bg-chalk p-1 transition-colors hover:bg-alert hover:text-white"
            title="Untrack"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
      <div className="mt-1 flex items-end justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-2xl leading-none">
            {data ? wmoInfo(data.current.weatherCode).glyph : "—"}
          </span>
          <div>
            <div className="font-mono text-lg font-bold leading-none">
              {data ? `${Math.round(data.current.temperature)}°C` : "—"}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {data ? wmoInfo(data.current.weatherCode).label : "offline"}
            </div>
          </div>
        </div>
        <div className="text-right font-mono text-[9px] leading-tight text-muted-foreground">
          <div>
            {data ? `${fmtNum(data.current.windSpeed)} km/h` : "—"} wind
          </div>
          <div>{data ? timeAgo(data.updatedAt) : "—"}</div>
        </div>
      </div>
      <div className="mt-1 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
        {lat.toFixed(2)}, {lng.toFixed(2)}
      </div>
    </div>
  );
}

export default function WatchlistPanel({
  onFocus,
}: {
  onFocus: (t: FocusTarget) => void;
}) {
  const { items, remove } = useWatchlist();

  const handleRemove = (id: string, name: string) => {
    remove(id);
    toast.success(`Untracked ${name}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
        <div className="flex items-center gap-2">
          <Bookmark className="size-4" />
          <span className="nb-label-ink">Watchlist</span>
        </div>
        <span className="nb-chip">{items.length} tracked</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <MapPinOff className="size-8 text-muted-foreground" />
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Nothing tracked yet. Open Weather for a place and hit the bookmark
              to monitor it around the clock.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {items.map((w) => (
            <WatchCard
              key={w.id}
              name={w.name}
              lat={w.lat}
              lng={w.lng}
              onRemove={() => handleRemove(w.id, w.name)}
              onFocus={() =>
                onFocus({
                  id: w.id,
                  kind: "watch",
                  lat: w.lat,
                  lng: w.lng,
                  label: w.name,
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="border-t-2 border-ink bg-muted px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        Stored locally in this browser · Open-Meteo live
      </div>
    </div>
  );
}
