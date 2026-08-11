import Globe from "globe.gl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchCountriesGeo,
  fetchPopulatedPlaces,
  placesToCities,
  type GeoCollection,
  type GeoFeature,
} from "@/lib/monitor/api/staticData";
import type {
  AuroraState,
  City,
  Flight,
  FocusTarget,
  ImageryMode,
  IssState,
  Quake,
} from "@/lib/monitor/types";
import { subSolarPoint, terminatorCurve, type TerminatorPoint } from "@/lib/monitor/sun";

type GlobeHandle = InstanceType<typeof Globe>;

interface GlobeViewProps {
  imagery: ImageryMode;
  flights: Flight[];
  quakes: Quake[];
  iss: IssState | null;
  aurora: AuroraState | null;
  auroraEnabled: boolean;
  focus: FocusTarget | null;
  onSelectPoint: (lat: number, lng: number) => void;
}

interface FlightPoint {
  kind: "flight";
  flight: Flight;
}
interface QuakePoint {
  kind: "quake";
  quake: Quake;
}
interface AuroraPoint {
  kind: "aurora";
  aurora: { lat: number; lng: number; intensity: number };
  maxIntensity: number;
}
interface SunPoint {
  kind: "sun";
  lat: number;
  lng: number;
}
type GlobePoint = FlightPoint | QuakePoint | AuroraPoint | SunPoint;

interface HexBinShim {
  points: unknown[];
  sumWeight: number;
  center: { lat: number; lng: number };
}

interface RingDatum {
  lat: number;
  lng: number;
  km: number;
  v: number;
}

const DAY_MAX_LEVEL = 8;
const LIVE_MAX_LEVEL = 9;

