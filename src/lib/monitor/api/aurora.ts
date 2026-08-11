import type { AuroraState } from "../types";

const OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";

interface OvationResponse {
  "Observation Time": string;
  "Forecast Time": string;
  "Data Format": string;
  coordinates: [number, number, number][]; // [lon, lat, intensity 0..100]
}

/** Cap for the globe point layer (decimated, highest intensity first). */
const MAX_POINTS = 2400;

/**
 * NOAA OVATION Prime aurora forecast (30–90 min ahead), decimated to a
 * renderable oval. Intensity is normalized against the current maximum so the
 * oval stays visible on quiet days and blooms during storms.
 */
export async function fetchAurora(): Promise<AuroraState> {
  const res = await fetch(OVATION_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`NOAA OVATION ${res.status}`);
  const json = (await res.json()) as OvationResponse;

  const max = json.coordinates.reduce((m, c) => Math.max(m, c[2]), 0);
  if (max <= 0) {
    return {
      observedAt: json["Observation Time"] ?? null,
      forecastFor: json["Forecast Time"] ?? null,
      maxIntensity: 0,
      points: [],
    };
  }

  // Keep every 2nd grid cell (lon step 2, lat step 2) above a relative + absolute floor.
  // Grid is lon-major: index = lon * 181 + (lat + 90).
  const threshold = Math.max(6, max * 0.35);
  const candidates: { lat: number; lng: number; intensity: number }[] = [];
  for (let lo = 0; lo < 360; lo += 2) {
    for (let la = -90; la <= 90; la += 2) {
      const cell = json.coordinates[lo * 181 + (la + 90)];
      if (!cell) continue;
      const intensity = cell[2];
      if (intensity < threshold) continue;
      candidates.push({ lat: la, lng: lo > 180 ? lo - 360 : lo, intensity });
    }
  }

  candidates.sort((a, b) => b.intensity - a.intensity);
  const points = candidates.slice(0, MAX_POINTS).map((p) => ({
    lat: p.lat,
    lng: p.lng,
    intensity: p.intensity,
  }));

  return {
    observedAt: json["Observation Time"] ?? null,
    forecastFor: json["Forecast Time"] ?? null,
    maxIntensity: max,
    points,
  };
}

export const AURORA_POLL_MS = 10 * 60_000;
