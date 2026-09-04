import * as satellite from "satellite.js";
import type { Satellite as SatPosition } from "../types";

/**
 * Live satellite positions (Starlink + ISS), propagated from TLE orbital
 * elements with satellite.js.
 *
 * The TLE text is fetched through the Vercel function `api/satellites.ts`
 * (Celestrak sends no CORS headers, so browsers need the proxy). In the
 * Vercel-deployed app the proxy serves CDN-cached TLEs; in a local preview
 * without the function the layer simply stays empty and degrades silently.
 */

const PROXY_URL = "/api/satellites";

export const SAT_POLL_MS = 5 * 60_000;
const MAX_SATS = 1400;

async function fetchTleText(): Promise<string> {
  const res = await fetch(PROXY_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`satellite proxy ${res.status}`);
  return res.text();
}

/** Parse a Celestrak group TLE dump (name / line1 / line2 triples). */
function parseTles(text: string): { name: string; line1: string; line2: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: { name: string; line1: string; line2: string }[] = [];
  let pendingName: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("1 ")) {
      const l2 = lines[i + 1];
      if (l2 && l2.startsWith("2 ")) {
        out.push({ name: pendingName ?? "SAT", line1: line, line2: l2 });
        i += 1;
      }
      pendingName = null;
    } else if (!line.startsWith("2 ")) {
      pendingName = line;
    }
  }
  return out;
}

export async function fetchSatellites(): Promise<SatPosition[]> {
  const text = await fetchTleText();
  const tles = parseTles(text);
  if (tles.length === 0) return [];

  // Evenly sample down to MAX_SATS so the globe stays responsive.
  const step = Math.max(1, Math.ceil(tles.length / MAX_SATS));
  const sampled = tles.filter((_, i) => i % step === 0);

  const now = new Date();
  const gmst = satellite.gstime(now);
  const out: SatPosition[] = [];

  for (const tle of sampled) {
    try {
      const rec = satellite.twoline2satrec(tle.line1, tle.line2);
      const eci = satellite.propagate(rec, now);
      if (!eci) continue;
      const { position } = eci;
      if (!position || typeof position !== "object") continue;
      const geo = satellite.eciToGeodetic(position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lng = satellite.degreesLong(geo.longitude);
      const altKm = geo.height;
      if (Number.isNaN(lat) || Number.isNaN(lng) || altKm < 0) continue;
      const name = tle.name.replace(/^0 /, "").trim();
      out.push({
        satId: name,
        name: name.slice(0, 24),
        lat,
        lng,
        altKm,
      });
    } catch {
      /* malformed TLE — skip */
    }
  }
  return out;
}