function tileUrl(mode: ImageryMode): (x: number, y: number, level: number) => string {
  const today = new Date().toISOString().slice(0, 10);
  switch (mode) {
    case "live":
      return (x, y, l) =>
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${today}/GoogleMapsCompatible_Level9/${l}/${y}/${x}.jpg`;
    case "night":
      return (x, y, l) =>
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/${l}/${y}/${x}.png`;
    default:
      return (x, y, l) =>
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${l}/${y}/${x}.jpeg`;
  }
}

/* Stepped flat ramp for the population hexbins */
function hexTopColor(sumWeight: number, maxWeight: number): string {
  const t = maxWeight > 0 ? sumWeight / maxWeight : 0;
  if (t < 0.12) return "#fff3c4";
  if (t < 0.3) return "#ffd400";
  if (t < 0.55) return "#ff9d00";
  return "#ff4d00";
}
function hexSideColor(sumWeight: number, maxWeight: number): string {
  const t = maxWeight > 0 ? sumWeight / maxWeight : 0;
  if (t < 0.12) return "#e6d6a0";
  if (t < 0.3) return "#c9a800";
  if (t < 0.55) return "#c97a00";
  return "#c23d00";
}

/* Country flat caps — muted paper tones so data layers pop */
const CAP_PALETTE = ["#efece1", "#e9e4d5", "#e3ddca", "#dcd5be"];

function flightColor(v: number | null): string {
  if (v === null) return "#1e5bff";
  if (v < 180) return "#1e5bff";
  if (v < 235) return "#ffd400";
  return "#ff4d00";
}

const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });

function hashName(name: string): number {
  return name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

export default function GlobeView({
  imagery,
  flights,
  quakes,
  iss,
  aurora,
  auroraEnabled,
  focus,
  onSelectPoint,
}: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeHandle | null>(null);
  const [countries, setCountries] = useState<GeoCollection | null>(null);
  const [cities, setCities] = useState<City[]>([]);

  /* Load real Natural Earth geography once. */
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCountriesGeo(), fetchPopulatedPlaces()])
      .then(([geo, places]) => {
        if (cancelled) return;
        setCountries(geo);
        setCities(placesToCities(places));
      })
      .catch((err) => console.warn("[TERRA-CORE] geo load failed:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  /* Boot the globe once. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const g = new Globe(el, { waitForGlobeReady: true });
    globeRef.current = g;

    g.backgroundColor("#f3f0e6")
      .showGlobe(true)
      .showAtmosphere(true)
      .atmosphereColor("#141414")
      .atmosphereAltitude(0.16)
      .globeTileEngineUrl(tileUrl(imagery))
      .globeTileEngineMaxLevel(DAY_MAX_LEVEL);

    // Slow auto-rotation until the operator grabs it.
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    const pauseRotate = () => {
      controls.autoRotate = false;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        controls.autoRotate = true;
      }, 6000);
    };
    const onStart = () => pauseRotate();
    const onEnd = () => pauseRotate();
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    g.onGlobeClick((coords: { lat: number; lng: number }) => {
      pauseRotate();
      onSelectPoint(coords.lat, coords.lng);
    });

    const ro = new ResizeObserver(() => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        g.width(el.offsetWidth).height(el.offsetHeight);
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      g._destructor();
      globeRef.current = null;
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Imagery mode switch */
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.globeTileEngineUrl(tileUrl(imagery));
    g.globeTileEngineMaxLevel(imagery === "live" ? LIVE_MAX_LEVEL : DAY_MAX_LEVEL);
    g.globeTileEngineClearCache();
  }, [imagery]);

  /* Country polygons */
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !countries) return;
    g.polygonsData(countries.features)
      .polygonCapColor((f: object) => {
        const feat = f as GeoFeature;
        const i = Math.abs(hashName(feat.properties?.name ?? "")) % CAP_PALETTE.length;
        return CAP_PALETTE[i];
      })
      .polygonSideColor(() => "rgba(20,20,20,0.25)")
      .polygonStrokeColor(() => "#141414")
      .polygonAltitude(0.008)
      .polygonLabel(
        (f: object) =>
          `<div class="nb-tip"><b>${(f as GeoFeature).properties?.name ?? "Unknown"}</b></div>`,
      );
  }, [countries]);

  /* Population hexbin — the demographic layer */
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const maxWeight = cities.reduce((m, c) => Math.max(m, c.pop), 0);
    g.hexBinPointsData(cities)
      .hexBinPointLat((c: object) => (c as City).lat)
      .hexBinPointLng((c: object) => (c as City).lng)
      .hexBinPointWeight((c: object) => (c as City).pop)
      .hexBinResolution(4)
      .hexBinMerge(false)
      .hexTopColor((d: object) => hexTopColor((d as HexBinShim).sumWeight, maxWeight))
      .hexSideColor((d: object) => hexSideColor((d as HexBinShim).sumWeight, maxWeight))
      .hexAltitude((d: object) =>
        Math.max(0.0015, ((d as HexBinShim).sumWeight / maxWeight) * 0.055),
      )
      .hexLabel((d: object) => {
        const hb = d as HexBinShim;
        const top = hb.points
          .slice(0, 3)
          .map((c) => (c as City).name)
          .join(", ");
        return `<div class="nb-tip"><b>${fmt(hb.sumWeight)} people</b><br/>${top}</div>`;
      });
  }, [cities]);

  /* Flights + quakes + aurora oval + sub-solar point as one points layer */
  const points = useMemo<GlobePoint[]>(() => {
    const top = [...flights]
      .sort((a, b) => (b.baroAltitude ?? 0) - (a.baroAltitude ?? 0))
      .slice(0, 1500);
    const pts: FlightPoint[] = top.map((flight) => ({ kind: "flight", flight }));
    const qpts: QuakePoint[] = quakes.map((quake) => ({ kind: "quake", quake }));
    const auro = auroraEnabled && aurora && aurora.points.length > 0
      ? aurora.points.map<AuroraPoint>((p) => ({
          kind: "aurora",
          aurora: p,
          maxIntensity: aurora.maxIntensity,
        }))
      : [];
    const sun = subSolarPoint(new Date());
    const sunPt: SunPoint[] = [{ kind: "sun", lat: sun.lat, lng: sun.lng }];
    return [...pts, ...qpts, ...auro, ...sunPt];
  }, [flights, quakes, aurora, auroraEnabled]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointsData(points)
      .pointLat((d: object) => {
        const p = d as GlobePoint;
        if (p.kind === "flight") return p.flight.lat;
        if (p.kind === "quake") return p.quake.lat;
        if (p.kind === "aurora") return p.aurora.lat;
        return p.lat;
      })
      .pointLng((d: object) => {
        const p = d as GlobePoint;
        if (p.kind === "flight") return p.flight.lng;
        if (p.kind === "quake") return p.quake.lng;
        if (p.kind === "aurora") return p.aurora.lng;
        return p.lng;
      })
      .pointColor((d: object) => {
        const p = d as GlobePoint;
        if (p.kind === "flight") return flightColor(p.flight.velocity);
        if (p.kind === "quake") return "#ff2e2e";
        if (p.kind === "aurora") {
          const t = p.aurora.intensity / p.maxIntensity;
          return `rgba(70,255,170,${(0.25 + t * 0.6).toFixed(2)})`;
        }
        return "#ff4d00";
      })
      .pointAltitude((d: object) => {
        const p = d as GlobePoint;
        if (p.kind === "flight") {
          const alt = p.flight.baroAltitude ?? 0;
          return 0.012 + Math.min(0.055, (alt / 12000) * 0.05);
        }
        if (p.kind === "quake") return 0.012 + Math.min(0.05, p.quake.mag * 0.004);
        if (p.kind === "aurora") return 0.022;
        return 0.015;
      })
      .pointRadius((d: object) => {
        const p = d as GlobePoint;
        if (p.kind === "flight") return 0.18;
        if (p.kind === "quake") return Math.min(0.75, 0.25 + p.quake.mag * 0.06);
        if (p.kind === "aurora") {
          const t = p.aurora.intensity / p.maxIntensity;
          return 0.35 + t * 1.05;
        }
        return 0.85;
      })
      .pointLabel((d: object) => {
        const p = d as GlobePoint;
        if (p.kind === "flight") {
          const f = p.flight;
          return `<div class="nb-tip"><b>${f.callsign}</b> · ${f.originCountry}<br/>ALT ${fmt(
            (f.baroAltitude ?? 0) * 3.28084,
          )} FT · SPD ${fmt((f.velocity ?? 0) * 1.94384)} KT<br/>TRK ${fmt(
            f.trueTrack ?? 0,
          )}° · ICAO ${f.icao24.toUpperCase()}</div>`;
        }
        if (p.kind === "quake") {
          const q = p.quake;
          return `<div class="nb-tip"><b>M ${q.mag.toFixed(1)}</b> · ${q.place}<br/>DEPTH ${fmt(
            q.depth,
            1,
          )} KM · ${new Date(q.time).toISOString().replace("T", " ").slice(5, 16)}Z</div>`;
        }
        if (p.kind === "aurora") {
          return `<div class="nb-tip"><b>AURORA</b> · intensity ${Math.round(
            p.aurora.intensity,
          )} / ${Math.round(p.maxIntensity)}<br/>NOAA OVATION forecast</div>`;
        }
        return `<div class="nb-tip"><b>SUB-SOLAR POINT</b><br/>Sun directly overhead · ${fmt(
          Math.abs(p.lat),
          1,
        )}°${p.lat >= 0 ? "N" : "S"} ${fmt(Math.abs(p.lng), 1)}°${p.lng >= 0 ? "E" : "W"}</div>`;
      });
  }, [points]);

  /* City labels for megacities */
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const labels = cities.filter((c) => c.pop >= 8_000_000).slice(0, 42);
    g.labelsData(labels)
      .labelLat((c: object) => (c as City).lat)
      .labelLng((c: object) => (c as City).lng)
      .labelText((c: object) => (c as City).name)
      .labelSize((c: object) =>
        0.55 + Math.min(0.6, Math.sqrt((c as City).pop / 40_000_000)),
      )
      .labelColor(() => "#141414")
      .labelDotRadius((c: object) =>
        0.18 + Math.min(0.3, Math.sqrt((c as City).pop / 50_000_000)),
      )
      .labelDotOrientation(() => "bottom")
      .labelAltitude(0.012);
  }, [cities]);

  /* Day/night terminator — recomputed every minute, dashed animated sweep */
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const apply = () => {
      const term = terminatorCurve(new Date(), 2);
      if (!term.length) return;
      g.pathsData([term])
        .pathPoints((d: object) => d as TerminatorPoint[])
        .pathPointLat((p: object) => (p as TerminatorPoint).lat)
        .pathPointLng((p: object) => (p as TerminatorPoint).lng)
        .pathPointAlt(0.02)
        .pathColor(() => "rgba(255,212,0,0.85)")
        .pathStroke(0.3)
        .pathDashLength(0.045)
        .pathDashGap(0.028)
        .pathDashAnimateTime(6000)
        .pathTransitionDuration(0);
    };
    apply();
    const t = setInterval(apply, 60_000);
    return () => clearInterval(t);
  }, []);

  /* ISS pulsing ring */
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const ringData: RingDatum[] = iss
      ? [{ lat: iss.lat, lng: iss.lng, km: iss.altitudeKm, v: iss.velocityKmH }]
      : [];
    g.ringsData(ringData)
      .ringLat((d: object) => (d as RingDatum).lat)
      .ringLng((d: object) => (d as RingDatum).lng)
      .ringColor(() => "#ff2e2e")
      .ringMaxRadius(2.2)
      .ringPropagationSpeed(1.6)
      .ringRepeatPeriod(1300)
      .ringAltitude(0.02);
  }, [iss]);

  /* Fly-to */
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !focus) return;
    const altitude = focus.kind === "city" || focus.kind === "watch" ? 1.7 : 1.25;
    g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude }, 1100);
  }, [focus]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
