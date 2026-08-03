// Looks up real, existing public highways near a drawn site boundary (via
// OpenStreetMap/Overpass), and works out where the site's access road
// should genuinely join one — rather than the layout engine guessing an
// orientation purely from the polygon's shape with no real entrance.

import { XY, toLocalXY, distancePointToSegment } from "@/utils/geo";

export interface RoadWay {
  id: number;
  name?: string;
  highwayType: string;
  coordinates: XY[]; // [lng, lat]
}

export interface FrontageInfo {
  /** Local-XY entry point, on the site boundary, closest to the detected highway. */
  entryPointLocal: XY;
  /** Bearing (radians) of the boundary edge the entry point sits on. */
  edgeBearingRad: number;
  distanceToRoadM: number;
  roadName?: string;
  highwayType: string;
}

// Shape of the subset of the Overpass "out geom" JSON response we rely on.
interface OverpassWayElement {
  type: "way";
  id: number;
  tags?: { highway?: string; name?: string };
  geometry?: { lat: number; lon: number }[];
}
interface OverpassHighwayElement extends OverpassWayElement {
  tags: { highway: string; name?: string };
  geometry: { lat: number; lon: number }[];
}
interface OverpassResponse {
  elements?: OverpassWayElement[];
}

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

// Ways that can't realistically be a vehicular site access.
const EXCLUDED_HIGHWAY_TYPES = new Set([
  "footway",
  "cycleway",
  "path",
  "steps",
  "pedestrian",
  "track",
  "bridleway",
  "corridor",
  "proposed",
  "construction",
  "elevator",
  "razed",
]);

// Lower = more significant road; used as a tiebreaker when two roads are
// roughly equidistant from the site (prefer joining the more substantial one).
const HIGHWAY_PRIORITY: Record<string, number> = {
  motorway: 0,
  motorway_link: 0,
  trunk: 1,
  trunk_link: 1,
  primary: 2,
  primary_link: 2,
  secondary: 3,
  secondary_link: 3,
  tertiary: 4,
  tertiary_link: 4,
  unclassified: 5,
  residential: 6,
  living_street: 6,
  service: 8,
};

/** Fetch nearby highway ways from OpenStreetMap within a small buffer of the drawn polygon. */
export async function fetchNearbyRoads(
  polygonFeature: GeoJSON.Feature<GeoJSON.Polygon>,
  bufferDeg = 0.0009 // ~100m
): Promise<RoadWay[]> {
  const ring = polygonFeature?.geometry?.coordinates?.[0] as XY[] | undefined;
  if (!ring || ring.length < 3) return [];

  const lats = ring.map((p) => p[1]);
  const lngs = ring.map((p) => p[0]);
  const south = Math.min(...lats) - bufferDeg;
  const north = Math.max(...lats) + bufferDeg;
  const west = Math.min(...lngs) - bufferDeg;
  const east = Math.max(...lngs) + bufferDeg;

  const query = `[out:json][timeout:12];way["highway"](${south},${west},${north},${east});out geom;`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const data: OverpassResponse = await response.json();
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    return elements
      .filter(
        (el): el is OverpassHighwayElement =>
          el.type === "way" &&
          typeof el.tags?.highway === "string" &&
          !EXCLUDED_HIGHWAY_TYPES.has(el.tags.highway) &&
          Array.isArray(el.geometry) &&
          el.geometry.length >= 2
      )
      .map((el) => ({
        id: el.id,
        name: el.tags?.name,
        highwayType: el.tags.highway,
        coordinates: el.geometry.map((g) => [g.lon, g.lat] as XY),
      }));
  } catch (error) {
    console.warn("Nearby road lookup failed — falling back to a geometry-only layout:", error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Find where the drawn boundary genuinely meets a real highway: the
 * boundary edge closest to a detected road, and the point on that edge
 * nearest the road's centreline — the natural site access point.
 */
export function detectFrontage(
  polygonRingLocal: XY[],
  roads: RoadWay[],
  origin: XY,
  maxDistanceM = 30
): FrontageInfo | null {
  if (roads.length === 0) return null;

  const roadSegmentsLocal = roads.flatMap((road) => {
    const pts = road.coordinates.map((p) => toLocalXY(p, origin));
    const segments: { a: XY; b: XY; name?: string; highwayType: string; priority: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push({
        a: pts[i],
        b: pts[i + 1],
        name: road.name,
        highwayType: road.highwayType,
        priority: HIGHWAY_PRIORITY[road.highwayType] ?? 7,
      });
    }
    return segments;
  });
  if (roadSegmentsLocal.length === 0) return null;

  let best: FrontageInfo | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < polygonRingLocal.length; i++) {
    const edgeStart = polygonRingLocal[i];
    const edgeEnd = polygonRingLocal[(i + 1) % polygonRingLocal.length];
    const edgeBearingRad = Math.atan2(edgeEnd[1] - edgeStart[1], edgeEnd[0] - edgeStart[0]);

    // Sample along the edge, keeping clear of the corners (avoids picking an
    // entry point that's unusable once junction clearance is applied).
    const samples = 8;
    for (let s = 1; s < samples; s++) {
      const t = s / samples;
      const samplePoint: XY = [
        edgeStart[0] + (edgeEnd[0] - edgeStart[0]) * t,
        edgeStart[1] + (edgeEnd[1] - edgeStart[1]) * t,
      ];

      for (const seg of roadSegmentsLocal) {
        const dist = distancePointToSegment(samplePoint, seg.a, seg.b);
        if (dist > maxDistanceM) continue;
        const score = dist + seg.priority * 0.5;
        if (score < bestScore) {
          bestScore = score;
          best = {
            entryPointLocal: samplePoint,
            edgeBearingRad,
            distanceToRoadM: dist,
            roadName: seg.name,
            highwayType: seg.highwayType,
          };
        }
      }
    }
  }

  return best;
}
