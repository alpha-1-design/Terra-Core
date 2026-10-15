import { useEffect, useRef, useState } from "react";
import type {
  Cartesian2,
  LabelCollection,
  PointPrimitiveCollection,
  ScreenSpaceEventHandler,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { alertColor, DISASTER_LABEL, disasterSeverity } from "@/lib/monitor/disasters";
import type {
  AuroraState,
  Disaster,
  EmergencyContact,
  Flight,
  FocusTarget,
  IssState,
  Launch,
  MilitaryFlight,
  Quake,
  Satellite,
} from "@/lib/monitor/types";

/**
 * Photoreal 3D globe mode — CesiumJS rendering Google Photorealistic 3D Tiles
 * through the user's Cesium ion token, with the console's live layers drawn as
 * a single efficient `PointPrimitiveCollection`.
 *
 * Cesium is ~1.4MB gzipped and only ever imported by this component, which is
 * itself lazy-loaded and only mounted when the operator switches the globe to
 * "Photoreal". Nothing here touches the default globe.gl path, so a missing or
 * rate-limited ion token degrades to a message, never to a broken console.
 *
 * `CESIUM_BASE_URL` is computed from this module's own URL so it stays correct
 * on the Vercel root, on a GitHub Pages subpath, and in dev (where the Vite
 * plugin serves the static trees from node_modules under /cesium/).
 */

/** Cesium ion asset id for Google Photorealistic 3D Tiles. */
const PHOTOREAL_ASSET_ID = 2275207;

const CESIUM_BASE_URL = import.meta.env.DEV
  ? "/cesium/"
  : new URL("../cesium/", import.meta.url).href;

interface CesiumViewProps {
  token: string;
  flights: Flight[];
  quakes: Quake[];
  military: MilitaryFlight[];
  emergencies: EmergencyContact[];
  disasters: Disaster[];
  launches: Launch[];
  iss: IssState | null;
  satellites: Satellite[];
  aurora: AuroraState | null;
  auroraEnabled: boolean;
  focus: FocusTarget | null;
  onSelectPoint: (lat: number, lng: number) => void;
}

type CesiumNs = typeof import("cesium");

function flightColor(v: number | null): string {
  if (v === null || v < 180) return "#1e5bff";
  if (v < 235) return "#ffd400";
  return "#ff4d00";
}

export default function CesiumView({
  token,
  flights,
  quakes,
  military,
  emergencies,
  disasters,
  launches,
  iss,
  satellites,
  aurora,
  auroraEnabled,
  focus,
  onSelectPoint,
}: CesiumViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cesiumRef = useRef<CesiumNs | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const pointsRef = useRef<PointPrimitiveCollection | null>(null);
  const labelsRef = useRef<LabelCollection | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);

  /* Keep the click handler current without re-creating the viewer. */
  const selectRef = useRef(onSelectPoint);
  useEffect(() => {
    selectRef.current = onSelectPoint;
  }, [onSelectPoint]);

  /* ── Boot Cesium ─────────────────────────────────────── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;

    (async () => {
      (globalThis as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = CESIUM_BASE_URL;
      const C = await import("cesium");
      if (disposed) return;
      cesiumRef.current = C;

      C.Ion.defaultAccessToken = token;

      const viewer = new C.Viewer(el, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        terrain: C.Terrain.fromWorldTerrain(),
      });
      if (disposed) {
        viewer.destroy();
        return;
      }
      viewerRef.current = viewer;

      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.fog.enabled = true;
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
        C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
      );

      pointsRef.current = viewer.scene.primitives.add(new C.PointPrimitiveCollection());
      labelsRef.current = viewer.scene.primitives.add(new C.LabelCollection());

      /* Photoreal 3D Tiles (Google, via Cesium ion). */
      try {
        const tileset = await C.Cesium3DTileset.fromIonAssetId(PHOTOREAL_ASSET_ID);
        if (disposed) {
          tileset.destroy();
          return;
        }
        viewer.scene.primitives.add(tileset);
      } catch (err) {
        console.warn("[TERRA-CORE] photoreal tileset unavailable:", err);
        if (!disposed) setTilesFailed(true);
      }

      /* Click the globe to probe that coordinate in the console. */
      const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((evt: { position: Cartesian2 }) => {
        const cart = viewer.camera.pickEllipsoid(evt.position, viewer.scene.globe.ellipsoid);
        if (!cart) return;
        const c = C.Cartographic.fromCartesian(cart);
        selectRef.current(C.Math.toDegrees(c.latitude), C.Math.toDegrees(c.longitude));
      }, C.ScreenSpaceEventType.LEFT_CLICK);
      handlerRef.current = handler;

      /* Open near the surface (≈1.6 Earth-radii, matching globe.gl's default
         framing) over photoreal-heavy central Europe — continents and city
         detail are instantly legible instead of a tiny Earth in space. */
      viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(12, 46, 4_000_000) });

      if (!disposed) setReady(true);
    })();

    return () => {
      disposed = true;
      handlerRef.current?.destroy();
      handlerRef.current = null;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) viewerRef.current.destroy();
      viewerRef.current = null;
      pointsRef.current = null;
      labelsRef.current = null;
      cesiumRef.current = null;
    };
  }, [token]);

  /* ── Live layers → point primitives ──────────────────── */
  useEffect(() => {
    const C = cesiumRef.current;
    const points = pointsRef.current;
    const labels = labelsRef.current;
    if (!C || !points || !labels || !ready) return;

    points.removeAll();
    labels.removeAll();

    const dot = (
      lat: number,
      lng: number,
      height: number,
      color: string,
      pixelSize: number,
      outline: string | null = null,
      outlineWidth = 0,
    ) => {
      points.add({
        position: C.Cartesian3.fromDegrees(lng, lat, height),
        color: C.Color.fromCssColorString(color),
        pixelSize,
        outlineColor: outline ? C.Color.fromCssColorString(outline) : undefined,
        outlineWidth,
        /* Never let Photoreal 3D buildings swallow the live layers. */
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    };

    /* Compact always-visible text label (drawn above its point). */
    const label = (lat: number, lng: number, height: number, text: string, color: string) => {
      labels.add({
        position: C.Cartesian3.fromDegrees(lng, lat, height),
        text,
        font: "600 11px 'Segoe UI', system-ui, sans-serif",
        fillColor: C.Color.fromCssColorString(color),
        outlineColor: C.Color.fromCssColorString("#0b0e17"),
        outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new C.Cartesian2(0, -16),
        verticalOrigin: C.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new C.NearFarScalar(3.0e6, 1.0, 4.0e7, 0.0),
      });
    };

    for (const f of flights.slice(0, 400)) {
      dot(f.lat, f.lng, f.baroAltitude ?? 0, flightColor(f.velocity), 6);
    }
    for (const m of military.slice(0, 300)) {
      dot(m.lat, m.lng, m.altM ?? 0, "#ff9d00", 7, "#141414", 1);
    }
    for (const e of emergencies) {
      dot(e.lat, e.lng, e.altM ?? 0, "#ff2e2e", 12, "#141414", 2);
      label(e.lat, e.lng, (e.altM ?? 0) + 4_000, `EMERG · ${e.squawk ?? e.reason}`, "#ff9090");
    }
    for (const q of quakes.slice(0, 120)) {
      dot(q.lat, q.lng, 100, "#ff2e2e", 6 + Math.min(10, q.mag * 1.6), "#141414", 1);
      /* Only the biggest shocks earn a label, so strong clusters stay readable. */
      if (q.mag >= 5.5) label(q.lat, q.lng, 120, `M${q.mag.toFixed(1)}`, "#ff9090");
    }
    for (const d of disasters) {
      dot(d.lat, d.lng, 100, alertColor(d.alertLevel), 10, "#141414", 2);
      label(
        d.lat,
        d.lng,
        120,
        `${DISASTER_LABEL[d.kind]} · ${d.country || d.alertLevel} · ${disasterSeverity(d)}`,
        alertColor(d.alertLevel),
      );
    }
    for (const l of launches) {
      dot(l.lat, l.lng, 100, "#b14cff", 9, "#141414", 1);
      label(l.lat, l.lng, 400, l.name.slice(0, 30), "#c98aff");
    }
    if (iss) dot(iss.lat, iss.lng, iss.altitudeKm * 1000, "#ffd400", 12, "#141414", 2);
    for (const s of satellites.slice(0, 400)) {
      dot(s.lat, s.lng, s.altKm * 1000, "#ffffff", 5, "#141414", 1);
    }
    if (auroraEnabled && aurora) {
      const max = aurora.maxIntensity || 1;
      for (const p of aurora.points.slice(0, 600)) {
        const t = Math.min(1, p.intensity / max);
        dot(p.lat, p.lng, 110_000, "rgba(70,255,170,0.85)", 4 + t * 8);
      }
    }
  }, [
    ready,
    flights,
    quakes,
    military,
    emergencies,
    disasters,
    launches,
    iss,
    satellites,
    aurora,
    auroraEnabled,
  ]);

  /* ── Fly-to ──────────────────────────────────────────── */
  useEffect(() => {
    const C = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!C || !viewer || !focus || !ready) return;
    const close = focus.kind === "city" || focus.kind === "watch";
    viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(focus.lng, focus.lat, close ? 9_000 : 45_000),
      duration: 1.6,
    });
  }, [focus, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {tilesFailed && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
          <span className="nb-chip-solid whitespace-nowrap bg-alert text-white">
            Photoreal tiles unavailable · showing base imagery
          </span>
        </div>
      )}
    </div>
  );
}
