/** Shared types for TERRA-CORE monitoring streams. */

export interface Flight {
  icao24: string;
  callsign: string;
  originCountry: string;
  lat: number;
  lng: number;
  baroAltitude: number | null; // meters
  geoAltitude: number | null; // meters
  velocity: number | null; // m/s
  trueTrack: number | null; // degrees
  verticalRate: number | null; // m/s
  onGround: boolean;
  lastContact: number; // unix seconds
}

export interface Quake {
  id: string;
  mag: number;
  place: string;
  time: number; // unix ms
  lat: number;
  lng: number;
  depth: number; // km
  url: string;
}

export interface IssState {
  lat: number;
  lng: number;
  altitudeKm: number;
  velocityKmH: number;
  timestamp: number;
}

export interface SpaceWeather {
  kp: number | null;
  kpTime: string | null;
  dst: number | null;
  dstTime: string | null;
}

/** Decimated NOAA OVATION aurora oval points (intensity 0..100). */
export interface AuroraPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export interface AuroraState {
  observedAt: string | null;
  forecastFor: string | null;
  maxIntensity: number;
  points: AuroraPoint[];
}

/** NOAA/NWS active weather alert for a point. */
export interface WeatherAlert {
  id: string;
  event: string;
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  headline: string;
  description: string;
  instruction: string | null;
  effective: string;
  expires: string;
  areaDesc: string;
}

export interface City {
  name: string;
  lat: number;
  lng: number;
  pop: number;
  country?: string;
}

export interface WeatherNow {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  pressure: number;
  weatherCode: number;
  isDay: boolean;
  cloudCover: number;
  precipitation: number;
}

export interface WeatherData {
  location: { name: string; lat: number; lng: number };
  current: WeatherNow;
  hourly: {
    time: string[];
    temperature: number[];
    precipProb: number[];
    weatherCode: number[];
  };
  daily: {
    time: string[];
    code: number[];
    tMax: number[];
    tMin: number[];
    precipProb: number[];
    windMax: number[];
    sunrise: string[];
    sunset: string[];
    daylightDuration: number[];
  };
  aq: { usAqi: number | null; pm25: number | null; pm10: number | null };
  timezone: string;
  updatedAt: number;
}

export interface TvChannel {
  id: string;
  name: string;
  country: string;
  logo: string | null;
  url: string;
  group?: string;
  demo?: boolean;
}

export interface GeocodeResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface RadarData {
  host: string;
  generated: number;
  frames: { time: number; path: string }[];
}

export type FocusKind = "city" | "flight" | "quake" | "iss" | "point" | "watch";

export interface FocusTarget {
  id: string;
  kind: FocusKind;
  lat: number;
  lng: number;
  label: string;
}

export type ImageryMode = "day" | "live" | "night";
