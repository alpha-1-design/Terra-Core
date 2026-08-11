import type { TvChannel } from "../types";

export const TV_COUNTRIES: { code: string; name: string }[] = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "pt", name: "Portugal" },
  { code: "nl", name: "Netherlands" },
  { code: "tr", name: "Türkiye" },
  { code: "in", name: "India" },
  { code: "jp", name: "Japan" },
  { code: "kr", name: "South Korea" },
  { code: "br", name: "Brazil" },
  { code: "mx", name: "Mexico" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "ru", name: "Russia" },
  { code: "pl", name: "Poland" },
];

const PLAYLIST_URL = (code: string) =>
  `https://iptv-org.github.io/iptv/countries/${code}.m3u`;

const BLOCKED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "twitch.tv",
  "vimeo.com",
  "dailymotion.com",
  "facebook.com",
  "tvpuls",
];

function isPlayableUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    if (BLOCKED_HOSTS.some((b) => host.includes(b))) return false;
  } catch {
    return false;
  }
  return /^https?:/.test(url) && /\.(m3u8|mpd|ts|m3u)(\?.*)?$/i.test(url);
}

interface M3uEntry {
  id: string;
  name: string;
  logo: string | null;
  group: string | null;
  url: string;
}

function parseM3u(text: string): M3uEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: M3uEntry[] = [];
  let current: Partial<M3uEntry> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF")) {
      const tvgLogo = /tvg-logo="([^"]*)"/.exec(line)?.[1] ?? null;
      const tvgId = /tvg-id="([^"]*)"/.exec(line)?.[1] ?? null;
      const group = /group-title="([^"]*)"/.exec(line)?.[1] ?? null;
      const name = (line.split(",").slice(1).join(",") || "Channel").trim();
      current = { id: tvgId ?? name, name, logo: tvgLogo, group };
    } else if (line && !line.startsWith("#") && current) {
      const entry: M3uEntry = { ...current, url: line } as M3uEntry;
      if (isPlayableUrl(entry.url)) entries.push(entry);
      current = null;
    }
  }
  return entries;
}

/** Fetch a country playlist from iptv-org and extract playable channels. */
export async function fetchTvChannels(countryCode: string): Promise<TvChannel[]> {
  const res = await fetch(PLAYLIST_URL(countryCode), { cache: "no-store" });
  if (!res.ok) throw new Error(`IPTV ${res.status}`);
  const text = await res.text();
  return parseM3u(text)
    .slice(0, 120)
    .map((e) => ({
      id: e.id,
      name: e.name,
      country: countryCode,
      logo: e.logo,
      url: e.url,
      group: e.group ?? undefined,
    }));
}

/** Always-playable reference feeds so live playback works out of the box. */
export const DEMO_STREAMS: TvChannel[] = [
  {
    id: "demo-bbb",
    name: "DEMO // Big Buck Bunny (Mux)",
    country: "demo",
    logo: null,
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    group: "reference",
    demo: true,
  },
  {
    id: "demo-tos",
    name: "DEMO // Tears of Steel (Mux)",
    country: "demo",
    logo: null,
    url: "https://test-streams.mux.dev/tos_ismc/main.m3u8",
    group: "reference",
    demo: true,
  },
  {
    id: "demo-akamai-live",
    name: "DEMO // Akamai Live Test TV",
    country: "demo",
    logo: null,
    url: "https://moctobpltc-i.akamaihd.net/hls/live/571329/eight/playlist.m3u8",
    group: "reference",
    demo: true,
  },
  {
    id: "demo-tos-unified",
    name: "DEMO // Tears of Steel (Unified)",
    country: "demo",
    logo: null,
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    group: "reference",
    demo: true,
  },
];
