// Flood zones for a site, from Natural Resources Wales' Flood Map for
// Planning, served by DataMapWales' public WFS (GeoServer) in EPSG:27700.
// Three layers, each split into Zone 2 and Zone 3 (Zone 2 polygons
// EXCLUDE Zone 3 within a layer — checked against real Haverfordwest
// features, overlap area 0 — so a site's Zone 2 and Zone 3 percentages
// for the same source add up rather than double-count):
//   rivers  -> inspire-nrw:NRW_FLOODZONE_RIVERS
//   sea     -> inspire-nrw:NRW_FLOODZONE_SEAS
//   surface -> inspire-nrw:NRW_FLOODZONE_SURFACE_WATER_AND_SMALL_WATERCOURSES
//
// Server-only: the WFS doesn't send CORS headers for this app's origin.
//
// TAN 15 Defended Zones (NRW_AREA_BENEFITING_FROM_FLOOD_DEFENCE) are
// not read in v0 — they're an overlay on Zone 3, not a separate zone in
// these layers, so a defended site still shows as Zone 3 here. Stated,
// not hidden: see the site-layers card's own TAN 15 note.

import polygonClipping, { type MultiPolygon, type Polygon as PcPolygon } from "polygon-clipping";
import type { BNGPolygon } from "@/engine/types";
import type { FloodSource, FloodZoneLayer, FloodZoneNumber } from "../types";

const WFS_URL = "https://datamap.gov.wales/geoserver/ows";
export const FLOOD_SOURCE_NAME = "NRW Flood Map for Planning (DataMapWales)";

const LAYERS: Record<FloodSource, string> = {
  rivers: "inspire-nrw:NRW_FLOODZONE_RIVERS",
  sea: "inspire-nrw:NRW_FLOODZONE_SEAS",
  surface: "inspire-nrw:NRW_FLOODZONE_SURFACE_WATER_AND_SMALL_WATERCOURSES",
};

/** Cover-strip height (m) for FloodZoneLayer.cover — see its doc comment. */
const COVER_STRIP_M = 2;
const MAX_FEATURES = 2000;

interface WfsFeature {
  properties: { risk?: string; pub_date?: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] } | null;
}

async function wfsGetFeature(params: Record<string, string>): Promise<{ features: WfsFeature[]; numberMatched?: number }> {
  const url = new URL(WFS_URL);
  for (const [k, v] of Object.entries({ service: "WFS", version: "2.0.0", request: "GetFeature", outputFormat: "application/json", ...params })) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`WFS ${res.status}`);
  return res.json();
}

function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
}

export function multiPolygonArea(mp: MultiPolygon): number {
  let total = 0;
  for (const poly of mp) poly.forEach((ring, i) => (total += (i === 0 ? 1 : -1) * ringArea(ring)));
  return total;
}

function toMultiPolygon(g: NonNullable<WfsFeature["geometry"]>): MultiPolygon {
  return g.type === "Polygon" ? [g.coordinates as PcPolygon] : (g.coordinates as MultiPolygon);
}

/** Axis-aligned rectangles that fully cover `mp`: slice into horizontal strips, take each piece's x-extent, then merge vertically adjacent strips with overlapping extents. */
export function coverRectangles(mp: MultiPolygon): BNGPolygon[] {
  if (mp.length === 0) return [];
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const poly of mp) for (const [x, y] of poly[0]) {
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  }
  type Run = { x0: number; x1: number; y0: number; y1: number };
  const done: Run[] = [];
  let open: Run[] = [];
  for (let y0 = Math.floor(minY); y0 < maxY; y0 += COVER_STRIP_M) {
    const y1 = y0 + COVER_STRIP_M;
    const strip: PcPolygon = [[[minX - 1, y0], [maxX + 1, y0], [maxX + 1, y1], [minX - 1, y1], [minX - 1, y0]]];
    const pieces = polygonClipping.intersection(mp, strip);
    const spans = pieces
      // Keep every non-empty piece: dropping "slivers" here once left a
      // strip corner poking into the next row uncovered (up to ~0.01m²,
      // found by scripts/report-flood-cover.ts). Cover must never miss.
      .filter((p) => ringArea(p[0]) > 0)
      .map((p) => {
        let a = Infinity, b = -Infinity;
        for (const [x] of p[0]) { a = Math.min(a, x); b = Math.max(b, x); }
        return [a, b] as [number, number];
      });
    const nextOpen: Run[] = [];
    for (const [a, b] of spans) {
      // Extend an open run from the strip below if this span overlaps it
      // closely (within 1m each side) — keeps the rectangle count low
      // without letting a merged rectangle balloon past the real shape.
      const i = open.findIndex((r) => Math.abs(r.x0 - a) <= 1 && Math.abs(r.x1 - b) <= 1);
      if (i >= 0) {
        const r = open.splice(i, 1)[0];
        nextOpen.push({ x0: Math.min(r.x0, a), x1: Math.max(r.x1, b), y0: r.y0, y1 });
      } else {
        nextOpen.push({ x0: a, x1: b, y0, y1 });
      }
    }
    done.push(...open);
    open = nextOpen;
  }
  done.push(...open);
  return done.map(({ x0, x1, y0, y1 }) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as BNGPolygon);
}

