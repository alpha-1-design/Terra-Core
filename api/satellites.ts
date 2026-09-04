/**
 * Vercel serverless function — live satellite TLE proxy.
 *
 * Celestrak's TLE endpoints send no CORS headers, so browsers can't read
 * them directly. This function relays the Celestrak group dump (Starlink
 * constellation + ISS) with permissive CORS, cached on the Vercel CDN for
 * 5 minutes — one upstream request serves all visitors.
 *
 * Client contract:
 *   200  text/plain  — Celestrak TLE dump, passed through
 *   502  { error }   — upstream failure
 */

const TLE_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";

export default async function handler(): Promise<Response> {
  try {
    const upstream = await fetch(TLE_URL, {
      headers: { "user-agent": "terra-core-satellites-proxy" },
      cache: "no-store",
    });
    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `celestrak upstream ${upstream.status}` }),
        {
          status: 502,
          headers: { "content-type": "application/json" },
        },
      );
    }
    const text = await upstream.text();
    return new Response(text, {
      status: 200,
      headers: {
        "content-type": "text/plain",
        "access-control-allow-origin": "*",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `celestrak unreachable: ${String(err)}` }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
