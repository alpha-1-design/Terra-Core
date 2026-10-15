import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { lazyWithRetry } from "@/lib/monitor/lazyWithRetry";
import { fetchFlights } from "@/lib/monitor/api/flights";
import { fetchIss, fetchQuakes } from "@/lib/monitor/api/events";
import { fetchAurora } from "@/lib/monitor/api/aurora";
import { fetchDisasters } from "@/lib/monitor/api/disasters";
import { collectEmergencies } from "@/lib/monitor/emergency";
import { fmtNum } from "@/lib/monitor/format";
import type { AuroraState, Disaster, Flight, IssState, Quake } from "@/lib/monitor/types";

/**
 * Full-bleed interactive globe for the landing hero — the same real
 * `GlobeView` the console uses, fed a curated slice of the live feeds so the
 * marketing page is genuine rather than a screenshot.
 *
 * Two deliberate constraints keep this from hurting first load:
 *   1. The ~530KB (gzipped) globe.gl/three chunk is only imported once the
 *      band scrolls into view, so phones don't download it speculatively.
 *   2. Every feed is independently best-effort — a slow or blocked source
 *      degrades to "fewer dots", never to a broken page.
 */

const GlobeView = lazyWithRetry(() => import("@/components/monitor/GlobeView"), "globe");

const POLL_MS = 45_000;

export default function HeroGlobe() {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(() => typeof IntersectionObserver === "undefined");
  const [flights, setFlights] = useState<Flight[]>([]);
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [iss, setIss] = useState<IssState | null>(null);
  const [aurora, setAurora] = useState<AuroraState | null>(null);
  const [disasters, setDisasters] = useState<Disaster[]>([]);

  /* Defer the globe chunk until the hero is in view. */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || live) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLive(true);
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [live]);

  useEffect(() => {
    if (!live) return;
    let on = true;
    const grab = <T,>(p: Promise<T>, set: (v: T) => void) => {
      p.then((v) => {
        if (on) set(v);
      }).catch(() => {
        /* feed unavailable — keep whatever we have */
      });
    };
    const load = () => {
      grab(fetchFlights(), setFlights);
      grab(fetchQuakes(), setQuakes);
      grab(fetchIss(), setIss);
      grab(fetchAurora(), setAurora);
      grab(fetchDisasters(), setDisasters);
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [live]);

  /* Emergency squawks are derived from the flight feed — no extra request. */
  const emergencies = useMemo(() => collectEmergencies(flights, []), [flights]);

  return (
    <section
      ref={wrapRef}
      className="relative h-[46vh] min-h-[340px] w-full overflow-hidden border-b-2 border-ink bg-paper sm:h-[58vh]"
    >
      {/* Poster globe — a plain blue-marble sphere shown until the real one
          boots, so the band is never an empty box. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="aspect-square h-[94%] max-h-full rounded-full bg-cover bg-center opacity-95"
          style={{
            backgroundImage: "url(https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg)",
            boxShadow: "10px 12px 0 0 rgba(20,20,20,0.12)",
          }}
        />
      </div>

      {live && (
        <Suspense fallback={null}>
          <GlobeView
            imagery="day"
            flights={flights}
            quakes={quakes}
            iss={iss}
            aurora={aurora}
            auroraEnabled
            satellites={[]}
            launches={[]}
            military={[]}
            emergencies={emergencies}
            disasters={disasters}
            focus={null}
            onSelectPoint={() => navigate("/dashboard")}
          />
        </Suspense>
      )}

      <div className="pointer-events-none absolute left-3 top-3 lg:left-6 lg:top-6">
        <span className="nb-chip-solid">
          <span className="blink-dot size-2 bg-alert" /> LIVE EARTH · REAL DATA
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-3 lg:p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="nb-chip">
            {flights.length ? `${fmtNum(flights.length)} aircraft` : "aircraft · syncing"}
          </span>
          <span className="nb-chip">
            {quakes.length ? `${quakes.length} quakes / 24h` : "seismic · syncing"}
          </span>
          <span className="nb-chip">
            {disasters.length ? `${disasters.length} global alerts` : "alerts · syncing"}
          </span>
          {emergencies.length > 0 && (
            <span className="nb-chip border-alert bg-alert font-bold text-white">
              ⚠ {emergencies.length} emergency
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="pointer-events-auto inline-flex items-center gap-2 border-2 border-ink bg-volt px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest shadow-[3px_3px_0_0_#141414] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          Drag to explore · Open console
        </button>
      </div>
    </section>
  );
}
