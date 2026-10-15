import { fetchWithTimeout } from "../usePolling";
import type { MilitaryFlight } from "../types";

/**
 * Military aircraft tracks (adsb.lol `/v2/mil`).
 *
 * adsb.lol sends no CORS headers, so production goes through the
 * `api/military` Vercel function (raw relay, CDN-cached 30s). The payload is
 * the ADSBexchange-style `{ ac: [...] }` array with imperial units (feet,
 * knots) — normalized to SI here so the map/globe/panel share the same
 * formatters as the civilian ADS-B feed.
 */

const DIRECT_URL = "https://api.adsb.lol/v2/mil";

const FT_TO_M = 0.3048;
const KT_TO_MS = 0.514444;

interface AcRow {
  hex?: unknown;
  flight?: unknown;
  t?: unknown;
  r?: unknown;
  lat?: unknown;
  lon?: unknown;
  alt_baro?: unknown;
  gs?: unknown;
  track?: unknown;
  squawk?: unknown;
  emergency?: unknown;
  seen?: unknown;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function mapRow(row: unknown): MilitaryFlight | null {
  if (!row || typeof row !== "object") return null;
  const r = row as AcRow;
  const icao24 = str(r.hex);
  const lat = num(r.lat);
  const lng = num(r.lon);
  if (!icao24 || lat === null || lng === null) return null;

  // `alt_baro` is feet, but can be the literal string "ground".
  const onGround = r.alt_baro === "ground";
  const altFt = onGround ? 0 : num(r.alt_baro);
  const spdKt = num(r.gs);

  return {
    icao24,
    callsign: str(r.flight) ?? icao24.toUpperCase(),
    type: str(r.t) ?? "—",
    reg: str(r.r) ?? "",
    lat,
    lng,
    altM: altFt === null ? null : altFt * FT_TO_M,
    spdMs: spdKt === null ? null : spdKt * KT_TO_MS,
    track: num(r.track),
    onGround,
    squawk: str(r.squawk),
    emergency: str(r.emergency),
    seen: num(r.seen) ?? 0,
  };
}

export async function fetchMilitary(): Promise<MilitaryFlight[]> {
  let json: unknown;
  try {
    const res = await fetchWithTimeout("/api/military", { cache: "no-store" }, 12_000);
    if (!res.ok) throw new Error(`military proxy ${res.status}`);
    json = await res.json();
  } catch {
    // Direct fallback — only works where CORS is not enforced.
    const res = await fetchWithTimeout(DIRECT_URL, { cache: "no-store" }, 20_000);
    if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
    json = await res.json();
  }

  const ac =
    json && typeof json === "object"
      ? (json as { ac?: unknown }).ac
      : null;
  if (!Array.isArray(ac)) return [];

  const out: MilitaryFlight[] = [];
  for (const row of ac) {
    const m = mapRow(row);
    if (m) out.push(m);
  }
  return out;
}

export const MIL_POLL_MS = 60_000;
