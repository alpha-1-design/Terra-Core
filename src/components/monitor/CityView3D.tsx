import type { Flight, FocusTarget, Quake } from "@/lib/monitor/types";
import type { FeatureCollection } from "geojson";
import { Loader2 } from "lucide-react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * City 3D — a tilted, token-free 3D map.
 *
 * Extruded buildings come from OpenFreeMap's vector tiles (OpenStreetMap data,
 * no API key), real relief from the public AWS Terrain Tiles (Terrarium
 * encoding), optional Esri satellite imagery draped over that terrain, and the
 * same live quake + aircraft feeds the rest of the console uses.
 *
 * It is lazy-loaded (MapLibre is ~250KB gzipped) and fully independent of the
 * default globe.gl path and of the optional Cesium "Photoreal 3D" mode, so a
 * blocked tile host or missing WebGL only ever degrades this one pane.
 */

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEM_TILES = [
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
];
const SAT_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

/** Dense skyline that reads well in 3D when nothing has been searched yet. */
const DEFAULT_VIEW = { lng: -74.006, lat: 40.7128 };
const TILT = 62;

const SRC = {
  dem: "t3d-dem",
  sat: "t3d-sat",
  quakes: "t3d-quakes",
  flights: "t3d-flights",
} as const;
const LYR = {
  sat: "t3d-sat",
  hillshade: "t3d-hillshade",
  buildings: "t3d-buildings",
  quakes: "t3d-quakes-circle",
  flights: "t3d-flights-circle",
} as const;

type Visibility = "visible" | "none";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

function reduceMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** How close to fly for each kind of focus target. */
function cameraFor(kind: FocusTarget["kind"]): { zoom: number; pitch: number } {
  switch (kind) {
    case "iss":
      return { zoom: 3.2, pitch: 0 };
    case "quake":
      return { zoom: 9.5, pitch: 50 };
    case "flight":
      return { zoom: 10.5, pitch: 50 };
    case "point":
      return { zoom: 14.6, pitch: TILT };
    default:
      return { zoom: 15.4, pitch: TILT }; // city, watch
  }
}

function flightsToFC(flights: Flight[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: flights
      .filter((f) => !f.onGround && Number.isFinite(f.lat) && Number.isFinite(f.lng))
      .map((f) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [f.lng, f.lat] },
        properties: {
          icao24: f.icao24,
          callsign: f.callsign?.trim() ?? "",
          country: f.originCountry,
          altM: f.baroAltitude ?? f.geoAltitude ?? -1,
          spdMs: f.velocity ?? -1,
        },
      })),
  };
}

function quakesToFC(quakes: Quake[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: quakes
      .filter((q) => Number.isFinite(q.lat) && Number.isFinite(q.lng))
      .map((q) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [q.lng, q.lat] },
        properties: { mag: q.mag, place: q.place, depth: q.depth, time: q.time },
      })),
  };
}

/** Popup content is built from DOM nodes + textContent, never HTML strings:
 *  callsigns and place names come from third-party feeds. */
function popupNode(title: string, lines: string[]): HTMLElement {
  const root = document.createElement("div");
  root.className = "font-mono text-[11px] leading-snug text-ink";
  const h = document.createElement("div");
  h.className = "font-bold uppercase tracking-wide";
  h.textContent = title;
  root.appendChild(h);
  for (const line of lines) {
    const p = document.createElement("div");
    p.className = "text-ink-soft";
    p.textContent = line;
    root.appendChild(p);
  }
  return root;
}

/** A 16px anchor (so the pin sits exactly on the coordinate) holding a rotated
 *  diamond and an un-rotated label hanging below it. */
function markerElement(label: string): HTMLElement {
  const anchor = document.createElement("div");
  anchor.className = "pointer-events-none relative size-4";
  const pin = document.createElement("div");
  pin.className =
    "absolute inset-0 rotate-45 border-2 border-ink bg-volt shadow-[2px_2px_0_0_#141414]";
  const tag = document.createElement("div");
  tag.className =
    "absolute left-1/2 top-full mt-2 max-w-[180px] -translate-x-1/2 truncate whitespace-nowrap border-2 border-ink bg-chalk px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide";
  tag.textContent = label;
  anchor.append(pin, tag);
  return anchor;
}

/**
 * Adds terrain, sky, relief shading, satellite imagery, 3D buildings and the
 * live-data layers on top of whatever style loaded. Written against the style's
 * layer *types* rather than its layer ids so swapping STYLE_URL stays cheap.
 * Returns the original visibility of every 2D fill layer so satellite mode can
 * hide and restore them.
 */
