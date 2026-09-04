/** NASA GIBS GOES ABI Fire Temperature overlays (Americas).
 *
 *  Raster PNG tile layers, keyless. GOES-East covers the Atlantic half of
 *  the Americas, GOES-West the Pacific half — together they show live
 *  wildfire heat from orbit. Refresh daily.
 */

export interface FireLayerDef {
  id: string;
  name: string;
  region: string;
  layer: string;
}

export const GOES_FIRE_LAYERS: FireLayerDef[] = [
  {
    id: "goes-east",
    name: "GOES-East Fire Temp",
    region: "Americas · Atlantic half",
    layer: "GOES-East_ABI_FireTemp",
  },
  {
    id: "goes-west",
    name: "GOES-West Fire Temp",
    region: "Americas · Pacific half",
    layer: "GOES-West_ABI_FireTemp",
  },
];

/** Tile URL for a GOES fire layer on a given UTC date. */
export function goesFireTileUrl(def: FireLayerDef, date: string) {
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${def.layer}` +
    `/default/${date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`
  );
}

/** Best fire date: yesterday before ~08:00 UTC (the product can lag a few
 *  hours), otherwise today. */
export function latestFireDate(now = new Date()): string {
  if (now.getUTCHours() < 8) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return now.toISOString().slice(0, 10);
}
