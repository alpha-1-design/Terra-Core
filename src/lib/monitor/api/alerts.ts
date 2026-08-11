import type { WeatherAlert } from "../types";

const ALERTS_URL = (lat: number, lng: number) =>
  `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`;

const SEVERITY_ORDER: Record<WeatherAlert["severity"], number> = {
  Extreme: 0,
  Severe: 1,
  Moderate: 2,
  Minor: 3,
  Unknown: 4,
};

interface AlertsResponse {
  features: {
    id: string;
    properties: {
      event: string;
      severity: WeatherAlert["severity"];
      headline: string;
      description: string;
      instruction: string | null;
      effective: string;
      expires: string;
      areaDesc: string;
    };
  }[];
}

/**
 * Active National Weather Service alerts near a point (US territories only —
 * the API returns an empty list elsewhere, which we render as "no active
 * alerts"). Sorted by severity, capped at 5.
 */
export async function fetchAlerts(lat: number, lng: number): Promise<WeatherAlert[]> {
  const res = await fetch(ALERTS_URL(lat, lng), {
    cache: "no-store",
    headers: { Accept: "application/geo+json" },
  });
  if (!res.ok) throw new Error(`NWS alerts ${res.status}`);

  const json = (await res.json()) as AlertsResponse;
  return (json.features ?? [])
    .map((f) => ({
      id: f.id.split("/").pop() ?? f.id,
      event: f.properties.event ?? "Unknown",
      severity: f.properties.severity ?? "Unknown",
      headline: f.properties.headline ?? "Weather alert",
      description: f.properties.description ?? "",
      instruction: f.properties.instruction ?? null,
      effective: f.properties.effective,
      expires: f.properties.expires,
      areaDesc: f.properties.areaDesc ?? "",
    }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.effective.localeCompare(b.effective),
    )
    .slice(0, 5);
}

export function severityColor(sev: WeatherAlert["severity"]): string {
  switch (sev) {
    case "Extreme":
      return "#b91c1c";
    case "Severe":
      return "#ff2e2e";
    case "Moderate":
      return "#ff4d00";
    case "Minor":
      return "#ffd400";
    default:
      return "#6b6557";
  }
}
