import type { TvChannel } from "@/lib/monitor/types";
import Hls from "hls.js";
import { ExternalLink, PictureInPicture2, Radio, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const PATROL_MS = 15_000;

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
          CAM
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-sans text-xs font-semibold leading-tight">
          {ch.name}
        </span>
        <span className="block truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {ch.group ?? ch.country.toUpperCase()} · LIVE
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

function CctvPlayer({
  src,
  name,
  onFail,
  onReady,
}: {
  src: string;
  name: string;
  onFail: () => void;
  onReady: (video: HTMLVideoElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          hls?.destroy();
          onFail();
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      onFail();
    }

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
    <div className="relative border-b-2 border-ink bg-ink">
      <div className="flex items-center justify-between px-2 pb-1 pt-2">
        <span className="nb-chip border-alert bg-alert text-white">
          <Radio className="size-3 blink-dot" /> Live
        </span>
        <span className="truncate px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-paper">
          {name}
        </span>
      </div>
      <video
        ref={(el) => {
          videoRef.current = el;
          onReady(el);
        }}
        controls
        playsInline
        className="aspect-video w-full border-y-2 border-paper bg-black"
      />
    </div>
  );
}

interface CctvPanelProps {
  streams: TvChannel[];
  onIndex?: (index: number) => void;
}

export default function CctvPanel({ streams, onIndex }: CctvPanelProps) {
  const [pos, setPos] = useState(0);
  const [patrol, setPatrol] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [pipActive, setPipActive] = useState(false);

  const all = streams.length > 0 ? streams : [];
  const current = all.length > 0 ? all[Math.min(pos, all.length - 1)] : null;

  /* Patrol mode: auto-advance across every camera. */
  useEffect(() => {
    if (!patrol || all.length <= 1) return;
    const t = setInterval(() => {
      setPos((p) => (p + 1) % all.length);
    }, PATROL_MS);
    return () => clearInterval(t);
  }, [patrol, all.length]);

  /* A manual pick pauses patrol; keep the status index in sync. */
  const select = useCallback(
    (idx: number) => {
      setPatrol(false);
      setPos(idx);
      onIndex?.(idx);
    },
    [onIndex],
  );

  /* Fatal stream error → auto-advance to the next camera. */
  const handleFail = useCallback(() => {
    if (all.length <= 1) return;
    setPos((p) => (p + 1) % all.length);
  }, [all.length]);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* PiP unsupported or blocked — ignore. */
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnter = () => setPipActive(true);
    const onLeave = () => setPipActive(false);
    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [pos]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio className="size-4" />
          <span className="nb-label-ink">CCTV // Live Cameras</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPatrol((v) => !v)}
            disabled={all.length <= 1}
            className={`flex items-center gap-1 border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40 ${
              patrol ? "bg-alert text-white" : "bg-chalk hover:bg-volt/30"
            }`}
            title="Auto-advance across cameras"
          >
            <RefreshCw className={`size-3 ${patrol ? "animate-spin" : ""}`} />
            Patrol
          </button>
          <button
            type="button"
            onClick={() => void togglePip()}
            disabled={!current}
            className={`border-2 border-ink p-1.5 transition-colors disabled:opacity-40 ${
              pipActive ? "bg-cobalt text-white" : "bg-chalk hover:bg-cobalt/20"
            }`}
            title="Picture-in-picture"
          >
            <PictureInPicture2 className="size-3.5" />
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            {current ? `${pos + 1} of ${all.length}` : "No feeds"}
          </span>
        </div>
      </div>

      {current && (
        <CctvPlayer
          key={current.id}
          src={current.url}
          name={current.name}
          onFail={handleFail}
          onReady={(el) => {
            videoRef.current = el;
          }}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {all.length === 0 && (
          <div className="flex h-full items-center justify-center px-6 text-center font-mono text-xs text-muted-foreground">
            No live feeds indexed for this session.
          </div>
        )}

        <div className="border-b-2 border-ink bg-volt/25 px-3 py-1.5">
          <span className="nb-label">Verified live feeds ({all.length})</span>
        </div>
        {all.map((ch, i) => (
          <ChannelRow
            key={ch.id}
            ch={ch}
            active={ch.id === current?.id}
            onPlay={() => select(i)}
          />
        ))}

        {all.length > 0 && (
          <div className="border-t-2 border-ink bg-muted px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Geo-blocked feeds may fail — the player auto-advances
          </div>
        )}
      </div>
    </div>
  );
}
