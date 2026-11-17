// Shared OS Data Hub tile-source config — the single place that reads
// NEXT_PUBLIC_OS_API_KEY and builds the tile URL, so the 2D basemap
// (OsMapBasemap.tsx) and the 3D ground-texture capture
// (scene3d/captureGroundTexture.ts) can never drift onto a different
// key/layer/URL shape. See OsMapBasemap.tsx's original header comment
// (preserved there) for the full sourcing notes on the endpoint shape,
// layer name and _3857-tiles-into-a-_27700-view projection choice —
// this file only holds the values themselves.

export const OS_LAYER = "Light_3857";
export const OS_TILE_SOURCE_EPSG = "EPSG:3857";

// Standard EPSG:27700 (OSGB36 British National Grid) proj4 definition —
// a fixed, decades-old, publicly published transform, not something
// specific to OS's API.
export const EPSG_27700_PROJ4 =
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";

/** Builds the real OS tile URL template, or null if NEXT_PUBLIC_OS_API_KEY isn't set. Never log or print the returned string — it carries the key as a query param. */
export function buildOsTileUrlTemplate(): string | null {
  const apiKey = process.env.NEXT_PUBLIC_OS_API_KEY;
  if (!apiKey) return null;
  return `https://api.os.uk/maps/raster/v1/zxy/${OS_LAYER}/{z}/{x}/{y}.png?key=${apiKey}`;
}

/** Registers the EPSG:27700 projection with proj4/OpenLayers, idempotently — safe to call from multiple independent OL map instances (2D + the 3D ground-texture capture's own throwaway map). */
export async function ensureBngProjectionRegistered(): Promise<void> {
  const [proj4Module, { register }, { get: getProjection }] = await Promise.all([
    import("proj4"),
    import("ol/proj/proj4"),
    import("ol/proj"),
  ]);
  if (getProjection("EPSG:27700")) return;
  const proj4lib = proj4Module.default;
  proj4lib.defs("EPSG:27700", EPSG_27700_PROJ4);
  register(proj4lib);
}