export interface FloodResult {
  zones: FloodZoneLayer[];
  anyPct: number;
  sourceDate: string;
}

/** The dataset's own most recent publish date — a cheap one-row query, so a site with no flood features at all still gets an honest date. */
async function latestPubDate(): Promise<string> {
  const results = await Promise.all(
    Object.values(LAYERS).map((typeNames) =>
      wfsGetFeature({ typeNames, count: "1", propertyName: "pub_date", sortBy: "pub_date D" })
        .then((r) => r.features[0]?.properties.pub_date ?? "")
        .catch(() => "")
    )
  );
  return results.map((d) => d.slice(0, 10)).sort().at(-1) ?? "";
}

export async function analyseFlood(boundary: BNGPolygon): Promise<FloodResult> {
  const site: PcPolygon = [[...boundary, boundary[0]] as [number, number][]];
  const siteArea = ringArea(site[0]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of boundary) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const bbox = `${minX},${minY},${maxX},${maxY},EPSG:27700`;

  const [perSource, sourceDate] = await Promise.all([
    Promise.all(
      (Object.keys(LAYERS) as FloodSource[]).map(async (source) => {
        const fc = await wfsGetFeature({ typeNames: LAYERS[source], srsName: "EPSG:27700", bbox, count: String(MAX_FEATURES) });
        if ((fc.numberMatched ?? 0) > MAX_FEATURES) throw new Error(`Too many ${source} flood features for one site`);
        return { source, features: fc.features };
      })
    ),
    latestPubDate(),
  ]);

  const zones: FloodZoneLayer[] = [];
  const allClipped: MultiPolygon[] = [];
  for (const { source, features } of perSource) {
    for (const zone of [3, 2] as FloodZoneNumber[]) {
      const clippedPieces: MultiPolygon[] = [];
      for (const f of features) {
        if (!f.geometry || !f.properties.risk?.endsWith(String(zone))) continue;
        const clipped = polygonClipping.intersection(site, toMultiPolygon(f.geometry));
        if (clipped.length) clippedPieces.push(clipped);
      }
      if (clippedPieces.length === 0) continue;
      const merged = clippedPieces.length === 1 ? clippedPieces[0] : polygonClipping.union(clippedPieces[0], ...clippedPieces.slice(1));
      const areaM2 = multiPolygonArea(merged);
      if (areaM2 < 0.5) continue; // slivers along a shared edge, not real land
      allClipped.push(merged);
      zones.push({
        id: `${source}-${zone}`,
        source,
        zone,
        areaM2,
        percent: (areaM2 / siteArea) * 100,
        polygons: merged.map((poly) => poly.map((ring) => ring.slice(0, -1) as BNGPolygon)),
        cover: coverRectangles(merged),
      });
    }
  }

  const union = allClipped.length === 0 ? [] : allClipped.length === 1 ? allClipped[0] : polygonClipping.union(allClipped[0], ...allClipped.slice(1));
  return { zones, anyPct: (multiPolygonArea(union) / siteArea) * 100, sourceDate };
}
