import type { IssState, Quake, SpaceWeather } from "../types";

const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const DST_URL = "https://services.swpc.noaa.gov/products/kyoto-dst.json";

interface UsgsFeed {
  features: {
    id: string;
    properties: {
      mag: number | null;
      place: string;
      time: number;
      url: string;
      type: string;
    };
    geometry: { coordinates: [number, number, number] };
  }[];
}

/** All earthquakes in the last 24h, sorted by magnitude (desc). */
export async function fetchQuakes(): Promise<Quake[]> {
  const res = await fetch(USGS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const json = (await res.json()) as UsgsFeed;

  return json.features
    .filter((f) => f.properties.type === "earthquake" && f.properties.mag !== null)
    .map((f) => ({
      id: f.id,
      mag: f.properties.mag ?? 0,
      place: f.properties.place ?? "Unknown",
      time: f.properties.time,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      url: f.properties.url,
    }))
    .sort((a, b) => b.mag - a.mag);
}

interface WhereTheIss {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  timestamp: number;
}

/** Live ISS position (api.wheretheiss.at). */
export async function fetchIss(): Promise<IssState> {
  const res = await fetch(ISS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`ISS ${res.status}`);
  const json = (await res.json()) as WhereTheIss;
  return {
    lat: json.latitude,
    lng: json.longitude,
    altitudeKm: json.altitude,
    velocityKmH: json.velocity,
    timestamp: json.timestamp,
  };
}

/** Latest planetary Kp index + DST from NOAA SWPC. */
export async function fetchSpaceWeather(): Promise<SpaceWeather> {
  let kp: number | null = null;
  let kpTime: string | null = null;
  let dst: number | null = null;
  let dstTime: string | null = null;

  try {
    const res = await fetch(KP_URL, { cache: "no-store" });
    if (res.ok) {
      const rows = (await res.json()) as string[][];
      const last = rows[rows.length - 1];
      kp = last ? parseFloat(last[1]) : null;
      kpTime = last?.[0] ?? null;
    }
  } catch {
    /* non-fatal */
  }

  try {
    const res = await fetch(DST_URL, { cache: "no-store" });
    if (res.ok) {
      const rows = (await res.json()) as string[][];
      const header = rows[0];
      const dstIdx = header.findIndex((h) => h.toLowerCase().includes("dst"));
      const last = rows[rows.length - 1];
      if (dstIdx > 0 && last) {
        dst = parseFloat(last[dstIdx]);
        dstTime = last[1] ?? last[0] ?? null;
      } else if (last) {
        dst = parseFloat(last[last.length - 1]);
        dstTime = last[0] ?? null;
      }
    }
  } catch {
    /* non-fatal */
  }

  return { kp, kpTime, dst, dstTime };
}