function setup3D(map: MapLibreMap): Map<string, Visibility> {
  const style = map.getStyle();
  const layers = style.layers ?? [];
  const firstNonBackground = layers.find((l) => l.type !== "background")?.id;
  const firstLine = layers.find((l) => l.type === "line")?.id;
  const firstSymbol = layers.find((l) => l.type === "symbol")?.id;

  // Relief
  map.addSource(SRC.dem, {
    type: "raster-dem",
    tiles: DEM_TILES,
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 15,
    attribution: "Terrain: Mapzen / AWS Terrain Tiles",
  });
  map.setTerrain({ source: SRC.dem, exaggeration: 1.25 });
  map.addLayer(
    {
      id: LYR.hillshade,
      type: "hillshade",
      source: SRC.dem,
      paint: {
        "hillshade-exaggeration": 0.35,
        "hillshade-shadow-color": "#3a362c",
        "hillshade-highlight-color": "#ffffff",
        "hillshade-accent-color": "#3a362c",
      },
    },
    firstLine ?? firstSymbol,
  );

  try {
    map.setSky({
      "sky-color": "#8cbcff",
      "horizon-color": "#fff3d1",
      "fog-color": "#fff3d1",
      "sky-horizon-blend": 0.5,
      "horizon-fog-blend": 0.5,
      "fog-ground-blend": 0.4,
    });
  } catch {
    /* sky is cosmetic — older style specs simply skip it */
  }

  // Satellite imagery, sitting just above the background and hidden by default.
  map.addSource(SRC.sat, {
    type: "raster",
    tiles: SAT_TILES,
    tileSize: 256,
    maxzoom: 19,
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
  });
  map.addLayer(
    {
      id: LYR.sat,
      type: "raster",
      source: SRC.sat,
      layout: { visibility: "none" },
    },
    firstNonBackground,
  );

  // 3D buildings: use the style's own extrusions; add ours only if it has none.
  const hasExtrusion = layers.some((l) => l.type === "fill-extrusion");
  if (!hasExtrusion) {
    const vectorSource = Object.entries(style.sources).find(
      ([, s]) => s.type === "vector",
    )?.[0];
    if (vectorSource) {
      map.addLayer(
        {
          id: LYR.buildings,
          type: "fill-extrusion",
          source: vectorSource,
          "source-layer": "building",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": "#d9d3c1",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.9,
          },
        },
        firstSymbol,
      );
    }
  }

  // Live data, drawn flat on the terrain.
  map.addSource(SRC.quakes, { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: LYR.quakes,
    type: "circle",
    source: SRC.quakes,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "mag"], 1, 4, 5, 11, 8, 26],
      "circle-color": "#ff2e2e",
      "circle-opacity": 0.55,
      "circle-stroke-color": "#141414",
      "circle-stroke-width": 1.5,
      "circle-pitch-alignment": "map",
    },
  });
  map.addSource(SRC.flights, { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: LYR.flights,
    type: "circle",
    source: SRC.flights,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.8, 10, 3.5, 15, 6],
      "circle-color": "#1e5bff",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1,
    },
  });

  const fills = new Map<string, Visibility>();
  for (const l of map.getStyle().layers ?? []) {
    if (l.type === "fill") {
      fills.set(l.id, (l.layout?.visibility as Visibility | undefined) ?? "visible");
    }
  }
  return fills;
}

interface CityView3DProps {
  focus: FocusTarget | null;
  flights: Flight[];
  quakes: Quake[];
  /** Click on bare ground → probe that spot (same contract as the globe). */
  onSelectPoint?: (lat: number, lng: number) => void;
}

const ctl = (on: boolean) =>
  `border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
    on ? "bg-ink text-paper shadow-[2px_2px_0_0_#ffd400]" : "bg-chalk hover:bg-volt/30"
  }`;

