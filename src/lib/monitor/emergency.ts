import type { Flight, MilitaryFlight } from "./types";
import type { EmergencyContact } from "./types";

/**
 * Emergency-transponder detection, shared by the globe, map and panels.
 *
 * ICAO reserves three squawk codes for in-flight emergencies, and ADS-B
 * broadcasts a separate `emergency` state (adsb.lol surfaces it directly).
 * These are rare — usually zero aircraft worldwide — so when one appears it
 * is worth flagging loudly.
 */

const SQUAWK_ALERTS: Record<string, string> = {
  "7500": "UNLAWFUL INTERFERENCE",
  "7600": "RADIO FAILURE",
  "7700": "GENERAL EMERGENCY",
};

const EMERGENCY_FIELD: Record<string, string> = {
  general: "GENERAL EMERGENCY",
  lifeguard: "LIFEGUARD / MEDICAL",
  minfuel: "MINIMUM FUEL",
  nordo: "RADIO FAILURE",
  unlawful: "UNLAWFUL INTERFERENCE",
  downed: "AIRCRAFT DOWN",
  reserved: "RESERVED",
};

/** Human label if the aircraft is in distress, else null. */
export function emergencyLabel(
  squawk: string | null,
  emergency?: string | null,
): string | null {
  if (squawk && SQUAWK_ALERTS[squawk]) return SQUAWK_ALERTS[squawk];
  if (emergency) {
    const label = EMERGENCY_FIELD[emergency.toLowerCase()];
    if (label) return label;
  }
  return null;
}

/** Collapse civil + military tracks into a single emergency list. */
export function collectEmergencies(
  flights: Flight[],
  military: MilitaryFlight[],
): EmergencyContact[] {
  const out: EmergencyContact[] = [];

  for (const f of flights) {
    const reason = emergencyLabel(f.squawk);
    if (!reason) continue;
    out.push({
      id: f.icao24,
      callsign: f.callsign,
      kind: "civil",
      lat: f.lat,
      lng: f.lng,
      altM: f.baroAltitude,
      spdMs: f.velocity,
      squawk: f.squawk,
      reason,
    });
  }

  for (const m of military) {
    const reason = emergencyLabel(m.squawk, m.emergency);
    if (!reason) continue;
    out.push({
      id: m.icao24,
      callsign: m.callsign,
      kind: "military",
      lat: m.lat,
      lng: m.lng,
      altM: m.altM,
      spdMs: m.spdMs,
      squawk: m.squawk,
      reason,
    });
  }

  return out;
}
