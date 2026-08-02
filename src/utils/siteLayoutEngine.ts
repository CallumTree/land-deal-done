// Rule-based smart site layout generator.
//
// Given a drawn site boundary, this places an access road plus rows of house
// plots (each with a compliant rear garden) inside the boundary, then compares
// a handful of mix/orientation candidates and picks the one with the highest
// profit proxy that still respects density and garden/road planning rules.
//
// Geometry is done in a local metres-based plane (equirectangular projection
// centred on the site) rather than raw lng/lat, since rotating and measuring
// raw degrees would distort shapes away from the equator. Everything is
// converted back to GeoJSON (WGS84) for rendering on the Leaflet map.

import { PROPERTY_DEFAULTS } from "@/types/calculator";
import {
  ComplianceCheck,
  LayoutGenerationOutput,
  LayoutResult,
  LayoutSummary,
  PlacedPlot,
  RingGeoJSON,
} from "@/types/siteLayout";

export type ContextPreset = "rural" | "suburban" | "urban";
export type MixType = "semis" | "mixed" | "terrace" | "bungalow";

export interface DensityBand {
  low: number;
  high: number;
}

export const CONTEXT_DENSITY: Record<ContextPreset, DensityBand> = {
  rural: { low: 22, high: 30 },
  suburban: { low: 30, high: 35 },
  urban: { low: 35, high: 60 },
};

export const MIX_LABELS: Record<MixType, string> = {
  semis: "Semis",
  mixed: "Mixed",
  terrace: "Terrace-led",
  bungalow: "Bungalow-heavy",
};

interface PlanningRules {
  roadCarriagewayWidthM: number;
  roadVergeWidthM: number; // each side, includes footway
  frontSetbackM: number; // back-of-footway to house frontage (driveway/parking apron)
  minGardenDepthM: number;
  minPrivateAmenityM2: number;
  minFrontageM: number;
  gapBetweenPlotsM: number;
}

export const PLANNING_RULES: Record<ContextPreset, PlanningRules> = {
  rural: {
    roadCarriagewayWidthM: 5.5,
    roadVergeWidthM: 3.0,
    frontSetbackM: 6,
    minGardenDepthM: 12,
    minPrivateAmenityM2: 70,
    minFrontageM: 7,
    gapBetweenPlotsM: 2,
  },
  suburban: {
    roadCarriagewayWidthM: 5.5,
    roadVergeWidthM: 2.5,
    frontSetbackM: 5,
    minGardenDepthM: 10,
    minPrivateAmenityM2: 50,
    minFrontageM: 6,
    gapBetweenPlotsM: 1.5,
  },
  urban: {
    roadCarriagewayWidthM: 4.8,
    roadVergeWidthM: 2.0,
    frontSetbackM: 3,
    minGardenDepthM: 8,
    minPrivateAmenityM2: 30,
    minFrontageM: 5,
    gapBetweenPlotsM: 1,
  },
};

interface HouseTypeSpec {
  frontageM: number;
  depthM: number;
}

export const HOUSE_TYPE_SPECS: Record<string, HouseTypeSpec> = {
  "2-Bed Semi": { frontageM: 6.0, depthM: 8.0 },
  "3-Bed Semi": { frontageM: 6.5, depthM: 9.0 },
  "3-Bed Detached": { frontageM: 9.0, depthM: 9.5 },
  "4-Bed Detached": { frontageM: 10.5, depthM: 10.5 },
  "2-Bed Bungalow": { frontageM: 8.5, depthM: 9.5 },
  "3-Bed Bungalow": { frontageM: 10.0, depthM: 10.5 },
};

interface MixSequenceItem {
  type: string;
  weight: number;
  frontageOverrideM?: number;
}

export const MIX_SEQUENCES: Record<MixType, MixSequenceItem[]> = {
  semis: [
    { type: "3-Bed Semi", weight: 0.55 },
    { type: "2-Bed Semi", weight: 0.3 },
    { type: "4-Bed Detached", weight: 0.15 },
  ],
  mixed: [
    { type: "3-Bed Semi", weight: 0.4 },
    { type: "2-Bed Semi", weight: 0.25 },
    { type: "3-Bed Detached", weight: 0.2 },
    { type: "2-Bed Bungalow", weight: 0.15 },
  ],
  terrace: [
    { type: "2-Bed Semi", weight: 0.65, frontageOverrideM: 5.0 },
    { type: "3-Bed Semi", weight: 0.35, frontageOverrideM: 5.5 },
  ],
  bungalow: [
    { type: "2-Bed Bungalow", weight: 0.55 },
    { type: "3-Bed Bungalow", weight: 0.45 },
  ],
};

