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

import {
  ComplianceCheck,
  LayoutGenerationOutput,
  LayoutResult,
  LayoutSummary,
  PlacedPlot,
  RingGeoJSON,
} from "@/types/siteLayout";
import {
  BuildSpec,
  HOUSE_TYPE_MAP,
  deriveFootprint,
  garageWidthFor,
  getUnitEconomics,
} from "@/utils/houseTypeLibrary";
import { XY, toLocalXY, toLngLat, rotatePoint, pointInPolygon } from "@/utils/geo";
import { FrontageInfo } from "@/utils/roadNetwork";

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

interface MixSequenceItem {
  type: string;
  weight: number;
  frontageOverrideM?: number; // used by terrace-style narrow-frontage variants only
}

export const MIX_SEQUENCES: Record<MixType, MixSequenceItem[]> = {
  semis: [
    { type: "3-Bed Semi", weight: 0.3 },
    { type: "3-Bed Semi with Garage", weight: 0.25 },
    { type: "2-Bed Semi", weight: 0.2 },
    { type: "4-Bed Detached", weight: 0.15 },
    { type: "4-Bed Detached Executive", weight: 0.1 },
  ],
  mixed: [
    { type: "3-Bed Semi", weight: 0.25 },
    { type: "2-Bed Semi", weight: 0.15 },
    { type: "3-Bed Semi with Garage", weight: 0.15 },
    { type: "3-Bed Detached", weight: 0.15 },
    { type: "4-Bed Detached", weight: 0.1 },
    { type: "2-Bed Bungalow", weight: 0.1 },
    { type: "1-Bed Bungalow", weight: 0.1 },
  ],
  terrace: [
    { type: "2-Bed Semi", weight: 0.55, frontageOverrideM: 5.0 },
    { type: "3-Bed Semi", weight: 0.3, frontageOverrideM: 5.5 },
    { type: "1-Bed Bungalow", weight: 0.15, frontageOverrideM: 5.5 },
  ],
  bungalow: [
    { type: "2-Bed Bungalow", weight: 0.3 },
    { type: "1-Bed Bungalow", weight: 0.15 },
    { type: "3-Bed Bungalow", weight: 0.2 },
    { type: "2-Bed Bungalow with Garage", weight: 0.2 },
    { type: "3-Bed Bungalow with Garage", weight: 0.15 },
  ],
};

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
    const def = HOUSE_TYPE_MAP[item.type];
    const footprint = deriveFootprint(def);
    const garageWidthM = garageWidthFor(def);
    const houseFootprintWidthM = item.frontageOverrideM ?? footprint.frontageM;
    const plotWidth = houseFootprintWidthM + garageWidthM;
    const stride = plotWidth + rules.gapBetweenPlotsM;

    if (x + plotWidth > xMax) break;

    const frontSetbackM = rules.frontSetbackM + (def.driveBonusM ?? 0);
    const gardenDepthM = rules.minGardenDepthM + (def.gardenBonusM ?? 0);
    const totalDepth = frontSetbackM + footprint.depthM + gardenDepthM;
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
      const houseFarY = rowNearY + direction * (frontSetbackM + footprint.depthM);
      const hy0 = Math.min(rowNearY, houseFarY);
      const hy1 = Math.max(rowNearY, houseFarY);
      const gy0 = Math.min(houseFarY, yFar);
      const gy1 = Math.max(houseFarY, yFar);
      const gardenAreaM2 = plotWidth * gardenDepthM;

      plots.push({
        id: `plot-${side}-${plots.length}-${Math.round(x * 10)}`,
        houseType: item.type,
        plotPolygon: rotatedRectToFeature(x, x + plotWidth, y0, y1, angleRad, origin),
        housePolygon: rotatedRectToFeature(x, x + houseFootprintWidthM, hy0, hy1, angleRad, origin),
        gardenPolygon: rotatedRectToFeature(x, x + plotWidth, gy0, gy1, angleRad, origin),
        frontageM: plotWidth,
        plotDepthM: totalDepth,
        gardenDepthM,
        gardenAreaM2,
        gia: def.gia,
        side,
      });
    }

    x += stride;
  }

  return plots;
}

