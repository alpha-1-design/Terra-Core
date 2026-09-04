import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  GOES_FIRE_LAYERS,
  goesFireTileUrl,
} from "@/lib/monitor/api/fires";
import type {
  Flight,
  FocusTarget,
  IssState,
  Quake,
  RadarData,
} from "@/lib/monitor/types";

interface MapViewProps {
  baseLayer: "streets" | "satellite";
  radar: RadarData | null;
  radarEnabled: boolean;
  firesDate: string | null;
  firesEnabled: boolean;
  flights: Flight[];
  quakes: Quake[];
  iss: IssState | null;
  watch: { id: string; name: string; lat: number; lng: number }[];
  focus: FocusTarget | null;
  onFocus: (t: FocusTarget) => void;
}

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTR = "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics";

function nbIcon(color: string, size = 12, extra = ""): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid #141414;box-shadow:2px 2px 0 rgba(20,20,20,.9);${extra}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const ICONS = {
  flight: nbIcon("#1e5bff", 10),
  quake: nbIcon("#ff2e2e", 12),
  iss: nbIcon("#ffd400", 14, "animation: blink-dot 1s steps(1) infinite;"),
  watch: nbIcon("#141414", 12),
};

const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });

/* Animated RainViewer radar overlay */
function RadarLayer({ radar, enabled }: { radar: RadarData | null; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !radar || radar.frames.length === 0) return;
    let layer: L.TileLayer | null = null;
    let idx = 0;

    const apply = () => {
      const frame = radar.frames[idx % radar.frames.length];
      if (layer) map.removeLayer(layer);
      layer = L.tileLayer(
        `${radar.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
        { opacity: 0.65, zIndex: 500 },
      );
      layer.addTo(map);
      idx += 1;
    };

    apply();
    const timer = setInterval(apply, 900);
    return () => {
      clearInterval(timer);
      if (layer) map.removeLayer(layer);
    };
  }, [map, radar, enabled]);
  return null;
}

/* NASA GIBS GOES fire-temperature overlays (Americas) */
function FiresLayer({ date, enabled }: { date: string | null; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !date) return;
    const layers = GOES_FIRE_LAYERS.map((def) =>
      L.tileLayer(goesFireTileUrl(def, date), {
        opacity: 0.8,
        zIndex: 460,
        maxNativeZoom: 7,
        tileSize: 256,
      }),
    );
    layers.forEach((l) => l.addTo(map));
    return () => {
      layers.forEach((l) => map.removeLayer(l));
    };
  }, [map, date, enabled]);
  return null;
}

/* Fly the map to the active focus target */
function FlyToController({ focus }: { focus: FocusTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    const zoom =
      focus.kind === "city" || focus.kind === "watch"
        ? 9
        : focus.kind === "iss"
          ? 4
          : 7;
    map.flyTo([focus.lat, focus.lng], zoom, { duration: 1.1 });
  }, [map, focus]);
  return null;
}

export default function MapView({
  baseLayer,
  radar,
  radarEnabled,
  firesDate,
  firesEnabled,
  flights,
  quakes,
  iss,
  watch,
  focus,
  onFocus,
}: MapViewProps) {
  const topFlights = [...flights]
    .sort((a, b) => (b.baroAltitude ?? 0) - (a.baroAltitude ?? 0))
    .slice(0, 40);
  const topQuakes = quakes.slice(0, 24);

  return (
    <MapContainer
      center={[25, 10]}
      zoom={2}
      minZoom={2}
      maxZoom={18}
      className="h-full w-full"
      style={{ background: "#e9e4d5" }}
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer
        attribution={baseLayer === "streets" ? OSM_ATTR : ESRI_ATTR}
        url={baseLayer === "streets" ? OSM_URL : ESRI_URL}
      />
      {baseLayer === "satellite" && (
        <TileLayer
          attribution={OSM_ATTR}
          url={OSM_URL}
          opacity={0.25}
          maxZoom={14}
        />
      )}
      <RadarLayer radar={radar} enabled={radarEnabled} />
      <FiresLayer date={firesDate} enabled={firesEnabled} />
      <FlyToController focus={focus} />

      {topFlights.map((f) => (
        <Marker
          key={`f-${f.icao24}`}
          position={[f.lat, f.lng]}
          icon={ICONS.flight}
          eventHandlers={{
            click: () =>
              onFocus({
                id: f.icao24,
                kind: "flight",
                lat: f.lat,
                lng: f.lng,
                label: f.callsign,
              }),
          }}
        >
          <Popup>
            <div className="font-mono text-xs leading-5">
              <b>{f.callsign}</b> · {f.originCountry}
              <br />
              ALT {fmt((f.baroAltitude ?? 0) * 3.28084)} FT
              <br />
              SPD {fmt((f.velocity ?? 0) * 1.94384)} KT · TRK {fmt(f.trueTrack ?? 0)}°
            </div>
          </Popup>
        </Marker>
      ))}

      {topQuakes.map((q) => (
        <Marker
          key={`q-${q.id}`}
          position={[q.lat, q.lng]}
          icon={ICONS.quake}
          eventHandlers={{
            click: () =>
              onFocus({
                id: q.id,
                kind: "quake",
                lat: q.lat,
                lng: q.lng,
                label: q.place,
              }),
          }}
        >
          <Popup>
            <div className="font-mono text-xs leading-5">
              <b>M {q.mag.toFixed(1)}</b> · {q.place}
              <br />
              DEPTH {fmt(q.depth, 1)} KM
            </div>
          </Popup>
        </Marker>
      ))}

      {iss && (
        <Marker
          position={[iss.lat, iss.lng]}
          icon={ICONS.iss}
          eventHandlers={{
            click: () =>
              onFocus({ id: "iss", kind: "iss", lat: iss.lat, lng: iss.lng, label: "ISS" }),
          }}
        >
          <Popup>
            <div className="font-mono text-xs leading-5">
              <b>ISS</b> · ALT {fmt(iss.altitudeKm)} KM
              <br />
              VEL {fmt(iss.velocityKmH)} KM/H
            </div>
          </Popup>
        </Marker>
      )}

      {watch.map((w) => (
        <Marker
          key={`w-${w.id}`}
          position={[w.lat, w.lng]}
          icon={ICONS.watch}
          eventHandlers={{
            click: () =>
              onFocus({
                id: w.id,
                kind: "watch",
                lat: w.lat,
                lng: w.lng,
                label: w.name,
              }),
          }}
        >
          <Popup>
            <div className="font-mono text-xs">
              <b>{w.name}</b>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Attribution chips */}
      {radarEnabled && radar && radar.frames.length > 0 && (
        <div
          className="pointer-events-none absolute bottom-0 right-0 z-[1000] bg-white/90 px-1 font-mono text-[9px] uppercase tracking-wider"
          style={{ border: "1px solid #141414" }}
        >
          Radar © RainViewer
        </div>
      )}
      {firesEnabled && firesDate && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 z-[1000] bg-white/90 px-1 font-mono text-[9px] uppercase tracking-wider"
          style={{ border: "1px solid #141414" }}
        >
          Fires © NASA GIBS GOES · {firesDate}
        </div>
      )}
    </MapContainer>
  );
}
