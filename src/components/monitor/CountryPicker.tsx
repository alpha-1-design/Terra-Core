import { COUNTRIES, countryFlag } from "@/lib/monitor/countries";
import type { Country } from "@/lib/monitor/types";
import { ChevronDown, Globe2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface CountryPickerProps {
  onPick: (c: Country) => void;
}

/** Searchable picker over all countries (embedded dataset, no network). */
export default function CountryPicker({ onPick }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.capital.toLowerCase().includes(q) ||
        c.code.toLowerCase() === q,
    );
  }, [query]);

  /* Close on outside click + Escape */
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const pick = (c: Country) => {
    onPick(c);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all ${
          open ? "bg-ink text-paper" : "bg-chalk hover:bg-volt/30"
        }`}
        style={{ boxShadow: "2px 2px 0 0 #141414" }}
      >
        <Globe2 className="size-3" />
        Country
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 border-2 border-ink bg-chalk shadow-[4px_4px_0_0_#141414]">
          <div className="flex items-center gap-2 border-b-2 border-ink bg-muted px-2 py-1.5">
            <Search className="size-3.5 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter 196 countries…"
              className="h-7 min-w-0 flex-1 bg-transparent font-mono text-[11px] uppercase tracking-wide outline-none placeholder:text-ink-soft/60"
            />
            <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
              {filtered.length}
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                No country matches
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pick(c)}
                className="flex w-full items-center gap-2 border-b border-ink/10 px-3 py-1.5 text-left transition-colors last:border-b-0 hover:bg-volt/25"
              >
                <span className="w-7 shrink-0 text-base leading-none">{countryFlag(c.code) || "🌐"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-xs font-semibold leading-tight">
                    {c.name}
                  </span>
                  <span className="block truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {c.capital}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[9px] text-ink-soft">
                  {c.lat.toFixed(1)}°, {c.lng.toFixed(1)}°
                </span>
              </button>
            ))}
          </div>
          <div className="border-t-2 border-ink bg-muted px-2 py-1 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
            Weather at capital · Open-Meteo
          </div>
        </div>
      )}
    </div>
  );
}
