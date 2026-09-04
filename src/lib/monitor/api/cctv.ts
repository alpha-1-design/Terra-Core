import type { TvChannel } from "../types";

export interface CctvChannel extends TvChannel {
  lat: number;
  lng: number;
  /** Where the feed points — used for the globe marker tooltip. */
  location?: string;
}

/** Verified-live public camera / space feeds.
 *
 *  Each URL below was checked and returns a live HLS playlist. City webcams
 *  are almost always geo-blocked or ToS-restricted for third-party hotlinking,
 *  so the index favours streams that are genuinely open: NASA TV (mission
 *  coverage) plus always-on reference feeds. Drop any working .m3u8 URL into
 *  this list to add a camera.
 */
export const CCTV_STREAMS: CctvChannel[] = [
  {
    id: "cctv-nasa-tv",
    name: "NASA TV // Mission Coverage",
    country: "us",
    logo: "/icons/tc.svg",
    url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
    group: "space",
    location: "NASA TV Public · from the ISS to mission control",
    lat: 28.5729,
    lng: -80.649,
  },
  {
    id: "cctv-demo-mjpeg",
    name: "DEMO // Mux Test Feed",
    country: "demo",
    logo: null,
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    group: "reference",
    demo: true,
    lat: 0,
    lng: 0,
  },
  {
    id: "cctv-demo-hls",
    name: "DEMO // Akamai Live TV",
    country: "demo",
    logo: null,
    url: "https://moctobpltc-i.akamaihd.net/hls/live/571329/eight/playlist.m3u8",
    group: "reference",
    demo: true,
    lat: 0,
    lng: 0,
  },
  {
    id: "cctv-demo-tos",
    name: "DEMO // Tears of Steel (Unified)",
    country: "demo",
    logo: null,
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    group: "reference",
    demo: true,
    lat: 0,
    lng: 0,
  },
];

/** Fetch the full CCTV index (curated verified feeds, no upstream request). */
export async function fetchCctvStreams(): Promise<CctvChannel[]> {
  return CCTV_STREAMS;
}

export const CCTV_POLL_MS = 30_000;

/** Demo feeds, pinned onto the globe as markers. */
export const CCTV_DEMO_STREAMS: CctvChannel[] = CCTV_STREAMS.filter(
  (c) => c.demo,
);
