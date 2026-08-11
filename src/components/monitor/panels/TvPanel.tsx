import {
  DEMO_STREAMS,
  fetchTvChannels,
  TV_COUNTRIES,
} from "@/lib/monitor/api/tv";
import type { TvChannel } from "@/lib/monitor/types";
import Hls from "hls.js";
import { ExternalLink, MonitorPlay, Radio, Tv } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function HlsPlayer({
  src,
  channelName,
  onFail,
}: {
  src: string;
  channelName: string;
  onFail: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setFailed(false);
    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, startLevel: -1 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setFailed(true);
          hls?.destroy();
          onFail();
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      setFailed(true);
      onFail();
    }

    // Autoplay can be blocked by browser policy before any user gesture —
    // that is not a stream failure, so never mark the source dead for it.
    const onPlay = () => {
      video.play().catch(() => {
        /* waiting for interaction; controls are available */
      });
    };
    video.addEventListener("canplay", onPlay);

    return () => {
      video.removeEventListener("canplay", onPlay);
      if (hls) hls.destroy();
    };
  }, [src, onFail]);

  return (
    <div className="border-b-2 border-ink bg-ink p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="nb-chip border-alert bg-alert text-white">
          <Radio className="size-3 blink-dot" /> Live
        </span>
        <span className="truncate px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-paper">
          {channelName}
        </span>
      </div>
      <video
        ref={videoRef}
        controls
        playsInline
        className="aspect-video w-full border-2 border-paper bg-black"
      />
      {failed && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-alert">
          Stream unreachable — source may be geo-blocked or offline. Try a demo
          feed or open externally.
        </p>
      )}
    </div>
  );
}

function ChannelRow({
  ch,
  active,
  onPlay,
}: {
  ch: TvChannel;
  active: boolean;
  onPlay: (ch: TvChannel) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(ch)}
      className={`flex w-full items-center gap-2 border-b border-ink/15 px-3 py-2 text-left transition-colors ${
        active ? "bg-volt/40" : "hover:bg-cobalt/10"
      }`}
    >
      {ch.logo ? (
        <img
          src={ch.logo}
          alt=""
          loading="lazy"
          className="h-8 w-8 shrink-0 border-2 border-ink bg-chalk object-contain p-0.5"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-ink font-mono text-[9px] font-bold text-paper">
          TV
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-sans text-xs font-semibold leading-tight">
          {ch.name}
        </span>
        <span className="block truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {ch.group ?? ch.country.toUpperCase()} · HLS
        </span>
      </span>
      <a
        href={ch.url}
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

export default function TvPanel() {
  const [country, setCountry] = useState("us");
  const [channels, setChannels] = useState<TvChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-recovery queue: country channels first, then always-on reference
  // feeds. Fatal playback errors advance to the next source automatically.
  const [pos, setPos] = useState(0);
  const missesRef = useRef(0);
  const all = useMemo<TvChannel[]>(() => [...channels, ...DEMO_STREAMS], [channels]);
  const current = all[Math.min(pos, all.length - 1)] ?? DEMO_STREAMS[0] ?? null;

  const handleFail = useCallback(() => {
    if (missesRef.current >= 10 || all.length <= 1) return;
    missesRef.current += 1;
    setPos((p) => (p + 1) % all.length);
  }, [all.length]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setChannels([]);
      setPos(0);
      missesRef.current = 0;
      try {
        const chs = await fetchTvChannels(country);
        if (!cancelled) setChannels(chs);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "IPTV error");
        }
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
          <Tv className="size-4" />
          <span className="nb-label-ink">TV // Broadcast</span>
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="border-2 border-ink bg-chalk px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider outline-none"
        >
          {TV_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {current && (
        <HlsPlayer src={current.url} channelName={current.name} onFail={handleFail} />
      )}
      {missesRef.current > 0 && (
        <div className="border-b-2 border-ink bg-volt px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-widest">
          Auto-recovery · source #{missesRef.current + 1} of {all.length}…
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div className="border-b-2 border-ink bg-alert px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white">
            {error}
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 font-mono text-xs text-muted-foreground">
            <MonitorPlay className="size-4 animate-pulse" /> INDEXING{" "}
            {country.toUpperCase()} CHANNELS…
          </div>
        )}
        {!loading && channels.length === 0 && !error && (
          <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
            No direct HLS streams indexed for this country — reference feeds
            below still play.
          </div>
        )}

        <div className="border-b-2 border-ink bg-volt/25 px-3 py-1.5">
          <span className="nb-label">Reference feeds (always on)</span>
        </div>
        {DEMO_STREAMS.map((ch) => (
          <ChannelRow
            key={ch.id}
            ch={ch}
            active={current?.id === ch.id}
            onPlay={() => {
              missesRef.current = 0;
              setPos(all.findIndex((c) => c.id === ch.id));
            }}
          />
        ))}

        <div className="border-b-2 border-ink bg-muted px-3 py-1.5">
          <span className="nb-label">
            {country.toUpperCase()} · {channels.length} playable of indexed
          </span>
        </div>
        {channels.map((ch) => (
          <ChannelRow
            key={ch.id}
            ch={ch}
            active={current?.id === ch.id}
            onPlay={() => {
              missesRef.current = 0;
              setPos(all.findIndex((c) => c.id === ch.id));
            }}
          />
        ))}
      </div>

      <div className="border-t-2 border-ink bg-muted px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        iptv-org index · streams may be geo-blocked
      </div>
    </div>
  );
}
