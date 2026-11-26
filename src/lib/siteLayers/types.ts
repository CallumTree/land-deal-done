// Site Layers v0 — the shape of what /api/site-layers returns. Shared by
// the server route (src/app/api/site-layers/route.ts) and the client
// hook (src/hooks/useSiteLayers.ts). All geometry is British National
// Grid (EPSG:27700) metres, same frame as the engine.

import type { BNGPolygon } from "@/engine/types";

export type FloodSource = "rivers" | "sea" | "surface";
export type FloodZoneNumber = 2 | 3;
export type FloodZoneId = `${FloodSource}-${FloodZoneNumber}`;

export interface FloodZoneLayer {
  id: FloodZoneId;
  source: FloodSource;
  zone: FloodZoneNumber;
  /** Share of the site's own area inside this zone, 0-100. */
  percent: number;
  areaM2: number;
  /**
   * The zone clipped to the site boundary, as polygons-with-holes:
   * each entry is [outerRing, ...holeRings]. For drawing only.
   */
  polygons: BNGPolygon[][];
  /**
   * The same area as a set of small axis-aligned rectangles that
   * fully COVER it (never under-cover). The engine's restriction checks
   * assume convex polygons (see Restriction's doc comment in
   * engine/types.ts) and a clipped flood outline almost never is, so
   * "No homes here" feeds these to the engine, not `polygons`. Slightly
   * conservative at the edges (up to one strip height), never generous.
   */
  cover: BNGPolygon[];
}

export interface SiteLayers {
  status: "ok";
  siteAreaM2: number;
  elevation: { minM: number; maxM: number };
  slope: {
    /** % of the site steeper than 1:15 (6.7%). */
    steeperThan1in15Pct: number;
    /** % of the site steeper than 1:10 (10%). */
    steeperThan1in10Pct: number;
  };
  flood: {
    /** % of the site in ANY flood zone (union across rivers, sea and surface water). */
    anyPct: number;
    zones: FloodZoneLayer[];
  };
  sources: {
    lidar: { name: string; date: string };
    flood: { name: string; date: string };
  };
}

export type SiteLayersUnavailableReason = "outside-coverage" | "too-large" | "bad-input" | "upstream-failed";

export interface SiteLayersUnavailable {
  status: "unavailable";
  reason: SiteLayersUnavailableReason;
}

export type SiteLayersResponse = SiteLayers | SiteLayersUnavailable;

/** Query-string encoding of a boundary: "e,n;e,n;..." at 0.1m. Shared so client and server agree, and so identical boundaries hit the same CDN cache entry. */
export function encodeBoundary(boundary: BNGPolygon): string {
  return boundary.map(([e, n]) => `${e.toFixed(1)},${n.toFixed(1)}`).join(";");
}

export function decodeBoundary(raw: string | null): BNGPolygon | null {
  if (!raw) return null;
  const pts = raw.split(";").map((pair) => pair.split(",").map(Number));
  if (pts.length < 3 || pts.length > 500) return null;
  for (const p of pts) {
    if (p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
    // Anywhere in the BNG grid's own valid extent.
    if (p[0] < 0 || p[0] > 700000 || p[1] < 0 || p[1] > 1300000) return null;
  }
  return pts as BNGPolygon;
}
