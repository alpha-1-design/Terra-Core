import { fmtFt, fmtKt, timeAgo } from "@/lib/monitor/format";
import type { Flight, FocusTarget } from "@/lib/monitor/types";
import { AlertTriangle, Plane, Radio } from "lucide-react";

interface FlightsPanelProps {
  flights: Flight[];
  error: string | null;
  updatedAt: number | null;
  loading: boolean;
  onFocus: (t: FocusTarget) => void;
}

export default function FlightsPanel({
  flights,
  error,
  updatedAt,
  loading,
  onFocus,
}: FlightsPanelProps) {
  const airborne = flights
    .filter((f) => !f.onGround && f.baroAltitude !== null)
    .sort((a, b) => (b.baroAltitude ?? 0) - (a.baroAltitude ?? 0))
    .slice(0, 30);

  const rateLimited = error?.includes("rate limited") ?? false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
        <div className="flex items-center gap-2">
          <Plane className="size-4" />
          <span className="nb-label-ink">ADS-B // Airspace</span>
        </div>
        <div className="flex items-center gap-2">
          {rateLimited ? (
            <span className="nb-chip border-alert bg-alert text-white">
              <AlertTriangle className="size-3" /> Rate limited
            </span>
          ) : (
            <span className="nb-chip border-verdant text-verdant">
              <Radio className="size-3 blink-dot" /> Live
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">
            {updatedAt ? timeAgo(updatedAt) : loading ? "SYNC…" : "—"}
          </span>
        </div>
      </div>

      {rateLimited && (
        <div className="border-b-2 border-ink bg-volt/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
          OpenSky anonymous quota hit — retrying automatically. Data shown is
          the last good snapshot.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {flights.length === 0 && loading && (
          <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
            ACQUIRING AIRSPACE SNAPSHOT…
          </div>
        )}
        {flights.length === 0 && !loading && (
          <div className="flex h-full items-center justify-center px-6 text-center font-mono text-xs text-muted-foreground">
            No aircraft in snapshot. OpenSky updates every ~10s; waiting…
          </div>
        )}
        {airborne.map((f) => (
          <button
            key={f.icao24}
            type="button"
            onClick={() =>
              onFocus({
                id: f.icao24,
                kind: "flight",
                lat: f.lat,
                lng: f.lng,
                label: f.callsign,
              })
            }
            className="flex w-full items-center gap-2 border-b border-ink/15 px-3 py-2 text-left transition-colors hover:bg-cobalt/10 active:bg-cobalt/20"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-cobalt text-[10px] font-bold text-white">
              {f.callsign.slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-sans text-sm font-bold leading-tight">
                {f.callsign}
              </span>
              <span className="block truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {f.originCountry}
              </span>
            </span>
            <span className="shrink-0 text-right font-mono text-[11px] leading-tight">
              <span className="block">{fmtFt(f.baroAltitude)} ft</span>
              <span className="block text-muted-foreground">{fmtKt(f.velocity)} kt</span>
            </span>
          </button>
        ))}
      </div>
      <div className="border-t-2 border-ink bg-muted px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        Source: OpenSky Network · {airborne.length} tracks shown of{" "}
        {flights.length}
      </div>
    </div>
  );
}