export default function CityView3D({
  focus,
  flights,
  quakes,
  onSelectPoint,
}: CityView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLSpanElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const readyRef = useRef(false);
  const baseFillsRef = useRef<Map<string, Visibility>>(new Map());
  const focusRef = useRef(focus);
  const onSelectRef = useRef(onSelectPoint);
  /** The spot the user just clicked — focusing it must not yank the camera. */
  const selfPickRef = useRef<{ lat: number; lng: number } | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [satellite, setSatellite] = useState(false);
  const [tilted, setTilted] = useState(true);
  const [orbit, setOrbit] = useState(false);

  // Keep the latest props reachable from long-lived map callbacks.
  useEffect(() => {
    focusRef.current = focus;
    onSelectRef.current = onSelectPoint;
  });

  const placeMarker = useCallback((map: MapLibreMap, f: FocusTarget) => {
    markerRef.current?.remove();
    markerRef.current = new Marker({ element: markerElement(f.label) })
      .setLngLat([f.lng, f.lat])
      .addTo(map);
  }, []);

  // ── Create / destroy the map ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    readyRef.current = false;

    const start = focusRef.current;
    const cam = start ? cameraFor(start.kind) : { zoom: 15.2, pitch: TILT };
    const compact = window.matchMedia("(max-width: 1023px)").matches;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: el,
        style: STYLE_URL,
        center: [start?.lng ?? DEFAULT_VIEW.lng, start?.lat ?? DEFAULT_VIEW.lat],
        zoom: cam.zoom,
        pitch: cam.pitch,
        bearing: -18,
        maxPitch: 80,
        minZoom: 1.5,
        maxZoom: 19,
        attributionControl: { compact: true },
        // Terrain + hillshade + extrusions are fill-rate heavy; multisampling
        // is the first thing to drop on small, weaker GPUs.
        canvasContextAttributes: { antialias: !compact },
        // On phones this pane sits in a scrolling page: require two fingers so
        // a one-finger swipe still scrolls the page instead of trapping it.
        cooperativeGestures: compact,
      });
    } catch (err) {
      console.warn("[TERRA-CORE] 3D view could not start (WebGL?):", err);
      // Deferred: setting state synchronously inside an effect cascades renders.
      const t = window.setTimeout(() => setStatus("error"), 0);
      return () => window.clearTimeout(t);
    }
    mapRef.current = map;

    const fail = () => {
      if (!readyRef.current) setStatus("error");
    };
    const hardTimer = window.setTimeout(fail, 25_000);
    let errTimer: number | undefined;
    let warned = 0;
    map.on("error", (e) => {
      if (warned++ < 3) console.warn("[TERRA-CORE] 3D map:", e.error?.message ?? e);
      // An error before "load" usually means the style itself is unreachable.
      if (!readyRef.current && errTimer === undefined) {
        errTimer = window.setTimeout(fail, 5_000);
      }
    });

    map.on("load", () => {
      window.clearTimeout(hardTimer);
      if (errTimer !== undefined) window.clearTimeout(errTimer);
      try {
        baseFillsRef.current = setup3D(map);
      } catch (err) {
        console.warn("[TERRA-CORE] 3D layers partially unavailable:", err);
      }
      readyRef.current = true;
      setTilted(map.getPitch() > 10);
      setStatus("ready");
    });

    map.on("rotate", () => {
      if (compassRef.current) {
        compassRef.current.style.transform = `rotate(${-map.getBearing()}deg)`;
      }
    });
    map.on("pitchend", () => setTilted(map.getPitch() > 10));

    // Pointer affordance + popups on the live layers.
    const live = [LYR.flights, LYR.quakes];
    for (const id of live) {
      map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("click", (e) => {
      const hit = map.queryRenderedFeatures(e.point, {
        layers: live.filter((id) => map.getLayer(id)),
      })[0];
      if (hit && hit.geometry.type === "Point") {
        const [lng, lat] = hit.geometry.coordinates as [number, number];
        const p = hit.properties ?? {};
        const node =
          hit.layer.id === LYR.quakes
            ? popupNode(`M${Number(p.mag).toFixed(1)} · ${String(p.place ?? "Earthquake")}`, [
                `Depth ${Math.round(Number(p.depth))} km`,
                new Date(Number(p.time)).toUTCString(),
              ])
            : popupNode(String(p.callsign || p.icao24 || "Aircraft"), [
                Number(p.altM) >= 0
                  ? `Altitude ${Math.round(Number(p.altM) * 3.28084).toLocaleString()} ft`
                  : "Altitude unknown",
                Number(p.spdMs) >= 0
                  ? `Speed ${Math.round(Number(p.spdMs) * 1.94384)} kt`
                  : "Speed unknown",
                String(p.country ?? ""),
              ].filter(Boolean));
        new Popup({ offset: 10, maxWidth: "260px" })
          .setLngLat([lng, lat])
          .setDOMContent(node)
          .addTo(map);
        return;
      }
      selfPickRef.current = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      onSelectRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });

    return () => {
      window.clearTimeout(hardTimer);
      if (errTimer !== undefined) window.clearTimeout(errTimer);
      markerRef.current?.remove();
      markerRef.current = null;
      readyRef.current = false;
      mapRef.current = null;
      map.remove();
    };
  }, [attempt]);

  // ── Fly to the focused place and drop the marker ────────────────────
  const focusKey = focus ? `${focus.id}|${focus.lat}|${focus.lng}|${focus.kind}` : "";
  useEffect(() => {
    const map = mapRef.current;
    const f = focusRef.current;
    if (!map || status !== "ready" || !f) return;
    placeMarker(map, f);

    const self = selfPickRef.current;
    selfPickRef.current = null;
    if (
      f.kind === "point" &&
      self &&
      Math.abs(self.lat - f.lat) < 1e-4 &&
      Math.abs(self.lng - f.lng) < 1e-4
    ) {
      return; // came from a click on this map — stay where the user is looking
    }
    const cam = cameraFor(f.kind);
    map.flyTo({
      center: [f.lng, f.lat],
      zoom: cam.zoom,
      pitch: cam.pitch,
      bearing: f.kind === "iss" ? 0 : map.getBearing(),
      duration: reduceMotion() ? 0 : 3200,
      essential: true,
    });
  }, [focusKey, status, placeMarker]);

  // ── Live data ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    (map.getSource(SRC.flights) as GeoJSONSource | undefined)?.setData(flightsToFC(flights));
  }, [flights, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    (map.getSource(SRC.quakes) as GeoJSONSource | undefined)?.setData(quakesToFC(quakes));
  }, [quakes, status]);

  // ── Satellite ↔ streets ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !map.getLayer(LYR.sat)) return;
    map.setLayoutProperty(LYR.sat, "visibility", satellite ? "visible" : "none");
    for (const [id, original] of baseFillsRef.current) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", satellite ? "none" : original);
      }
    }
  }, [satellite, status]);

  // ── Slow orbit ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!orbit || !map || status !== "ready") return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      map.setBearing(map.getBearing() + (now - last) * 0.008); // ≈ 8°/s
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = () => setOrbit(false);
    map.once("dragstart", stop);
    map.once("wheel", stop);
    return () => {
      cancelAnimationFrame(raf);
      map.off("dragstart", stop);
      map.off("wheel", stop);
    };
  }, [orbit, status]);

  const ease = (opts: { pitch?: number; bearing?: number }) =>
    mapRef.current?.easeTo({ ...opts, duration: reduceMotion() ? 0 : 700 });

  return (
    <div className="absolute inset-0" role="region" aria-label="3D city map">
      {/* MapLibre's own stylesheet sets `position: relative` on this element,
          which would beat a Tailwind `absolute inset-0` here (it loads later)
          and collapse the map to its 300px default. So size it with h/w-full
          inside the positioned wrapper instead. */}
      <div ref={containerRef} className="h-full w-full" />

      {status === "ready" && (
        <div className="absolute bottom-8 right-2 z-10 flex flex-col items-stretch gap-1">
          <button
            type="button"
            onClick={() => setSatellite((v) => !v)}
            aria-pressed={satellite}
            className={ctl(satellite)}
            title="Satellite imagery draped over real terrain"
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => ease({ pitch: tilted ? 0 : TILT })}
            aria-pressed={tilted}
            className={ctl(tilted)}
            title="Tilt the camera between flat and 3D"
          >
            3D tilt
          </button>
          <button
            type="button"
            onClick={() => setOrbit((v) => !v)}
            aria-pressed={orbit}
            className={ctl(orbit)}
            title="Slowly orbit the camera"
          >
            Orbit
          </button>
          <button
            type="button"
            onClick={() => {
              setOrbit(false);
              ease({ bearing: 0 });
            }}
            className={ctl(false)}
            title="Reset heading to north"
            aria-label="Reset heading to north"
          >
            <span ref={compassRef} className="mr-1 inline-block" aria-hidden="true">
              ▲
            </span>
            N
          </button>
        </div>
      )}

      {status === "loading" && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center gap-2 bg-paper/70 font-mono text-xs uppercase tracking-widest"
        >
          <Loader2 className="size-4 animate-spin" /> Loading 3D basemap…
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-paper px-6 text-center font-mono text-xs"
        >
          <p>
            The 3D basemap couldn&apos;t load. Check your connection, or that this
            browser supports WebGL.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
            className={ctl(false)}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
