/**
 * Vercel serverless function — live aircraft proxy.
 *
 * OpenSky Network's `states/all` endpoint sends
 * `Access-Control-Allow-Origin: https://opensky-network.org` (not `*`), so
 * browsers on any other origin — like terra-core-nu.vercel.app — fetch the
 * data successfully and are then blocked from reading it. This function
 * fetches OpenSky server-side (no CORS on server-to-server) and relays the
 * exact OpenSky JSON so the existing client parser works unchanged.
 *
 * The response is cached on the Vercel CDN for 45s, so the anonymous credit
 * quota is hit roughly once per minute per region instead of once per
 * visitor. `stale-while-revalidate` keeps stale flight data flowing during
 * an upstream hiccup.
 *
 * Client contract:
 *   200 { time, states[] }           <- OpenSky payload, passed through
 *   429 { error }                    <- upstream rate limit (retry-after honored)
 *   502 { error }                    <- upstream failure
 */

const STATES_URL = "https://opensky-network.org/api/states/all";

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export default async function handler(): Promise<Response> {
  try {
    const upstream = await fetch(STATES_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "terra-core-flights-proxy",
      },
      cache: "no-store",
    });

    const raw = await upstream.text();

    if (upstream.status === 429) {
      const retryAfter = upstream.headers.get("retry-after");
      return json(
        { error: "OpenSky rate limited" },
        429,
        retryAfter ? { "retry-after": retryAfter } : {},
      );
    }
    if (!upstream.ok) {
      const detail = raw.trim().slice(0, 160);
      return json(
        { error: detail ? `OpenSky upstream ${upstream.status}: ${detail}` : `OpenSky upstream ${upstream.status}` },
        502,
      );
    }

    return new Response(raw, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "public, s-maxage=45, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    return json({ error: `OpenSky unreachable: ${String(err)}` }, 502);
  }
}
