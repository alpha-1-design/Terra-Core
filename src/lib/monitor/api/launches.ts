import { fetchWithTimeout } from "../usePolling";
import type { Launch } from "../types";

/**
 * Upcoming orbital launches (Launch Library 2 / thespacedevs).
 *
 * The upstream API sends no CORS headers and is limited to 15 unauthenticated
 * calls/hour, so production goes through the `api/launches` Vercel function
 * (compacted + CDN-cached for 30 min). We poll on the same cadence.
 *
 * This mapper tolerates BOTH shapes it can receive: the compact rows the
 * proxy returns, and the raw LL2 launch objects (used by the direct
 * fallback, which only works where CORS is not enforced).
 */

const DIRECT_URL =
  "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=30";

interface UnknownRow {
  [key: string]: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function obj(v: unknown): UnknownRow | null {
  return v && typeof v === "object" ? (v as UnknownRow) : null;
}

function mapRow(row: unknown): Launch | null {
  const r = obj(row);
  if (!r) return null;

  const rawPad = obj(r.pad);
  const id = asString(r.id);
  const lat = asNumber(r.lat) ?? asNumber(rawPad?.latitude);
  const lng = asNumber(r.lng) ?? asNumber(rawPad?.longitude);
  if (!id || lat === null || lng === null) return null;

  const rawStatus = r.status;
  const status =
    asString(rawStatus) ??
    asString(obj(rawStatus)?.abbrev) ??
    asString(obj(rawStatus)?.name) ??
    "TBD";

  const provider =
    asString(r.provider) ??
    asString(obj(r.launch_service_provider)?.name) ??
    "Unknown";

  const pad =
    asString(r.pad) ?? asString(rawPad?.name) ?? "Unknown pad";

  const location =
    asString(r.location) ?? asString(obj(rawPad?.location)?.name) ?? "";

  return {
    id,
    name: asString(r.name) ?? "Unnamed mission",
    net: asString(r.net) ?? "",
    status,
    provider,
    pad,
    location,
    lat,
    lng,
  };
}

function parseRows(json: unknown): Launch[] {
  const rows = obj(json)?.results;
  if (!Array.isArray(rows)) return [];
  const out: Launch[] = [];
  for (const row of rows) {
    const launch = mapRow(row);
    if (launch) out.push(launch);
  }
  return out;
}

export async function fetchLaunches(): Promise<Launch[]> {
  try {
    const res = await fetchWithTimeout("/api/launches", { cache: "no-store" }, 12_000);
    if (!res.ok) throw new Error(`launches proxy ${res.status}`);
    return parseRows(await res.json());
  } catch {
    // Direct fallback for environments without the serverless function (or
    // where CORS happens to be open). Never runs on the deployed site.
    const res = await fetchWithTimeout(DIRECT_URL, { cache: "no-store" }, 20_000);
    if (!res.ok) throw new Error(`LL2 ${res.status}`);
    return parseRows(await res.json());
  }
}

/** Launch Library 2 caps unauthenticated clients at 15 calls/hour upstream,
 *  and the proxy caches for 30 min — poll in step with that. */
export const LAUNCH_POLL_MS = 30 * 60_000;
