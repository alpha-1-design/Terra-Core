import type { City, GeocodeResult } from "../types";

/** Free-form place search via Nominatim (rate: ≤1 req/s, used on demand). */
export async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "6",
    addressdetails: "0",
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
    name: string;
  }[];
  return json.map((r) => ({
    name: r.name || r.display_name.split(",")[0],
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
}

/**
 * Reverse-geocode a coordinate to a readable place name (used when probing
 * the globe, so a click becomes "Paris, France" instead of a bare POINT).
 * Returns null when the lookup fails or lands in open water.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    zoom: "10",
    addressdetails: "0",
  });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { display_name?: string; name?: string };
    if (!json.display_name) return null;
    // Trim to the most useful slice: place, admin area, country.
    const parts = json.display_name.split(",").map((s) => s.trim());
    if (parts.length <= 2) return json.display_name;
    return parts.slice(0, 3).join(", ");
  } catch {
    return null;
  }
}

/** Quick-jump anchor cities (real coordinates & populations). */
export const MAJOR_CITIES: City[] = [
  { name: "Tokyo", lat: 35.6762, lng: 139.6503, pop: 37_274_000, country: "JP" },
  { name: "Delhi", lat: 28.6139, lng: 77.209, pop: 32_941_000, country: "IN" },
  { name: "Shanghai", lat: 31.2304, lng: 121.4737, pop: 29_210_000, country: "CN" },
  { name: "São Paulo", lat: -23.5505, lng: -46.6333, pop: 22_620_000, country: "BR" },
  { name: "Mexico City", lat: 19.4326, lng: -99.1332, pop: 22_280_000, country: "MX" },
  { name: "Cairo", lat: 30.0444, lng: 31.2357, pop: 22_183_000, country: "EG" },
  { name: "New York", lat: 40.7128, lng: -74.006, pop: 18_820_000, country: "US" },
  { name: "Mumbai", lat: 19.076, lng: 72.8777, pop: 21_357_000, country: "IN" },
  { name: "Beijing", lat: 39.9042, lng: 116.4074, pop: 21_766_000, country: "CN" },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, pop: 12_534_000, country: "US" },
  { name: "London", lat: 51.5072, lng: -0.1276, pop: 9_540_000, country: "GB" },
  { name: "Paris", lat: 48.8566, lng: 2.3522, pop: 11_142_000, country: "FR" },
  { name: "Moscow", lat: 55.7558, lng: 37.6173, pop: 12_640_000, country: "RU" },
  { name: "Istanbul", lat: 41.0082, lng: 28.9784, pop: 15_636_000, country: "TR" },
  { name: "Jakarta", lat: -6.2088, lng: 106.8456, pop: 11_075_000, country: "ID" },
  { name: "Lagos", lat: 6.5244, lng: 3.3792, pop: 15_388_000, country: "NG" },
  { name: "Sydney", lat: -33.8688, lng: 151.2093, pop: 5_297_000, country: "AU" },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, pop: 5_866_000, country: "SG" },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, pop: 3_679_000, country: "AE" },
  { name: "Cape Town", lat: -33.9249, lng: 18.4241, pop: 4_710_000, country: "ZA" },
  { name: "Rio de Janeiro", lat: -22.9068, lng: -43.1729, pop: 13_728_000, country: "BR" },
  { name: "Berlin", lat: 52.52, lng: 13.405, pop: 3_769_000, country: "DE" },
  { name: "Toronto", lat: 43.6532, lng: -79.3832, pop: 6_254_000, country: "CA" },
  { name: "Nairobi", lat: -1.2921, lng: 36.8219, pop: 5_119_000, country: "KE" },
  { name: "Anchorage", lat: 61.2181, lng: -149.9003, pop: 288_000, country: "US" },
  { name: "Reykjavík", lat: 64.1466, lng: -21.9426, pop: 140_000, country: "IS" },
  { name: "Wellington", lat: -41.2866, lng: 174.7756, pop: 215_000, country: "NZ" },
  { name: "Honolulu", lat: 21.3069, lng: -157.8583, pop: 1_016_000, country: "US" },
];