const HIGHWAY_TYPE_LABELS: Record<string, string> = {
  primary: "A-road",
  secondary: "B-road",
  tertiary: "local distributor road",
  unclassified: "unclassified road",
  residential: "residential street",
  living_street: "living street",
  service: "service road",
};

function buildComplianceChecks(
  plots: PlacedPlot[],
  rules: PlanningRules,
  densityBand: DensityBand,
  context: ContextPreset,
  achievedDensity: number,
  entrance?: FrontageInfo | null
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  checks.push(
    entrance
      ? {
          id: "highway-access",
          label: "Connects to an existing public highway",
          pass: true,
          detail: `Access road joins ${entrance.roadName ? `"${entrance.roadName}"` : "the adjacent highway"} (${
            HIGHWAY_TYPE_LABELS[entrance.highwayType] ?? entrance.highwayType
          }, ${entrance.distanceToRoadM.toFixed(0)}m from the boundary) at a single point, set back for a visibility splay.`,
        }
      : {
          id: "highway-access",
          label: "Connects to an existing public highway",
          pass: false,
          detail: "No adjacent public highway could be verified from mapping data — this layout's road position is geometry-only and does not represent a confirmed site access.",
        }
  );

  const minGardenDepth = plots.length ? Math.min(...plots.map((p) => p.gardenDepthM)) : rules.minGardenDepthM;
  checks.push({
    id: "garden-depth",
    label: "Rear garden depth",
    pass: true,
    detail: `${minGardenDepth.toFixed(1)}m+ provided on every plot (National Design Guide indicative minimum for a ${context} setting is ${rules.minGardenDepthM}m, met by construction).`,
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

// Visibility splay / sightline clearance at the mouth of a new junction —
// no plot should sit right at the point where the estate road meets the
// existing highway.
const JUNCTION_CLEARANCE_M = 12;

export type RoadTopology = "straight-in" | "parallel" | "geometric";

function buildLayout(
  polyLocal: XY[],
  origin: XY,
  angleRad: number,
  mixType: MixType,
  context: ContextPreset,
  grossAreaM2: number,
  region: string | undefined,
  buildSpec: BuildSpec,
  entrance: FrontageInfo | null,
  topology: RoadTopology
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

  let roadY = (minY + maxY) / 2;
  let rowXMin = minX;
  let rowXMax = maxX;
  const roadPolygons: RingGeoJSON[] = [];

  if (entrance && topology === "straight-in") {
    // Road runs perpendicular to the frontage, straight into the site from
    // the real entry point — its cross-position follows where the entrance
    // actually sits (clamped to stay inside the boundary) rather than
    // always sitting dead-centre. Plots are kept clear of the junction
    // mouth on whichever end the entrance falls on.
    const entryRot = rotatePoint(entrance.entryPointLocal, -angleRad);
    const margin = halfCorridor + 3;
    if (maxY - minY > 2 * margin) {
      roadY = Math.min(Math.max(entryRot[1], minY + margin), maxY - margin);
    }
    const distToMin = entryRot[0] - minX;
    const distToMax = maxX - entryRot[0];
    if (distToMin <= distToMax) {
      rowXMin = minX + JUNCTION_CLEARANCE_M;
    } else {
      rowXMax = maxX - JUNCTION_CLEARANCE_M;
    }
    if (maxX > minX) {
      roadPolygons.push(rotatedRectToFeature(minX, maxX, roadY - halfCorridor, roadY + halfCorridor, angleRad, origin));
    }
  } else if (entrance && topology === "parallel") {
    // Road runs parallel to the frontage (better for a wide/shallow site,
    // where a single straight-in spine would leave most of the width
    // unserved), fed by a short perpendicular stub from the real entry
    // point — so the estate road still genuinely joins the highway at one
    // point rather than floating alongside it with no connection.
    roadY = (minY + maxY) / 2;
    const entryRot = rotatePoint(entrance.entryPointLocal, -angleRad);
    const yFrontage = Math.abs(entryRot[1] - minY) <= Math.abs(entryRot[1] - maxY) ? minY : maxY;
    const spineNearEdge = yFrontage < roadY ? roadY - halfCorridor : roadY + halfCorridor;
    const stubY0 = Math.min(yFrontage, spineNearEdge);
    const stubY1 = Math.max(yFrontage, spineNearEdge);
    const stubX0 = entryRot[0] - halfCorridor;
    const stubX1 = entryRot[0] + halfCorridor;
    if (maxX > minX) {
      roadPolygons.push(rotatedRectToFeature(minX, maxX, roadY - halfCorridor, roadY + halfCorridor, angleRad, origin));
    }
    if (stubY1 > stubY0) {
      roadPolygons.push(rotatedRectToFeature(stubX0, stubX1, stubY0, stubY1, angleRad, origin));
    }
  } else if (maxX > minX) {
    roadPolygons.push(rotatedRectToFeature(minX, maxX, roadY - halfCorridor, roadY + halfCorridor, angleRad, origin));
  }

  const sequence = buildWeightedSequence(MIX_SEQUENCES[mixType], 400);
  const cursor = { i: 0 };

  let plots: PlacedPlot[] = [];

  if (maxY - minY > 2 * halfCorridor + rules.frontSetbackM + rules.minGardenDepthM + 6 && rowXMax > rowXMin) {
    const northPlots = layoutRow(polyRot, roadY + halfCorridor, 1, rowXMin, rowXMax, sequence, cursor, rules, angleRad, origin, "north");
    const southPlots = layoutRow(polyRot, roadY - halfCorridor, -1, rowXMin, rowXMax, sequence, cursor, rules, angleRad, origin, "south");
    plots = [...northPlots, ...southPlots];
  }

  const grossAreaHa = grossAreaM2 / 10000;
  const achievedDensityUprHa = grossAreaHa > 0 ? plots.length / grossAreaHa : 0;

  const mixCounts: Record<string, number> = {};
  let estimatedGDV = 0;
  let estimatedBuildCost = 0;
  let totalGardenAreaM2 = 0;

  for (const plot of plots) {
    mixCounts[plot.houseType] = (mixCounts[plot.houseType] ?? 0) + 1;
    const economics = getUnitEconomics(plot.houseType, region, buildSpec);
    estimatedGDV += economics.salesValue;
    estimatedBuildCost += economics.buildCost;
    totalGardenAreaM2 += plot.gardenAreaM2;
  }

  const averageGardenDepthM = plots.length ? plots.reduce((s, p) => s + p.gardenDepthM, 0) / plots.length : rules.minGardenDepthM;

  const summary: LayoutSummary = {
    totalUnits: plots.length,
    achievedDensityUprHa,
    roadLengthM: Math.max(0, maxX - minX),
    totalGardenAreaM2,
    averageGardenDepthM,
    mixCounts,
    estimatedGDV,
    estimatedBuildCost,
    profitProxy: estimatedGDV - estimatedBuildCost,
    compliance: buildComplianceChecks(plots, rules, densityBand, context, achievedDensityUprHa, entrance),
  };

  const orientationDeg = ((angleRad * 180) / Math.PI + 360) % 360;
  const topologyLabel = topology === "straight-in" ? "straight-in" : topology === "parallel" ? "parallel" : undefined;
  const label = entrance
    ? `${MIX_LABELS[mixType]} • from ${entrance.roadName ?? "adjacent highway"} (${topologyLabel})`
    : `${MIX_LABELS[mixType]} • ${Math.round(orientationDeg)}° orientation`;

  return {
    id: entrance ? `${mixType}-${topology}` : `${mixType}-${Math.round(orientationDeg)}`,
    label,
    mixType,
    orientationDeg,
    plots,
    roadPolygons,
    summary,
    isWinner: false,
    region,
    buildSpec,
    entrancePoint: entrance ? toLngLat(entrance.entryPointLocal, origin) : null,
    accessRoadName: entrance?.roadName,
  };
}

/**
 * Generate and compare rule-based site layout candidates for a drawn
 * boundary, returning the highest-profit-proxy candidate that still meets
 * the density band for the given context, along with all candidates
 * considered (for transparency).
 */
/**
 * The local-plane origin (ring centroid) used for all of this module's
 * geometry. Exposed so callers can project other data (e.g. nearby roads
 * for frontage detection) into the exact same coordinate frame before the
 * engine runs.
 */
export function computeOrigin(polygonFeature: GeoJSON.Feature<GeoJSON.Polygon>): XY | null {
  const ring = polygonFeature?.geometry?.coordinates?.[0] as XY[] | undefined;
  if (!ring || ring.length < 4) return null;
  const openRing = ring.slice(0, -1);
  return [
    openRing.reduce((s, p) => s + p[0], 0) / openRing.length,
    openRing.reduce((s, p) => s + p[1], 0) / openRing.length,
  ];
}

export function generateSiteLayoutCandidates(
  polygonFeature: GeoJSON.Feature<GeoJSON.Polygon>,
  context: ContextPreset,
  region?: string,
  buildSpec: BuildSpec = "medium",
  frontage?: FrontageInfo | null
): LayoutGenerationOutput {
  const ring = polygonFeature?.geometry?.coordinates?.[0];
  if (!ring || ring.length < 4) {
    return { winner: null, candidates: [], warning: "Draw a site boundary with at least 3 points first." };
  }

  const closedRing = ring as XY[];
  const openRing = closedRing.slice(0, -1);
  const origin = computeOrigin(polygonFeature)!;

  const polyLocal = openRing.map((p) => toLocalXY(p, origin));
  const grossAreaM2 = shoelaceArea(polyLocal);

  if (grossAreaM2 < 200) {
    return { winner: null, candidates: [], warning: "Boundary is too small to generate a layout — draw a larger site." };
  }

  const mixTypes: MixType[] = ["semis", "mixed", "terrace", "bungalow"];
  const candidates: LayoutResult[] = [];

  if (frontage) {
    // A genuine highway was detected: the access road has to actually join
    // it, so orientation is no longer a free geometric variable. Two real
    // topologies are compared — a spine running straight in from the entry
    // point (best for a narrow-frontage, deep site) and a spine parallel to
    // the frontage fed by a short entrance stub (best for a wide, shallow
    // site, where a single straight-in road would leave most of the width
    // unserved) — each still genuinely grounded in the detected highway.
    const straightInAngle = frontage.edgeBearingRad + Math.PI / 2;
    const parallelAngle = frontage.edgeBearingRad;
    for (const mixType of mixTypes) {
      candidates.push(buildLayout(polyLocal, origin, straightInAngle, mixType, context, grossAreaM2, region, buildSpec, frontage, "straight-in"));
      candidates.push(buildLayout(polyLocal, origin, parallelAngle, mixType, context, grossAreaM2, region, buildSpec, frontage, "parallel"));
    }
  } else {
    // No verified adjacent highway — fall back to picking an orientation
    // from the boundary shape alone (flagged as unverified via the
    // highway-access compliance check on each candidate).
    const hull = convexHull(polyLocal);
    const baseAngle = minAreaOrientation(hull);
    const candidateAngles = [baseAngle, baseAngle + Math.PI / 2];
    for (const angle of candidateAngles) {
      for (const mixType of mixTypes) {
        candidates.push(buildLayout(polyLocal, origin, angle, mixType, context, grossAreaM2, region, buildSpec, null, "geometric"));
      }
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

  let warning: string | undefined;
  if (!frontage) {
    warning = "No adjacent public highway was found near this boundary — road position is geometry-only and not a confirmed access point.";
  } else if (fullyCompliant.length === 0) {
    warning = "No candidate met every planning check — showing the closest compliant option.";
  }

  return { winner, candidates: sorted, warning };
}
