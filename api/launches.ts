/**
 * Vercel serverless function — upcoming space-launch proxy.
 *
 * Launch Library 2 (thespacedevs) sends no CORS headers, so browsers can't
 * read it directly: fetch succeeds, then the response is blocked from the
 * reader. It is also free-use but rate limited to 15 unauthenticated calls
 * per hour, and `mode=list` trims out the pad coordinates we need — so this
 * function fetches the full "normal" objects, keeps only the handful of
 * fields the globe/panel render (the upstream objects are ~20 KB each once
 * agencies, programs and pad imagery are inlined), and serves that compact
 * array with permissive CORS.
 *
 * Cached on the Vercel CDN for 30 minutes (stale-while-revalidate 1h): one
 * upstream request serves every visitor in a region, comfortably inside the
 * 15/hour budget. The client polls on the same 30-minute cadence.
 *
 * Client contract:
 *   200 { count, results: CompactLaunch[] }
 *   502 { error }                          <- upstream failure
 */

const UPCOMING_URL =
  "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=30";

interface Ll2Status {
  abbrev?: string;
  name?: string;
}

interface Ll2Pad {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  location?: { name?: string } | null;
}

interface Ll2Launch {
  id?: string;
  name?: string;
  net?: string | null;
  status?: Ll2Status | null;
  launch_service_provider?: { name?: string } | null;
  pad?: Ll2Pad | null;
}

interface CompactLaunch {
  id: string;
  name: string;
  net: string;
  status: string;
  provider: string;
  pad: string;
  location: string;
  lat: number | null;
  lng: number | null;
}

function json(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

/** Trim an LL2 launch object down to what the client renders. */
function compact(l: Ll2Launch): CompactLaunch {
  const pad = l.pad ?? {};
  return {
    id: l.id ?? "",
    name: l.name ?? "Unnamed mission",
    net: l.net ?? "",
    status: l.status?.abbrev ?? l.status?.name ?? "TBD",
    provider: l.launch_service_provider?.name ?? "Unknown",
    pad: pad.name ?? "Unknown pad",
    location: pad.location?.name ?? "",
    lat: typeof pad.latitude === "number" ? pad.latitude : null,
    lng: typeof pad.longitude === "number" ? pad.longitude : null,
  };
}

export default async function handler(): Promise<Response> {
  try {
    const upstream = await fetch(UPCOMING_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "terra-core-launches-proxy",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return json({ error: `ll2 upstream ${upstream.status}` }, 502);
    }

    const payload = (await upstream.json()) as { results?: Ll2Launch[] };
    const rows = Array.isArray(payload?.results) ? payload.results : [];
    // Drop anything without a usable pad coordinate — the globe/map cannot
    // place it, and an entry the operator can never find is just noise.
    const results = rows
      .map(compact)
      .filter((r) => r.id && r.lat !== null && r.lng !== null);

    return json({ count: results.length, results }, 200, {
      "access-control-allow-origin": "*",
      "cache-control": "public, s-maxage=1800, stale-while-revalidate=3600",
    });
  } catch (err) {
    return json({ error: `ll2 unreachable: ${String(err)}` }, 502);
  }
}
