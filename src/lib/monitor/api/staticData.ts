import type { City } from "../types";

const COUNTRIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const PLACES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_populated_places_simple.geojson";

export interface GeoFeature {
  type: "Feature";
  properties: Record<string, unknown> & {
    name?: string;
    pop_max?: number;
    pop_min?: number;
    latitude?: number;
    longitude?: number;
    adm0name?: string;
  };
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

export interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

let countriesPromise: Promise<GeoCollection> | null = null;
let placesPromise: Promise<GeoCollection> | null = null;

async function fetchGeoJson(url: string): Promise<GeoCollection> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`GeoJSON ${res.status}`);
  return (await res.json()) as GeoCollection;
}

export function fetchCountriesGeo(): Promise<GeoCollection> {
  countriesPromise ??= fetchGeoJson(COUNTRIES_URL);
  return countriesPromise;
}

export function fetchPopulatedPlaces(): Promise<GeoCollection> {
  placesPromise ??= fetchGeoJson(PLACES_URL);
  return placesPromise;
}

/** Convert populated-places GeoJSON into City[] sorted by population (desc). */
export function placesToCities(fc: GeoCollection): City[] {
  const cities: City[] = [];
  for (const f of fc.features) {
    const props = f.properties;
    const pop = props.pop_max ?? 0;
    if (!pop) continue;
    const coords = f.geometry.coordinates as unknown;
    let lat: number | undefined;
    let lng: number | undefined;
    if (Array.isArray(coords) && coords.length >= 2) {
      lng = Number(coords[0]);
      lat = Number(coords[1]);
    }
    if (typeof props.latitude === "number" && typeof props.longitude === "number") {
      lat = props.latitude;
      lng = props.longitude;
    }
    if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
      continue;
    }
    cities.push({
      name: props.name ?? "Unknown",
      lat,
      lng,
      pop,
      country: props.adm0name,
    });
  }
  return cities.sort((a, b) => b.pop - a.pop);
}
