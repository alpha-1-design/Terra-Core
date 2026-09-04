import { COUNTRIES } from "@/lib/monitor/countries";
import type { Country } from "@/lib/monitor/types";
import { Command } from "cmdk";
import { BookOpen, Globe2, HelpCircle, Home, MonitorPlay } from "lucide-react";
import { useEffect, useMemo } from "react";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
}

const NAV_ACTIONS: PaletteAction[] = [
  { id: "/dashboard", label: "Open the Console", hint: "Monitoring dashboard" },
  { id: "/docs", label: "Documentation", hint: "Field manual" },
  { id: "/faq", label: "FAQ", hint: "Mission briefing" },
  { id: "/", label: "Home", hint: "Landing page" },
];

const TAB_ACTIONS: PaletteAction[] = [
  { id: "flights", label: "Flights panel", hint: "Live ADS-B aircraft" },
  { id: "events", label: "Events panel", hint: "Quakes · ISS · space weather" },
  { id: "weather", label: "Weather panel", hint: "Atmosphere + AQI" },
  { id: "tv", label: "TV panel", hint: "Broadcast channels" },
  { id: "cctv", label: "CCTV panel", hint: "Live cameras" },
  { id: "radio", label: "Radio panel", hint: "Live stations" },
  { id: "news", label: "News panel", hint: "World headlines" },
  { id: "watch", label: "Watchlist panel", hint: "Tracked places" },
];

const ROUTE_ICONS: Record<string, React.ReactNode> = {
  "/dashboard": <MonitorPlay className="size-3.5" />,
  "/docs": <BookOpen className="size-3.5" />,
  "/faq": <HelpCircle className="size-3.5" />,
  "/": <Home className="size-3.5" />,
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTab: (tabId: string) => void;
  onSelectCountry: (c: Country) => void;
  onNavigate: (to: string) => void;
}

export default function CommandPalette({
  open,
  onOpenChange,
  onSelectTab,
  onSelectCountry,
  onNavigate,
}: CommandPaletteProps) {
  // Bind ⌘K / Ctrl-K at the document level.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const countries = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-start justify-center bg-ink/60 p-4 pt-[14vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl border-2 border-ink bg-chalk shadow-[6px_6px_0_0_#141414]"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          label="Command palette"
          className="overflow-hidden"
          shouldFilter
        >
          <div className="flex items-center gap-2 border-b-2 border-ink px-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              ⌘K
            </span>
            <Command.Input
              placeholder="Search panels, countries, pages…"
              className="w-full bg-transparent px-2 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[46vh] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center font-mono text-xs text-muted-foreground">
              No match — try a country or a panel name.
            </Command.Empty>

            <Command.Group
              heading="Navigation"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {NAV_ACTIONS.map((a) => (
                <Command.Item
                  key={a.id}
                  value={`nav ${a.label}`}
                  onSelect={() => {
                    onNavigate(a.id);
                    onOpenChange(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 border border-transparent px-2 py-1.5 font-sans text-sm data-[selected=true]:border-ink data-[selected=true]:bg-volt/40"
                >
                  {ROUTE_ICONS[a.id]}
                  <span>{a.label}</span>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {a.hint}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Console panels"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {TAB_ACTIONS.map((a) => (
                <Command.Item
                  key={a.id}
                  value={`panel ${a.label}`}
                  onSelect={() => {
                    onSelectTab(a.id);
                    onOpenChange(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 border border-transparent px-2 py-1.5 font-sans text-sm data-[selected=true]:border-ink data-[selected=true]:bg-volt/40"
                >
                  <MonitorPlay className="size-3.5 text-muted-foreground" />
                  <span>{a.label}</span>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {a.hint}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="Places · 196 countries"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {countries.map((c) => (
                <Command.Item
                  key={c.code}
                  value={`place ${c.name} ${c.capital}`}
                  onSelect={() => {
                    onSelectCountry(c);
                    onOpenChange(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 border border-transparent px-2 py-1 font-sans text-xs data-[selected=true]:border-ink data-[selected=true]:bg-volt/40"
                >
                  <Globe2 className="size-3 text-muted-foreground" />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {c.capital}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
