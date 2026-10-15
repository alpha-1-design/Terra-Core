/**
 * Vercel serverless function — GDACS global disaster-alert proxy.
 *
 * GDACS (Global Disaster Alert and Coordination System, run by UN OCHA and the
 * EC Joint Research Centre) exposes a single GeoJSON FeatureCollection of
 * current global alerts — earthquakes, tropical cyclones, floods, volcanoes
 * and wildfires. It sends no CORS header, so browsers can't read it directly.
 *
 * The feed only changes a few times an hour, so it is cached on the Vercel CDN
 * for 15 minutes: one upstream call serves every visitor in a region for that
 * window.
 *
 * Client contract:
 *   200 { type: "FeatureCollection", features: [...] }  <- passed through
 *   502 { error }                                       <- upstream failure
 */

const GDACS_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,WF";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async function handler(): Promise<Response> {
  try {
    const upstream = await fetch(GDACS_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "terra-core-disaster-proxy",
      },
      cache: "no-store",
    });

    const raw = await upstream.text();

    if (!upstream.ok) {
      return json({ error: `gdacs upstream ${upstream.status}` }, 502);
    }

    return new Response(raw, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "public, s-maxage=900, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    return json({ error: `gdacs unreachable: ${String(err)}` }, 502);
  }
}
