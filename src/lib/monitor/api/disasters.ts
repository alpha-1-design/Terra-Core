import { fetchWithTimeout } from "../usePolling";
import type { Disaster, DisasterKind } from "../types";

/**
 * GDACS global disaster alerts (earthquakes, tropical cyclones, floods,
 * volcanoes, wildfires) from UN OCHA / EC JRC.
 *
 * The endpoint sends no CORS header, so production goes through the
 * `api/disasters` Vercel function (raw relay, CDN-cached 15 min). The payload
 * is a GeoJSON FeatureCollection; the mapper normalizes each feature's
 * `properties` into a flat Disaster record.
 */

const DIRECT_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,WF";

const KINDS: DisasterKind[] = ["EQ", "TC", "FL", "VO", "WF"];

interface GdacsFeature {
  geometry?: { coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/* GDACS mixes types across fields — `eventid`/`episodeid` arrive as numbers,
   `eventtype` as a string. Coerce ids so React keys and focus targets are
   unique instead of all collapsing to "?". */
function idPart(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return str(v) ?? "?";
}

function mapFeature(f: unknown): Disaster | null {
  if (!f || typeof f !== "object") return null;
  const feat = f as GdacsFeature;

  const coords = feat.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = num(coords[0]);
  const lat = num(coords[1]);
  if (lat === null || lng === null) return null;

  const p = feat.properties ?? {};
  const kind = (str(p.eventtype) ?? "").toUpperCase() as DisasterKind;
  if (!KINDS.includes(kind)) return null;

  const sev = (p.severitydata ?? {}) as Record<string, unknown>;
  const level = str(p.alertlevel);
  const alertLevel = level === "Red" || level === "Orange" ? level : "Green";
  const urlObj = (p.url ?? {}) as Record<string, unknown>;

  return {
    id: `${kind}-${idPart(p.eventid)}-${idPart(p.episodeid)}`,
    kind,
    title: str(p.name) ?? str(p.eventname) ?? `${kind} alert`,
    country: str(p.country) ?? "",
    lat,
    lng,
    severity: num(sev.severity),
    severityUnit: str(sev.severityunit) ?? "",
    severityText: str(sev.severitytext) ?? "",
    alertLevel,
    alertScore: num(p.alertscore) ?? 0,
    fromDate: str(p.fromdate) ?? "",
    toDate: str(p.todate) ?? "",
    reportUrl: str(urlObj.report),
  };
}

export async function fetchDisasters(): Promise<Disaster[]> {
  let json: unknown;
  try {
    const res = await fetchWithTimeout("/api/disasters", { cache: "no-store" }, 12_000);
    if (!res.ok) throw new Error(`disasters proxy ${res.status}`);
    json = await res.json();
  } catch {
    const res = await fetchWithTimeout(DIRECT_URL, { cache: "no-store" }, 20_000);
    if (!res.ok) throw new Error(`gdacs ${res.status}`);
    json = await res.json();
  }

  const features =
    json && typeof json === "object" ? (json as { features?: unknown }).features : null;
  if (!Array.isArray(features)) return [];

  const out: Disaster[] = [];
  for (const f of features) {
    const d = mapFeature(f);
    if (d) out.push(d);
  }
  return out;
}

/** Alerts roll over a few times an hour — 15 min is plenty. */
export const DISASTER_POLL_MS = 15 * 60_000;
