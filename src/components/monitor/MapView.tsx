import { Fragment, useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  GOES_FIRE_LAYERS,
  goesFireTileUrl,
} from "@/lib/monitor/api/fires";
import type {
  Disaster,
  EmergencyContact,
  Flight,
  FocusTarget,
  IssState,
  Launch,
  MilitaryFlight,
  Quake,
  RadarData,
} from "@/lib/monitor/types";
import {
  alertColor,
  DISASTER_GLYPH,
  DISASTER_LABEL,
  disasterRank,
  disasterSeverity,
} from "@/lib/monitor/disasters";

interface MapViewProps {
  baseLayer: "streets" | "satellite";
  radar: RadarData | null;
  radarEnabled: boolean;
  firesDate: string | null;
  firesEnabled: boolean;
  flights: Flight[];
  quakes: Quake[];
  iss: IssState | null;
  launches: Launch[];
  military: MilitaryFlight[];
  emergencies: EmergencyContact[];
  disasters: Disaster[];
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

/* Heading-oriented triangle — reads as a live aircraft track rather than a
   static dot, so military contacts pop out of the civilian airspace. */
function trackIcon(color: string, track: number | null, size = 16): L.DivIcon {
  const rot = track ?? 0;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;transform:rotate(${rot}deg)"><div style="width:0;height:0;border-left:${size / 2}px solid transparent;border-right:${size / 2}px solid transparent;border-bottom:${size}px solid ${color};filter:drop-shadow(1px 1px 0 rgba(20,20,20,.9))"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* Match the globe's speed ramp so the two views read the same. */
function flightColor(v: number | null): string {
  if (v === null || v < 180) return "#1e5bff";
  if (v < 235) return "#ffd400";
  return "#ff4d00";
}

/* Dead-reckon a point `distKm` along `trackDeg` — used for velocity vectors,
   the way a radar scope projects where a contact is heading. */
function projectTrack(
  lat: number,
  lng: number,
  trackDeg: number,
  distKm: number,
): [number, number] {
  const R = 6371;
  const d = distKm / R;
  const brg = (trackDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI];
}

/* Pulsing alarm beacon for aircraft squawking an emergency. */
function alarmIcon(size = 18): L.DivIcon {
  const dot = 8;
  return L.divIcon({
    className: "",
    html:
      `<div class="alarm-ping" style="position:absolute;inset:0;border:2px solid #ff2e2e;pointer-events:none"></div>` +
      `<div style="position:absolute;left:50%;top:50%;width:${dot}px;height:${dot}px;margin:-${dot / 2}px 0 0 -${dot / 2}px;background:#ff2e2e;border:2px solid #141414;box-shadow:0 0 0 2px rgba(255,46,46,.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* GDACS alert marker — colour codes the alert level, glyph codes the hazard. */
function disasterIcon(color: string, glyph: string, size = 18): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid #141414;box-shadow:2px 2px 0 rgba(20,20,20,.9);display:flex;align-items:center;justify-content:center;font:700 ${
      size - 7
    }px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff">${glyph}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const ICONS = {
  quake: nbIcon("#ff2e2e", 12),
  iss: nbIcon("#ffd400", 14, "animation: blink-dot 1s steps(1) infinite;"),
  launch: nbIcon("#b14cff", 12),
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
  launches,
  military,
  emergencies,
  disasters,
  watch,
  focus,
  onFocus,
}: MapViewProps) {
  const topFlights = [...flights]
    .sort((a, b) => (b.baroAltitude ?? 0) - (a.baroAltitude ?? 0))
    .slice(0, 40);
  const topQuakes = quakes.slice(0, 24);
  const topDisasters = [...disasters]
    .sort((a, b) => disasterRank(a) - disasterRank(b))
    .slice(0, 80);

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

      {topFlights.map((f) => {
        const color = flightColor(f.velocity);
        const vector =
          f.trueTrack !== null && f.velocity !== null
            ? projectTrack(f.lat, f.lng, f.trueTrack, Math.max(8, (f.velocity * 180) / 1000))
            : null;
        return (
          <Fragment key={`f-${f.icao24}`}>
            {vector && (
              <Polyline
                positions={[[f.lat, f.lng], vector]}
                pathOptions={{ color, weight: 1, opacity: 0.5 }}
              />
            )}
            <Marker
              position={[f.lat, f.lng]}
              icon={trackIcon(color, f.trueTrack, 13)}
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
          </Fragment>
        );
      })}

      {military.map((m) => (
        <Marker
          key={`m-${m.icao24}`}
          position={[m.lat, m.lng]}
          icon={trackIcon("#ff9d00", m.track)}
          eventHandlers={{
            click: () =>
              onFocus({
                id: m.icao24,
                kind: "point",
                lat: m.lat,
                lng: m.lng,
                label: `${m.callsign} · ${m.type}`,
              }),
          }}
        >
          <Popup>
            <div className="font-mono text-xs leading-5">
              <b>{m.callsign}</b> · {m.type}
              <br />
              MILITARY {m.reg ? `· ${m.reg}` : ""}
              <br />
              ALT {fmt((m.altM ?? 0) * 3.28084)} FT · SPD {fmt((m.spdMs ?? 0) * 1.94384)} KT
              <br />
              TRK {fmt(m.track ?? 0)}° · {m.squawk ?? "——"}
            </div>
          </Popup>
        </Marker>
      ))}

      {emergencies.map((e) => (
        <Marker
          key={`e-${e.id}`}
          position={[e.lat, e.lng]}
          icon={alarmIcon()}
          zIndexOffset={1000}
          eventHandlers={{
            click: () =>
              onFocus({
                id: e.id,
                kind: "point",
                lat: e.lat,
                lng: e.lng,
                label: `${e.callsign} · ${e.reason}`,
              }),
          }}
        >
          <Popup>
            <div className="font-mono text-xs leading-5">
              <b>{e.reason}</b>
              <br />
              {e.callsign} · {e.kind.toUpperCase()}
              <br />
              SQUAWK {e.squawk ?? "——"}
              <br />
              ALT {fmt((e.altM ?? 0) * 3.28084)} FT · SPD {fmt((e.spdMs ?? 0) * 1.94384)} KT
            </div>
          </Popup>
        </Marker>
      ))}

      {topDisasters.map((d) => (
        <Marker
          key={`d-${d.id}`}
          position={[d.lat, d.lng]}
          icon={disasterIcon(alertColor(d.alertLevel), DISASTER_GLYPH[d.kind])}
          eventHandlers={{
            click: () =>
              onFocus({
                id: d.id,
                kind: "point",
                lat: d.lat,
                lng: d.lng,
                label: `${DISASTER_LABEL[d.kind]} · ${d.country || d.alertLevel}`,
              }),
          }}
        >
          <Popup>
            <div className="font-mono text-xs leading-5">
              <b>{d.title}</b>
              <br />
              {DISASTER_LABEL[d.kind]} · {d.alertLevel}
              <br />
              {disasterSeverity(d)}
              {d.country ? (
                <>
                  <br />
                  {d.country}
                </>
              ) : null}
              {d.reportUrl ? (
                <>
                  <br />
                  <a href={d.reportUrl} target="_blank" rel="noreferrer" className="underline">
                    GDACS report ↗
                  </a>
                </>
              ) : null}
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

      {launches.map((l) => (
        <Marker
          key={`l-${l.id}`}
          position={[l.lat, l.lng]}
          icon={ICONS.launch}
          eventHandlers={{
            click: () =>
              onFocus({
                id: l.id,
                kind: "point",
                lat: l.lat,
                lng: l.lng,
                label: l.name,
              }),
          }}
        >
          <Popup>
            <div className="font-mono text-xs leading-5">
              <b>{l.name}</b>
              <br />
              {l.status} · {l.provider}
              <br />
              {l.pad}
              {l.location ? ` — ${l.location}` : ""}
              <br />
              T-0 {l.net ? `${l.net.slice(0, 16).replace("T", " ")}Z` : "TBD"}
            </div>
          </Popup>
        </Marker>
      ))}

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