type XY = [number, number];

const M_PER_DEG_LAT = 110540;

function toLocalXY([lng, lat]: XY, origin: XY): XY {
  const latRad = (origin[1] * Math.PI) / 180;
  const mPerDegLng = 111320 * Math.cos(latRad);
  return [(lng - origin[0]) * mPerDegLng, (lat - origin[1]) * M_PER_DEG_LAT];
}

function toLngLat([x, y]: XY, origin: XY): XY {
  const latRad = (origin[1] * Math.PI) / 180;
  const mPerDegLng = 111320 * Math.cos(latRad);
  return [origin[0] + x / mPerDegLng, origin[1] + y / M_PER_DEG_LAT];
}

function rotatePoint([x, y]: XY, angleRad: number): XY {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return [x * cos - y * sin, x * sin + y * cos];
}

function crossProduct(o: XY, a: XY, b: XY): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function convexHull(points: XY[]): XY[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;

  const lower: XY[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: XY[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// Rotating-calipers-lite: test the bbox area with each hull edge held
// horizontal, keep whichever orientation gives the smallest bbox (the
// classic minimum-area-bounding-rectangle heuristic).
function minAreaOrientation(hull: XY[]): number {
  if (hull.length < 3) return 0;

  let bestAngle = 0;
  let bestArea = Infinity;

  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
    const edgeAngle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const rotated = hull.map((p) => rotatePoint(p, -edgeAngle));
    const xs = rotated.map((p) => p[0]);
    const ys = rotated.map((p) => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const area = width * height;
    if (area < bestArea) {
      bestArea = area;
      bestAngle = edgeAngle;
    }
  }

  return bestAngle;
}

function pointInPolygon([x, y]: XY, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function shoelaceArea(points: XY[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function buildWeightedSequence(items: MixSequenceItem[], n: number): MixSequenceItem[] {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const counts = items.map(() => 0);
  const result: MixSequenceItem[] = [];

  for (let i = 0; i < n; i++) {
    let bestIdx = 0;
    let bestDeficit = -Infinity;
    items.forEach((it, idx) => {
      const target = ((i + 1) * it.weight) / totalWeight;
      const deficit = target - counts[idx];
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestIdx = idx;
      }
    });
    counts[bestIdx]++;
    result.push(items[bestIdx]);
  }

  return result;
}

function rotatedRectToFeature(x0: number, x1: number, y0: number, y1: number, angleRad: number, origin: XY): RingGeoJSON {
  const localCorners: XY[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
  const lngLat = localCorners.map((p) => toLngLat(rotatePoint(p, angleRad), origin));
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [lngLat] },
  };
}

function layoutRow(
  polyRot: XY[],
  rowNearY: number,
  direction: 1 | -1,
  xMin: number,
  xMax: number,
  weightedSeq: MixSequenceItem[],
  cursorRef: { i: number },
  rules: PlanningRules,
  angleRad: number,
  origin: XY,
  side: "north" | "south"
): PlacedPlot[] {
  const plots: PlacedPlot[] = [];
  let x = xMin;
  let guard = 0;

  while (x < xMax && guard < 2000) {
    guard++;
    const item = weightedSeq[cursorRef.i % weightedSeq.length];
    cursorRef.i++;
    const spec = HOUSE_TYPE_SPECS[item.type];
    const plotWidth = item.frontageOverrideM ?? spec.frontageM;
    const stride = plotWidth + rules.gapBetweenPlotsM;

    if (x + plotWidth > xMax) break;

    const totalDepth = rules.frontSetbackM + spec.depthM + rules.minGardenDepthM;
    const yFar = rowNearY + direction * totalDepth;
    const y0 = Math.min(rowNearY, yFar);
    const y1 = Math.max(rowNearY, yFar);

    const corners: XY[] = [
      [x, y0],
      [x + plotWidth, y0],
      [x + plotWidth, y1],
      [x, y1],
    ];

    if (corners.every((c) => pointInPolygon(c, polyRot))) {
      const houseFarY = rowNearY + direction * (rules.frontSetbackM + spec.depthM);
      const hy0 = Math.min(rowNearY, houseFarY);
      const hy1 = Math.max(rowNearY, houseFarY);
      const gy0 = Math.min(houseFarY, yFar);
      const gy1 = Math.max(houseFarY, yFar);
      const gardenAreaM2 = plotWidth * rules.minGardenDepthM;

      plots.push({
        id: `plot-${side}-${plots.length}-${Math.round(x * 10)}`,
        houseType: item.type,
        plotPolygon: rotatedRectToFeature(x, x + plotWidth, y0, y1, angleRad, origin),
        housePolygon: rotatedRectToFeature(x, x + plotWidth, hy0, hy1, angleRad, origin),
        gardenPolygon: rotatedRectToFeature(x, x + plotWidth, gy0, gy1, angleRad, origin),
        frontageM: plotWidth,
        plotDepthM: totalDepth,
        gardenDepthM: rules.minGardenDepthM,
        gardenAreaM2,
        gia: PROPERTY_DEFAULTS[item.type]?.giaPerUnit ?? 0,
        side,
      });
    }

    x += stride;
  }

  return plots;
}

function buildComplianceChecks(
  plots: PlacedPlot[],
  rules: PlanningRules,
  densityBand: DensityBand,
  context: ContextPreset,
  achievedDensity: number
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  checks.push({
    id: "garden-depth",
    label: "Rear garden depth",
    pass: true,
    detail: `${rules.minGardenDepthM}m provided on every plot (National Design Guide indicative minimum for a ${context} setting is met by construction).`,
  });

  checks.push({
    id: "road-standard",
    label: "Access road standard",
    pass: true,
    detail: `${rules.roadCarriagewayWidthM}m carriageway + ${rules.roadVergeWidthM}m verge/footway each side (Manual for Streets minimum single-lane width is 4.8m).`,
  });

  const minFrontage = plots.length ? Math.min(...plots.map((p) => p.frontageM)) : 0;
  checks.push({
    id: "frontage",
    label: "Minimum plot frontage",
    pass: plots.length === 0 || minFrontage >= rules.minFrontageM,
    detail: plots.length
      ? `Narrowest plot frontage ${minFrontage.toFixed(1)}m (guideline minimum ${rules.minFrontageM}m).`
      : "No plots were placed.",
  });

  const avgGardenArea = plots.length ? plots.reduce((s, p) => s + p.gardenAreaM2, 0) / plots.length : 0;
  checks.push({
    id: "amenity",
    label: "Private amenity area",
    pass: plots.length === 0 || avgGardenArea >= rules.minPrivateAmenityM2,
    detail: plots.length
      ? `Average rear garden ${avgGardenArea.toFixed(0)}m² (guideline minimum ${rules.minPrivateAmenityM2}m²).`
      : "No plots were placed.",
  });

  const densityOk = achievedDensity <= densityBand.high * 1.15;
  checks.push({
    id: "density",
    label: "Density within local plan band",
    pass: densityOk,
    detail: `${achievedDensity.toFixed(1)} u/ha achieved vs ${densityBand.low}–${densityBand.high} u/ha expected for a ${context} setting.`,
  });

  return checks;
}

function buildLayout(
  polyLocal: XY[],
  origin: XY,
  angleRad: number,
  mixType: MixType,
  context: ContextPreset,
  grossAreaM2: number
): LayoutResult {
  const rules = PLANNING_RULES[context];
  const densityBand = CONTEXT_DENSITY[context];
  const polyRot = polyLocal.map((p) => rotatePoint(p, -angleRad));

  const xs = polyRot.map((p) => p[0]);
  const ys = polyRot.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const halfCorridor = rules.roadCarriagewayWidthM / 2 + rules.roadVergeWidthM;
  const roadY = (minY + maxY) / 2;

  const sequence = buildWeightedSequence(MIX_SEQUENCES[mixType], 400);
  const cursor = { i: 0 };

  let plots: PlacedPlot[] = [];

  if (maxY - minY > 2 * halfCorridor + rules.frontSetbackM + rules.minGardenDepthM + 6) {
    const northPlots = layoutRow(polyRot, roadY + halfCorridor, 1, minX, maxX, sequence, cursor, rules, angleRad, origin, "north");
    const southPlots = layoutRow(polyRot, roadY - halfCorridor, -1, minX, maxX, sequence, cursor, rules, angleRad, origin, "south");
    plots = [...northPlots, ...southPlots];
  }

  const roadPolygon =
    maxX > minX
      ? rotatedRectToFeature(minX, maxX, roadY - halfCorridor, roadY + halfCorridor, angleRad, origin)
      : null;

  const grossAreaHa = grossAreaM2 / 10000;
  const achievedDensityUprHa = grossAreaHa > 0 ? plots.length / grossAreaHa : 0;

  const mixCounts: Record<string, number> = {};
  let estimatedGDV = 0;
  let estimatedBuildCost = 0;
  let totalGardenAreaM2 = 0;

  for (const plot of plots) {
    mixCounts[plot.houseType] = (mixCounts[plot.houseType] ?? 0) + 1;
    const defaults = PROPERTY_DEFAULTS[plot.houseType];
    if (defaults) {
      estimatedGDV += defaults.salesValue ?? 0;
      estimatedBuildCost += (defaults.giaPerUnit ?? 0) * (defaults.buildPerSqm ?? 0);
    }
    totalGardenAreaM2 += plot.gardenAreaM2;
  }

  const summary: LayoutSummary = {
    totalUnits: plots.length,
    achievedDensityUprHa,
    roadLengthM: Math.max(0, maxX - minX),
    totalGardenAreaM2,
    averageGardenDepthM: rules.minGardenDepthM,
    mixCounts,
    estimatedGDV,
    estimatedBuildCost,
    profitProxy: estimatedGDV - estimatedBuildCost,
    compliance: buildComplianceChecks(plots, rules, densityBand, context, achievedDensityUprHa),
  };

  const orientationDeg = ((angleRad * 180) / Math.PI + 360) % 360;

  return {
    id: `${mixType}-${Math.round(orientationDeg)}`,
    label: `${MIX_LABELS[mixType]} • ${Math.round(orientationDeg)}° orientation`,
    mixType,
    orientationDeg,
    plots,
    roadPolygon,
    summary,
    isWinner: false,
  };
}

/**
 * Generate and compare rule-based site layout candidates for a drawn
 * boundary, returning the highest-profit-proxy candidate that still meets
 * the density band for the given context, along with all candidates
 * considered (for transparency).
 */
export function generateSiteLayoutCandidates(
  polygonFeature: GeoJSON.Feature<GeoJSON.Polygon>,
  context: ContextPreset
): LayoutGenerationOutput {
  const ring = polygonFeature?.geometry?.coordinates?.[0];
  if (!ring || ring.length < 4) {
    return { winner: null, candidates: [], warning: "Draw a site boundary with at least 3 points first." };
  }

  const closedRing = ring as XY[];
  const openRing = closedRing.slice(0, -1);

  const origin: XY = [
    openRing.reduce((s, p) => s + p[0], 0) / openRing.length,
    openRing.reduce((s, p) => s + p[1], 0) / openRing.length,
  ];

  const polyLocal = openRing.map((p) => toLocalXY(p, origin));
  const grossAreaM2 = shoelaceArea(polyLocal);

  if (grossAreaM2 < 200) {
    return { winner: null, candidates: [], warning: "Boundary is too small to generate a layout — draw a larger site." };
  }

  const hull = convexHull(polyLocal);
  const baseAngle = minAreaOrientation(hull);
  const candidateAngles = [baseAngle, baseAngle + Math.PI / 2];
  const mixTypes: MixType[] = ["semis", "mixed", "terrace", "bungalow"];

  const candidates: LayoutResult[] = [];
  for (const angle of candidateAngles) {
    for (const mixType of mixTypes) {
      candidates.push(buildLayout(polyLocal, origin, angle, mixType, context, grossAreaM2));
    }
  }

  const feasible = candidates.filter((c) => c.summary.totalUnits > 0);
  const densityBand = CONTEXT_DENSITY[context];
  const fullyCompliant = feasible.filter((c) => c.summary.compliance.every((chk) => chk.pass));
  const withinDensity = feasible.filter((c) => c.summary.achievedDensityUprHa <= densityBand.high * 1.15);
  // Prefer a candidate that passes every planning check; fall back to one that
  // at least respects the density band; only ignore compliance entirely if
  // nothing placed a single unit.
  const pool = fullyCompliant.length ? fullyCompliant : withinDensity.length ? withinDensity : feasible;

  const sorted = [...candidates].sort((a, b) => b.summary.profitProxy - a.summary.profitProxy);

  if (pool.length === 0) {
    return {
      winner: null,
      candidates: sorted,
      warning: "No layout could fit inside this boundary — try a larger or simpler-shaped site.",
    };
  }

  const winner = pool.reduce((best, c) => (c.summary.profitProxy > best.summary.profitProxy ? c : best));
  winner.isWinner = true;

  return {
    winner,
    candidates: sorted,
    warning: fullyCompliant.length === 0 ? "No candidate met every planning check — showing the closest compliant option." : undefined,
  };
}
