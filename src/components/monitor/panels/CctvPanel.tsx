import type { TvChannel } from "@/lib/monitor/types";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

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

interface CctvPanelProps {
  streams: TvChannel[];
  onIndex?: (index: number) => void;
}

export default function CctvPanel({ streams, onIndex }: CctvPanelProps) {
  const [pos, setPos] = useState(0);

  const all = [...streams];

  const current = all[Math.min(pos, all.length - 1)] ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
        <div className="flex items-center gap-2">
          <ExternalLink className="size-4" />
          <span className="nb-label-ink">CCTV // Live Cameras</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {current ? `${pos + 1} of ${all.length}` : "No streams"}
        </span>
      </div>

      {current && (
        <div className="border-b-2 border-ink bg-ink p-2">
          <span className="nb-chip border-alert bg-alert text-white">
            <ExternalLink className="size-3" /> Live
          </span>
          <span className="truncate px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-paper">
            {current.name}
          </span>
        </div>
      )}

      <video
        ref={undefined}
        controls
        playsInline
        className="aspect-video w-full border-2 border-paper bg-black"
        style={{ display: current ? "block" : "none" }}
      />
      {current && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-alert">
          Stream may be geo-blocked or offline. Open externally if needed.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {streams.length === 0 && (
          <div className="flex h-full items-center justify-center px-6 text-center font-mono text-xs text-muted-foreground">
            No CCTV cameras indexed for this session.
          </div>
        )}

        <div className="border-b-2 border-ink bg-volt/25 px-3 py-1.5">
          <span className="nb-label">Public cameras ({streams.length})</span>
        </div>
        {streams.map((ch) => (
          <ChannelRow
            key={ch.id}
            ch={ch}
            active={ch.id === current?.id}
            onPlay={() => {
              // update the status bar index tracking
              onIndex?.(0);
            }}
          />
        ))}

        {streams.length > 0 && (
          <div className="border-t-2 border-ink bg-muted px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Streams may be geo-blocked or offline
          </div>
        )}
      </div>
    </div>
  );
}