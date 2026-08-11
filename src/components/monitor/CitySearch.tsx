import { MAJOR_CITIES, searchPlaces } from "@/lib/monitor/api/geocode";
import type { GeocodeResult } from "@/lib/monitor/types";
import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CitySearchProps {
  onPick: (name: string, lat: number, lng: number) => void;
}

export default function CitySearch({ onPick }: CitySearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      const q = query.trim();
      if (q.length < 3) {
        setResults([]);
        return;
      }
      setLoading(true);
      timer = setTimeout(async () => {
        try {
          const r = await searchPlaces(q);
          if (!cancelled) {
            setResults(r);
            setError(null);
            setOpen(true);
          }
        } catch (e) {
          if (!cancelled) {
            setResults([]);
            setError(e instanceof Error ? e.message : "Search failed");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }, 450);
    };
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [query]);

  /* Close on outside click */
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (name: string, lat: number, lng: number) => {
    onPick(name, lat, lng);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="flex items-stretch border-2 border-ink bg-chalk shadow-[3px_3px_0_0_#141414]">
        <span className="flex items-center border-r-2 border-ink px-3 text-ink">
          <Search className="size-4" />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 3 && setOpen(true)}
          placeholder="GO ANYWHERE — city, airport, landmark…"
          className="h-10 min-w-0 flex-1 bg-transparent px-3 font-mono text-xs uppercase tracking-wide outline-none placeholder:text-ink-soft/60"
        />
        {loading && (
          <span className="flex items-center px-3">
            <Loader2 className="size-4 animate-spin" />
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 border-2 border-ink bg-chalk shadow-nb">
          {results.map((r) => (
            <button
              key={`${r.lat}-${r.lng}-${r.displayName}`}
              type="button"
              onClick={() => pick(r.name, r.lat, r.lng)}
              className="flex w-full items-start gap-2 border-b-2 border-ink/10 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-volt/25"
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-signal" />
              <span className="min-w-0">
                <span className="block truncate font-sans text-sm font-semibold">
                  {r.name}
                </span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {r.displayName}
                </span>
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px]">
                {r.lat.toFixed(2)}, {r.lng.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 border-2 border-ink bg-alert px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white">
          {error}
        </div>
      )}

      {/* Quick-jump anchor cities */}
      <div className="mt-2 flex flex-wrap gap-1">
        {MAJOR_CITIES.slice(0, 14).map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => pick(c.name, c.lat, c.lng)}
            className="border-2 border-ink bg-chalk px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider transition-all hover:bg-ink hover:text-paper active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            style={{ boxShadow: "2px 2px 0 0 #141414" }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
