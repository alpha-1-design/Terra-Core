/**
 * Vercel serverless function — military aircraft proxy.
 *
 * adsb.lol's `/v2/mil` endpoint sends no CORS headers, so browsers can't read
 * it directly (the fetch succeeds, then the response is blocked from the
 * reader). This function relays the raw ADSB payload — the same `ac[]` array
 * shape that ADSBexchange uses — with permissive CORS.
 *
 * adsb.lol is run by volunteers and rate limits are dynamic, so the response
 * is cached on the Vercel CDN for 30s: the upstream is hit at most a couple of
 * times per minute per region no matter how many visitors are watching. The
 * client polls on a 60s cadence, comfortably inside that.
 *
 * Client contract:
 *   200 { ac[], total, now }   <- adsb.lol payload, passed through
 *   429 { error }              <- upstream rate limit (retry-after honored)
 *   502 { error }              <- upstream failure
 */

const MIL_URL = "https://api.adsb.lol/v2/mil";

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

export default async function handler(): Promise<Response> {
  try {
    const upstream = await fetch(MIL_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "terra-core-military-proxy",
      },
      cache: "no-store",
    });

    const raw = await upstream.text();

    if (upstream.status === 429) {
      const retryAfter = upstream.headers.get("retry-after");
      return json(
        { error: "adsb.lol rate limited" },
        429,
        retryAfter ? { "retry-after": retryAfter } : {},
      );
    }
    if (!upstream.ok) {
      return json({ error: `adsb.lol upstream ${upstream.status}` }, 502);
    }

    return new Response(raw, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    return json({ error: `adsb.lol unreachable: ${String(err)}` }, 502);
  }
}
