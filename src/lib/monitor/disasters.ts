import type { Disaster, DisasterKind } from "./types";

/**
 * Presentational helpers for the GDACS disaster-alert layer. Kept out of
 * `types.ts` (types only) so the globe, map and panel all render the same
 * labels and colours.
 */

/** Human label per hazard code. */
export const DISASTER_LABEL: Record<DisasterKind, string> = {
  EQ: "EARTHQUAKE",
  TC: "TROPICAL CYCLONE",
  FL: "FLOOD",
  VO: "VOLCANO",
  WF: "WILDFIRE",
};

/** Single-character glyph per hazard code (map pins / list icons). */
export const DISASTER_GLYPH: Record<DisasterKind, string> = {
  EQ: "≈",
  TC: "◉",
  FL: "≋",
  VO: "▲",
  WF: "✸",
};

/** GDACS alert level → hex colour, shared by globe points and map markers. */
export function alertColor(level: Disaster["alertLevel"]): string {
  if (level === "Red") return "#ff2e2e";
  if (level === "Orange") return "#ff9d00";
  return "#00a651";
}

/** Sort key: Red first, then Orange, Green, then by descending alert score. */
export function disasterRank(d: Disaster): number {
  const level = d.alertLevel === "Red" ? 0 : d.alertLevel === "Orange" ? 1 : 2;
  return level * 1000 - d.alertScore;
}

/** "M 6.4 · 42 km" / "112 kt · Cat 3" style severity line. */
export function disasterSeverity(d: Disaster): string {
  if (d.severity !== null) {
    return `${d.severity}${d.severityUnit ? ` ${d.severityUnit}` : ""}`;
  }
  return d.severityText || "—";
}
