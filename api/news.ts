/**
 * Vercel serverless function — news proxy.
 *
 * Two modes, routed by the `source` query parameter:
 *
 * 1. source=gnews  (keyed) — proxies GNews top headlines. The API key is read
 *    server-side (Vercel → Settings → Environment Variables → NEWS_API_KEY) so
 *    it never ships in the client bundle. Response cached on the Vercel CDN
 *    (s-maxage) so the free-tier quota is hit once per region per 10 minutes.
 *
 * 2. source=gdelt  (keyless) — proxies the GDELT Project DOC 2.0 API (the
 *    free, open, no-key global news database — the same source Core-X used).
 *    GDELT rate-limits every IP to ~1 request / 5s and only sets CORS on
 *    success responses, so browser-direct calls are unreliable; proxying
 *    through this function + the Vercel CDN means ONE upstream request per
 *    region per cache window serves every visitor. No key required.
 *
 * Client contract:
 *   200 { configured, source, total, articles[] }
 *   501 { configured: false, error }   <- gnews mode, key not set
 *   502 { configured, source, error }  <- upstream failure
 */

const GN_BASE = "https://gnews.io/api/v4/top-headlines";
const GD_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

interface GNewsArticle {
  title: string;
  description: string | null;
  url: string;
  image: string | null;
  publishedAt: string;
  source: { name: string; url: string } | null;
}

interface GNewsResponse {
  totalArticles?: number;
  articles?: GNewsArticle[];
  errors?: string[];
}

/* GDELT JSONFeed 1.0 shape (mode=artlist&format=jsonfeed) */
interface GdeltItem {
  id?: string;
  url?: string;
  title?: string;
  content_text?: string;
  summary?: string;
  image?: string;
  date_published?: string;
  authors?: { name?: string; url?: string }[];
}

interface GdeltFeed {
  items?: GdeltItem[];
}

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/* ── Mode 1: GNews (keyed) ─────────────────────────────────────── */

async function gnews(request: Request): Promise<Response> {
  const key = process.env.NEWS_API_KEY;
  const url = new URL(request.url);
  const country = url.searchParams.get("country") ?? "";
  const lang = url.searchParams.get("lang") ?? "en";
  const max = url.searchParams.get("max") ?? "10";

  if (!key) {
    return json(
      {
        configured: false,
        source: "gnews",
        articles: [],
        error:
          "NEWS_API_KEY is not configured. Add it under Vercel → Settings → Environment Variables.",
      },
      501,
    );
  }

  const params = new URLSearchParams({ token: key, lang, max });
  if (country) params.set("country", country);

  try {
    const upstream = await fetch(`${GN_BASE}?${params}`, {
      headers: { accept: "application/json" },
    });
    const data = (await upstream.json()) as GNewsResponse;

    if (!upstream.ok) {
      return json(
        {
          configured: true,
          source: "gnews",
          articles: [],
          error: data.errors?.[0] ?? `GNews upstream ${upstream.status}`,
        },
        502,
      );
    }

    const articles = (data.articles ?? []).map((a) => ({
      title: a.title,
      description: a.description ?? "",
      url: a.url,
      image: a.image ?? null,
      source: a.source?.name ?? null,
      publishedAt: new Date(a.publishedAt).getTime() || Date.now(),
    }));

    return json(
      {
        configured: true,
        source: "gnews",
        total: data.totalArticles ?? articles.length,
        articles,
      },
      200,
      { "cache-control": "public, s-maxage=600, stale-while-revalidate=120" },
    );
  } catch (err) {
    return json(
      { configured: true, source: "gnews", articles: [], error: String(err) },
      502,
    );
  }
}

/* ── Mode 2: GDELT (keyless) ───────────────────────────────────── */

async function gdelt(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const country = (url.searchParams.get("country") ?? "").toUpperCase();
  const max = url.searchParams.get("max") ?? "10";

  // Region feed: sourcecountry:XX (GDELT operator). World: empty query —
  // GDELT returns the most recent global coverage within the timespan.
  const query = country ? `sourcecountry:${country}` : "";

  const params = new URLSearchParams({
    query,
    mode: "artlist",
    maxrecords: max,
    timespan: "1d",
    sort: "datedesc",
    format: "jsonfeed",
  });

  try {
    const upstream = await fetch(`${GD_BASE}?${params}`, {
      headers: { accept: "application/json" },
    });
    const raw = await upstream.text();

    if (!upstream.ok) {
      const detail = raw.trim().slice(0, 160);
      return json(
        {
          configured: false,
          source: "gdelt",
          articles: [],
          error: detail
            ? `GDELT upstream ${upstream.status}: ${detail}`
            : `GDELT upstream ${upstream.status}`,
        },
        502,
      );
    }

    const data = JSON.parse(raw) as GdeltFeed;

    const articles = (data.items ?? [])
      .map((item) => {
        const href = item.url ?? item.id ?? "";
        return {
          title: item.title ?? "",
          description: item.content_text ?? item.summary ?? "",
          url: href,
          image: item.image ?? null,
          source: (item.authors?.[0]?.name ?? hostOf(href)) || null,
          publishedAt:
            (item.date_published ? Date.parse(item.date_published) : NaN) || Date.now(),
        };
      })
      .filter((a) => a.title.length > 0 && a.url.length > 0)
      .slice(0, Number(max) || 10);

    return json(
      {
        configured: false, // no key required
        source: "gdelt",
        total: articles.length,
        articles,
      },
      200,
      { "cache-control": "public, s-maxage=300, stale-while-revalidate=60" },
    );
  } catch (err) {
    return json(
      { configured: false, source: "gdelt", articles: [], error: String(err) },
      502,
    );
  }
}

export default async function handler(request: Request): Promise<Response> {
  const source = new URL(request.url).searchParams.get("source") ?? "gnews";
  return source === "gdelt" ? gdelt(request) : gnews(request);
}
