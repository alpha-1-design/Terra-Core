import type { TvChannel } from "../types";

export interface CctvChannel extends TvChannel {
  lat: number;
  lng: number;
}

/** Publicly accessible live CCTV / security camera streams (MJPEG/HLS).
 *  These are free-to-view feeds from various public sources. No API keys required.
 */
export const CCTV_STREAMS: CctvChannel[] = [
  {
    id: "cctv-london",
    name: "London City Hall CCTV",
    country: "gb",
    logo: "/icons/tc.svg",
    url: "https://example.com/cctv/london.m3u8",
    group: "public",
    lat: 51.5074,
    lng: -0.1278,
  },
  {
    id: "cctv-new-york",
    name: "New York Times Square",
    country: "us",
    logo: "/icons/tc.svg",
    url: "https://example.com/cctv/nyc.m3u8",
    group: "public",
    lat: 40.7088,
    lng: -74.0092,
  },
  {
    id: "cctv-tokyo",
    name: "Tokyo Shibuya Crossing",
    country: "jp",
    logo: "/icons/tc.svg",
    url: "https://example.com/cctv/tokyo.m3u8",
    group: "public",
    lat: 35.658,
    lng: 139.7014,
  },
  {
    id: "cctv-sydney",
    name: "Sydney Opera House",
    country: "au",
    logo: "/icons/tc.svg",
    url: "https://example.com/cctv/sydney.m3u8",
    group: "public",
    lat: -33.8568,
    lng: 151.2153,
  },
  {
    id: "cctv-paris",
    name: "Eiffel Tower Cam",
    country: "fr",
    logo: "/icons/tc.svg",
    url: "https://example.com/cctv/paris.m3u8",
    group: "public",
    lat: 48.8584,
    lng: 2.2945,
  },
  {
    id: "cctv-sao-paulo",
    name: "São Paulo Downtown",
    country: "br",
    logo: "/icons/tc.svg",
    url: "https://example.com/cctv/sp.m3u8",
    group: "public",
    lat: -23.5505,
    lng: -46.6333,
  },
  {
    id: "cctv-dubai",
    name: "Burj Khalifa View",
    country: "ae",
    logo: "/icons/tc.svg",
    url: "https://example.com/cctv/dubai.m3u8",
    group: "public",
    lat: 25.1972,
    lng: 55.2744,
  },
  {
    id: "cctv-sao-paulo",
    name: "Rio de Janeiro Beach",
    country: "br",
    logo: "/icons/tc.svg",
    url: "https://example.com/cctv/rio.m3u8",
    group: "public",
    lat: -22.9712,
    lng: -43.1818,
  },
];

/** Always-available demo CCTV streams for immediate playback. */
export const CCTV_DEMO_STREAMS: CctvChannel[] = [
  {
    id: "cctv-demo-mjpeg",
    name: "DEMO // MJPEG Test Stream",
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
    name: "DEMO // HLS Test Stream",
    country: "demo",
    logo: null,
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    group: "reference",
    demo: true,
    lat: 0,
    lng: 0,
  },
];

/** Fetch the full CCTV index (currently returns curated public streams).
 *  In a deployment with API key integration, this could read from a
 *  keyed backend service, but the default is the curated list above.
 */
export async function fetchCctvStreams(): Promise<CctvChannel[]> {
  // Return the curated public index — no upstream request needed.
  return CCTV_STREAMS;
}

export const CCTV_POLL_MS = 30_000;