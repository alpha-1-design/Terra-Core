import type { RadarData } from "../types";

const MANIFEST_URL = "https://api.rainviewer.com/public/weather-maps.json";

interface RainViewerManifest {
  host: string;
  generated: number;
  radar: { past: { time: number; path: string }[]; nowcast: { time: number; path: string }[] };
}

/** Latest precipitation radar frames (past + nowcast), newest first. */
export async function fetchRadarFrames(): Promise<RadarData> {
  const res = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`RainViewer ${res.status}`);
  const json = (await res.json()) as RainViewerManifest;

  // The manifest shape is stable, but a partial/changed response must never
  // throw on spread of undefined — degrade to an empty frame list.
  const past = Array.isArray(json?.radar?.past) ? json.radar.past : [];
  const nowcast = Array.isArray(json?.radar?.nowcast) ? json.radar.nowcast : [];
  const frames = [...past, ...nowcast]
    .filter((f) => f && typeof f.time === "number" && typeof f.path === "string")
    .sort((a, b) => a.time - b.time)
    .slice(-24); // last ~4h in 10-min steps

  return { host: json.host ?? "https://tilecache.rainviewer.com", generated: json.generated ?? Date.now() / 1000, frames };
}

export function radarTileUrl(
  host: string,
  framePath: string,
  z: number,
  x: number,
  y: number,
): string {
  return `${host}${framePath}/256/${z}/${x}/${y}/2/1_1.png`;
}
