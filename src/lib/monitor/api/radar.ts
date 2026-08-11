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

  const frames = [...json.radar.past, ...json.radar.nowcast]
    .sort((a, b) => a.time - b.time)
    .slice(-24); // last ~4h in 10-min steps

  return { host: json.host, generated: json.generated, frames };
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
