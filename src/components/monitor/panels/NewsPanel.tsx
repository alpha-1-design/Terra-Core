import { NEWS_REGIONS } from "@/lib/monitor/api/news";
import type { NewsFeed } from "@/lib/monitor/api/news";
import { timeAgo } from "@/lib/monitor/format";
import { ExternalLink, Newspaper } from "lucide-react";

interface NewsPanelProps {
  region: string;
  onRegionChange: (id: string) => void;
  feed: NewsFeed | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
}

function SourceChip({ feed }: { feed: NewsFeed | null }) {
  if (feed?.source === "gnews") {
    return (
      <span className="nb-chip border-verdant text-verdant">
        <span className="size-1.5 bg-verdant blink-dot" style={{ border: "1px solid #141414" }} />
        KEYED // GN
      </span>
    );
  }
  if (feed?.source === "gdelt") {
    return (
      <span className="nb-chip border-amber text-amber">
        <span className="size-1.5 bg-amber" style={{ border: "1px solid #141414" }} />
        OPEN // GDELT
      </span>
    );
  }
  if (feed?.source === "rss") {
    return (
      <span className="nb-chip border-cobalt text-cobalt">
        <span className="size-1.5 bg-cobalt" style={{ border: "1px solid #141414" }} />
        PUBLIC // RSS
      </span>
    );
  }
  return (
    <span className="nb-chip border-alert text-alert">
      <span className="size-1.5 bg-alert" style={{ border: "1px solid #141414" }} />
      OFFLINE
    </span>
  );
}

export default function NewsPanel({
  region,
  onRegionChange,
  feed,
  loading,
  error,
  updatedAt,
}: NewsPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink px-3 py-2">
        <div className="flex items-center gap-2">
          <Newspaper className="size-4" />
          <span className="nb-label-ink">News // Worldwide</span>
        </div>
        <SourceChip feed={feed} />
      </div>

      {/* Region selector */}
      <div className="flex gap-1 overflow-x-auto border-b-2 border-ink bg-muted p-1.5">
        {NEWS_REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onRegionChange(r.id)}
            className={`shrink-0 border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
              region === r.id
                ? "bg-ink text-paper shadow-[2px_2px_0_0_#1e5bff]"
                : "bg-chalk hover:bg-cobalt/20"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !feed && (
          <div className="flex items-center justify-center gap-2 py-6 font-mono text-xs text-muted-foreground">
            <Newspaper className="size-4 animate-pulse" /> SYNCING HEADLINES…
          </div>
        )}

        {error && !feed && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Headline feed unreachable ({error}).
            </p>
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              Add <b>NEWS_API_KEY</b> (Vercel → Settings → Environment
              Variables) for the keyed GNews feed; without it the open GDELT
              and Google News RSS wires take over automatically.
            </p>
          </div>
        )}

        {feed && (
          <div>
            {feed.articles.map((a, i) => (
              <a
                key={`${a.url}-${i}`}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-start gap-2 border-b border-ink/15 px-3 py-2 text-left transition-colors hover:bg-volt/20"
              >
                {a.image ? (
                  <img
                    src={a.image}
                    alt=""
                    loading="lazy"
                    className="mt-0.5 h-10 w-14 shrink-0 border-2 border-ink bg-chalk object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                ) : (
                  <span className="mt-0.5 flex h-10 w-14 shrink-0 items-center justify-center border-2 border-ink bg-ink font-mono text-[9px] font-bold text-paper">
                    {i + 1}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-xs font-semibold leading-snug">
                    {a.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {a.source ? `${a.source} · ` : ""}
                    {timeAgo(a.publishedAt)}
                  </span>
                </span>
                <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground" />
              </a>
            ))}

            {feed.articles.length === 0 && (
              <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
                No headlines right now — quiet wire.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t-2 border-ink bg-muted px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {updatedAt ? `Updated ${timeAgo(updatedAt)} · ` : ""}
        {feed?.source === "gnews" ? (
          <>
            GNews API
            <a
              href="https://gnews.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-ink"
            >
              (gnews.io)
            </a>
          </>
        ) : feed?.source === "gdelt" ? (
          <>
            GDELT Project
            <a
              href="https://www.gdeltproject.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-ink"
            >
              (gdeltproject.org)
            </a>{" "}
            · open data
          </>
        ) : (
          "Google News RSS · allorigins relay"
        )}
      </div>
    </div>
  );
}
