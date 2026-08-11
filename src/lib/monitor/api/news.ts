/**
 * World news feed.
 *
 * Cascade (best first):
 *   1. Keyed GNews via the Vercel proxy (/api/news?source=gnews). The key is
 *      read server-side from NEWS_API_KEY, so it never reaches the client.
 *   2. GDELT Project DOC API — free, open, no key — proxied through the same
 *      function (/api/news?source=gdelt) so the CDN absorbs GDELT's strict
 *      per-IP rate limit. This is the open-source global news database the
 *      parent project Core-X used.
 *   3. Google News RSS (keyless, per-region) through a public CORS relay,
 *      so the panel is never dead — even in local dev with no function.
 */

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  image: string | null;
  source: string | null;
  publishedAt: number; // epoch ms
}

export interface NewsFeed {
  configured: boolean; // true when the keyed GNews feed is active
  source: "gnews" | "gdelt" | "rss";
  regionId: string;
  regionLabel: string;
  articles: NewsArticle[];
  updatedAt: number;
  error?: string;
}

export interface NewsRegion {
  id: string;
  label: string;
  country?: string; // GNews country code (omit for world)
  lang: string; // GNews language code
  hl: string; // Google News UI language
  gl: string; // Google News region
  ceid: string; // Google News edition
}

export const NEWS_REGIONS: NewsRegion[] = [
  { id: "world", label: "World", lang: "en", hl: "en-US", gl: "US", ceid: "US:en" },
  { id: "us", label: "USA", country: "us", lang: "en", hl: "en-US", gl: "US", ceid: "US:en" },
  { id: "gb", label: "UK", country: "gb", lang: "en", hl: "en-GB", gl: "GB", ceid: "GB:en" },
  { id: "in", label: "India", country: "in", lang: "en", hl: "en-IN", gl: "IN", ceid: "IN:en" },
  { id: "jp", label: "Japan", country: "jp", lang: "ja", hl: "ja", gl: "JP", ceid: "JP:ja" },
  { id: "de", label: "Germany", country: "de", lang: "de", hl: "de", gl: "DE", ceid: "DE:de" },
  { id: "fr", label: "France", country: "fr", lang: "fr", hl: "fr", gl: "FR", ceid: "FR:fr" },
  { id: "br", label: "Brazil", country: "br", lang: "pt", hl: "pt-BR", gl: "BR", ceid: "BR:pt" },
  { id: "au", label: "Australia", country: "au", lang: "en", hl: "en-AU", gl: "AU", ceid: "AU:en" },
];

export const NEWS_POLL_MS = 10 * 60_000;

const RSS_RELAY = (url: string) =>
  `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

const googleNewsUrl = (r: NewsRegion) =>
  `https://news.google.com/rss?hl=${r.hl}&gl=${r.gl}&ceid=${r.ceid}`;

/* ── Keyed path: /api/news (Vercel function) ───────────────────── */

async function fetchKeyed(r: NewsRegion): Promise<NewsFeed | null> {
  try {
    const q = new URLSearchParams({ lang: r.lang, max: "10" });
    if (r.country) q.set("country", r.country);
    const res = await fetch(`/api/news?${q}`);
    if (!res.ok) return null; // 404 (no function in dev) or 501 (no key)
    const data = (await res.json()) as {
      configured?: boolean;
      articles?: NewsArticle[];
    };
    if (!data.configured) return null;
    return {
      configured: true,
      source: "gnews",
      regionId: r.id,
      regionLabel: r.label,
      articles: data.articles ?? [],
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/* ── Keyless path 2: GDELT (open, no key) via Vercel proxy ─────── */

async function fetchGdelt(r: NewsRegion): Promise<NewsFeed | null> {
  try {
    const q = new URLSearchParams({ source: "gdelt", max: "10" });
    if (r.country) q.set("country", r.country);
    const res = await fetch(`/api/news?${q}`);
    if (!res.ok) return null; // 404 (no function in dev) or 502 (upstream)
    const data = (await res.json()) as {
      source?: string;
      articles?: NewsArticle[];
    };
    if (data.source !== "gdelt" || !data.articles) return null;
    return {
      configured: false,
      source: "gdelt",
      regionId: r.id,
      regionLabel: r.label,
      articles: data.articles,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/* ── Keyless fallback: Google News RSS via CORS relay ──────────── */

function parseRss(xml: string): NewsArticle[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const items = Array.from(doc.querySelectorAll("item"));
  const mediaNs = "http://search.yahoo.com/mrss/";

  return items
    .map((item) => {
      const title = item.querySelector("title")?.textContent?.trim() ?? "";
      const link = item.querySelector("link")?.textContent?.trim() ?? "";
      const pubText = item.querySelector("pubDate")?.textContent?.trim() ?? "";
      const sourceTag =
        item.querySelector("source")?.textContent?.trim() ?? "";
      // Google News titles are often suffixed " - Source Name".
      const source = sourceTag || (title.includes(" - ") ? title.split(" - ").pop()!.trim() : "");
      const cleanTitle = sourceTag ? title : title.replace(/\s+-\s+[^-]+$/, "").trim();
      const media = item.getElementsByTagNameNS(mediaNs, "content")[0];
      const image = media?.getAttribute("url") ?? null;
      const ts = new Date(pubText).getTime();
      return {
        title: cleanTitle,
        description: "",
        url: link,
        image,
        source: source || null,
        publishedAt: Number.isFinite(ts) ? ts : Date.now(),
      };
    })
    .filter((a) => a.title.length > 0 && a.url.length > 0)
    .slice(0, 25);
}

async function fetchRss(r: NewsRegion): Promise<NewsFeed | null> {
  try {
    const res = await fetch(RSS_RELAY(googleNewsUrl(r)), { cache: "no-store" });
    if (!res.ok) return null;
    const xml = await res.text();
    const articles = parseRss(xml);
    if (articles.length === 0) return null;
    return {
      configured: false,
      source: "rss",
      regionId: r.id,
      regionLabel: r.label,
      articles,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/* ── Entry point ────────────────────────────────────────────────── */

export async function fetchNewsFeed(regionId: string): Promise<NewsFeed> {
  const region =
    NEWS_REGIONS.find((r) => r.id === regionId) ?? NEWS_REGIONS[0];

  const keyed = await fetchKeyed(region);
  if (keyed) return keyed;

  const gdelt = await fetchGdelt(region);
  if (gdelt) return gdelt;

  const rss = await fetchRss(region);
  if (rss) return rss;

  throw new Error(`News feed unreachable (${region.label})`);
}
