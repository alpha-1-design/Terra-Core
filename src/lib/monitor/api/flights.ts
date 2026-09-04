import { RateLimitError } from "../usePolling";
import type { Flight } from "../types";

const STATES_URL = "https://opensky-network.org/api/states/all";

/** Parse the OpenSky states array into Flight[] (shared by both sources). */
function parseStates(json: { states?: (unknown[] | null)[] }): Flight[] {
  const rows = (json.states ?? []).filter((r): r is unknown[] => !!r);

  const flights: Flight[] = [];
  for (const r of rows) {
    const icao24 = r[0] as string;
    const callsign = ((r[1] as string) ?? "").trim() || null;
    const originCountry = (r[2] as string) ?? "Unknown";
    const lng = r[5] as number | null;
    const lat = r[6] as number | null;
    if (lat === null || lng === null) continue;
    const onGround = Boolean(r[8]);
    flights.push({
      icao24,
      callsign: callsign ?? icao24.toUpperCase(),
      originCountry,
      lat,
      lng,
      baroAltitude: r[7] as number | null,
      geoAltitude: r[13] as number | null,
      velocity: r[9] as number | null,
      trueTrack: r[10] as number | null,
      verticalRate: r[11] as number | null,
      onGround,
      lastContact: (r[4] as number) ?? 0,
    });
  }
  return flights;
}

/**
 * Fetch live aircraft state vectors.
 *
 * OpenSky blocks cross-origin browsers (`Access-Control-Allow-Origin` is its
 * own origin), so production routes through the `api/flights.ts` Vercel
 * function (CDN-cached, one upstream call serves all visitors). The direct
 * endpoint is kept as a fallback for environments where CORS is open or not
 * enforced.
 */
export async function fetchFlights(): Promise<Flight[]> {
  try {
    const res = await fetch("/api/flights", { cache: "no-store" });
    if (res.status === 429) {
      throw new RateLimitError("OpenSky rate limited", 300_000);
    }
    if (!res.ok) {
      throw new Error(`Flights proxy ${res.status}`);
    }
    const json = (await res.json()) as { states?: (unknown[] | null)[] };
    if (!Array.isArray(json.states)) {
      throw new Error("Flights proxy: unexpected payload");
    }
    return parseStates(json);
  } catch {
    // Fall back to the direct OpenSky endpoint.
    const res = await fetch(STATES_URL, { cache: "no-store" });
    if (res.status === 429) {
      throw new RateLimitError("OpenSky rate limited", 300_000);
    }
    if (!res.ok) {
      throw new Error(`OpenSky ${res.status}`);
    }
    return parseStates((await res.json()) as { states?: (unknown[] | null)[] });
  }
}

export const FLIGHT_POLL_MS = 60_000;
