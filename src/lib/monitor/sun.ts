/**
 * Low-precision solar geometry (NOAA Solar Calculator equations, ~0.01° accuracy).
 * Used for the day/night terminator on the globe and live sun altitude/azimuth
 * at any probed point. No network involved — pure astronomy.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function julianDate(d: Date): number {
  return d.getTime() / 86_400_000 + 2440587.5;
}

/** Geocentric ecliptic longitude, obliquity, solar declination, right ascension. */
function solarCoords(d: Date): {
  decl: number; // radians
  ra: number; // radians
} {
  const jd = julianDate(d);
  const n = jd - 2451545.0; // days since J2000.0

  const L = ((280.46 + 0.9856474 * n) % 360) * DEG; // mean longitude
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG; // mean anomaly
  const lambda = (L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG) % (2 * Math.PI); // ecliptic longitude
  const eps = 23.439 * DEG; // mean obliquity

  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  return { decl, ra };
}

function gmstDeg(d: Date): number {
  const jd = julianDate(d);
  return (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360;
}

export interface SubSolarPoint {
  lat: number;
  lng: number;
}

/** Latitude/longitude on Earth where the sun is directly overhead right now. */
export function subSolarPoint(d: Date): SubSolarPoint {
  const { decl, ra } = solarCoords(d);
  const gmst = gmstDeg(d) * DEG;
  let lng = (ra - gmst) * RAD;
  // Normalize to [-180, 180]
  lng = ((lng + 540) % 360) - 180;
  return { lat: decl * RAD, lng };
}

export interface TerminatorPoint {
  lat: number;
  lng: number;
}

/**
 * Day/night boundary curve (solar zenith = 90°), traced by sampling the local
 * hour angle so near-vertical segments (equinox) render correctly.
 * lat(H) = atan(-cos H / tan δ), lng(H) = subsolar_lng + H.
 */
export function terminatorCurve(d: Date, stepDeg = 2): TerminatorPoint[] {
  const { decl, ra } = solarCoords(d);
  const gmst = gmstDeg(d) * DEG;
  const tanDecl = Math.tan(decl);
  const subLng = ((ra - gmst) * RAD + 360) % 360; // 0..360
  const points: TerminatorPoint[] = [];

  for (let h = 0; h <= 360; h += stepDeg) {
    const hRad = h * DEG;
    const lat = Math.atan(-Math.cos(hRad) / tanDecl) * RAD;
    let lng = (subLng + h) % 360;
    if (lng > 180) lng -= 360;
    points.push({ lat, lng });
  }
  return points;
}

export interface SunAltAz {
  altitude: number; // degrees above horizon
  azimuth: number; // degrees from north, clockwise
}

/** Current sun altitude + azimuth at a given point (degrees). */
export function sunAltitudeAzimuth(d: Date, lat: number, lng: number): SunAltAz {
  const { decl, ra } = solarCoords(d);
  const gmst = gmstDeg(d) * DEG;
  const h = gmst + lng * DEG - ra; // local hour angle
  const phi = lat * DEG;

  const sinAlt =
    Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(h);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD;

  const cosAz =
    (Math.sin(decl) - Math.sin(phi) * Math.sin(altitude * DEG)) /
    (Math.cos(phi) * Math.cos(altitude * DEG) || 1e-9);
  const azimuth = ((Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD) + 180) % 360;
  // Morning side of the sky → mirror azimuth
  const isMorning = Math.sin(h) > 0;
  return { altitude, azimuth: isMorning ? 360 - azimuth : azimuth };
}

/** Rough compass point for a bearing, e.g. 247° → WSW. */
export function compassPoint(degrees: number): string {
  const idx = Math.round(degrees / 22.5) % 16;
  const names = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return names[idx];
}

export function fmtDaylight(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
