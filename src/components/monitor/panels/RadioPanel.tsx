import { RADIO_COUNTRIES, fetchRadioStations, type RadioStation } from "@/lib/monitor/api/radio";
import { ExternalLink, Loader2, Radio, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

function StationRow({
  s,
  active,
  onPlay,
}: {
  s: RadioStation;
  active: boolean;
  onPlay: (s: RadioStation) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(s)}
      className={`flex w-full items-center gap-2 border-b border-ink/15 px-3 py-2 text-left transition-colors ${
        active ? "bg-verdant/25" : "hover:bg-cobalt/10"
      }`}
    >
      {s.favicon ? (
        <img
          src={s.favicon}
          alt=""
          loading="lazy"
          className="h-7 w-7 shrink-0 border border-ink bg-chalk object-contain p-0.5"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink bg-ink font-mono text-[8px] font-bold text-paper">
          FM
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-sans text-xs font-semibold leading-tight">
          {s.name}
        </span>
        <span className="block truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {s.tags.split(",").filter(Boolean).slice(0, 3).join(" · ") || s.codec}{" "}
          · {s.bitrate ? `${s.bitrate} kbps` : s.codec} · ♥ {s.votes}
        </span>
      </span>
      <a
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="border-2 border-ink bg-chalk p-1 transition-colors hover:bg-signal hover:text-white"
        title="Open stream URL"
      >
        <ExternalLink className="size-3" />
      </a>
    </button>
  );
}

export default function RadioPanel() {
  const [country, setCountry] = useState("us");
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<RadioStation | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setStations([]);
      setActive(null);
      try {
        const rows = await fetchRadioStations(country);
        if (!cancelled) setStations(rows);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "radio-browser error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [country]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio className="size-4" />
          <span className="nb-label-ink">Radio // Live Stations</span>
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="border-2 border-ink bg-chalk px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider outline-none"
        >
          {RADIO_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {active && (
        <div className="border-b-2 border-ink bg-ink p-2">
          <div className="flex items-center gap-2">
            {playing ? (
              <span className="nb-chip border-verdant bg-verdant text-white">
                <Volume2 className="size-3 blink-dot" /> On air
              </span>
            ) : (
              <span className="nb-chip border-volt bg-volt text-paper">Paused</span>
            )}
            <span className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-paper">
              {active.name}
            </span>
          </div>
          <audio
            key={active.id}
            src={active.url}
            autoPlay
            controls
            className="mt-2 h-8 w-full"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setPlaying(false)}
          />
        </div>
      )}

      {error && (
        <div className="border-b-2 border-ink bg-alert px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 font-mono text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> INDEXING{" "}
            {country.toUpperCase()} STATIONS…
          </div>
        )}
        {!loading && stations.length === 0 && !error && (
          <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
            No verified stations right now — try another country.
          </div>
        )}
        {stations.map((s) => (
          <StationRow
            key={s.id}
            s={s}
            active={s.id === active?.id}
            onPlay={(st) => setActive(st)}
          />
        ))}
        {stations.length > 0 && (
          <div className="border-t-2 border-ink bg-muted px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            radio-browser.info · community directory · streams may buffer
          </div>
        )}
      </div>
    </div>
  );
}
