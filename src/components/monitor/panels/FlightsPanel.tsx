import { fmtFt, fmtKt, timeAgo } from "@/lib/monitor/format";
import type { EmergencyContact, Flight, FocusTarget, MilitaryFlight } from "@/lib/monitor/types";
import { AlertTriangle, Crosshair, Plane, Radio } from "lucide-react";

interface FlightsPanelProps {
  flights: Flight[];
  military: MilitaryFlight[];
  emergencies: EmergencyContact[];
  error: string | null;
  updatedAt: number | null;
  loading: boolean;
  onFocus: (t: FocusTarget) => void;
}

export default function FlightsPanel({
  flights,
  military,
  emergencies,
  error,
  updatedAt,
  loading,
  onFocus,
}: FlightsPanelProps) {
  const airborne = flights
    .filter((f) => !f.onGround && f.baroAltitude !== null)
    .sort((a, b) => (b.baroAltitude ?? 0) - (a.baroAltitude ?? 0))
    .slice(0, 30);

  const milTop = [...military]
    .sort((a, b) => (b.altM ?? 0) - (a.altM ?? 0))
    .slice(0, 24);

  const rateLimited = error?.includes("rate limited") ?? false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
        <div className="flex items-center gap-2">
          <Plane className="size-4" />
          <span className="nb-label-ink">ADS-B // Airspace</span>
        </div>
        <div className="flex items-center gap-2">
          {emergencies.length > 0 && (
            <span className="nb-chip border-alert bg-alert text-white">
              <AlertTriangle className="size-3 blink-dot" /> {emergencies.length} EMERG
            </span>
          )}
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

      {emergencies.length > 0 && (
        <div className="border-b-2 border-alert bg-alert/10">
          <div className="flex items-center gap-2 px-3 py-2">
            <AlertTriangle className="size-4 text-alert blink-dot" />
            <span className="nb-label-ink">Emergency // squawk</span>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {emergencies.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() =>
                  onFocus({
                    id: e.id,
                    kind: "point",
                    lat: e.lat,
                    lng: e.lng,
                    label: `${e.callsign} · ${e.reason}`,
                  })
                }
                className="flex w-full items-center gap-2 border-t border-alert/30 px-3 py-2 text-left transition-colors hover:bg-alert/15 active:bg-alert/25"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-alert font-mono text-[11px] font-bold text-white">
                  {e.squawk ?? "!!"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-sm font-bold leading-tight">
                    {e.callsign}
                  </span>
                  <span className="block truncate font-mono text-[9px] uppercase tracking-wider text-alert">
                    {e.reason}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-[11px] leading-tight">
                  <span className="block">{fmtFt(e.altM)} ft</span>
                  <span className="block text-muted-foreground">{fmtKt(e.spdMs)} kt</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {milTop.length > 0 && (
        <details className="border-b-2 border-ink">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Crosshair className="size-4" />
              <span className="nb-label-ink">Military // airspace</span>
            </span>
            <span className="nb-chip" style={{ borderColor: "#ff9d00", background: "#ff9d00", color: "#141414" }}>
              {military.length}
            </span>
          </summary>
          <div className="max-h-56 overflow-y-auto border-t-2 border-ink">
            {milTop.map((m) => (
              <button
                key={m.icao24}
                type="button"
                onClick={() =>
                  onFocus({
                    id: m.icao24,
                    kind: "point",
                    lat: m.lat,
                    lng: m.lng,
                    label: `${m.callsign} · ${m.type}`,
                  })
                }
                className="flex w-full items-center gap-2 border-b border-ink/15 px-3 py-2 text-left transition-colors hover:bg-[#ff9d00]/10 active:bg-[#ff9d00]/20"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink text-[10px] font-bold"
                  style={{ background: "#ff9d00", color: "#141414" }}
                >
                  {m.type.slice(0, 4)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-sm font-bold leading-tight">
                    {m.callsign}
                  </span>
                  <span className="block truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {m.reg || m.icao24.toUpperCase()}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-[11px] leading-tight">
                  <span className="block">{fmtFt(m.altM)} ft</span>
                  <span className="block text-muted-foreground">{fmtKt(m.spdMs)} kt</span>
                </span>
              </button>
            ))}
          </div>
        </details>
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
        Source: OpenSky Network · adsb.lol (mil) · {airborne.length} tracks of{" "}
        {flights.length}
      </div>
    </div>
  );
}
