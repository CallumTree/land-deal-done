// Independent invariant checks for the test harness — recomputed from the
// engine's OUTPUT geometry (world/BNG coordinates), not by reading the
// engine's own ComplianceCheck claims. A layout that breaks any of these
// is a hard FAIL regardless of unit count, per the brief: "no compliance
// green on a rule violation."

import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput, HouseTypeId, PlacedPlot } from "../src/engine/types";
import { geo, rules } from "../src/engine";

export interface InvariantResult {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

function fullPlotRect(p: PlacedPlot): BNGPolygon {
  return p.plotBng;
}

function roadRect(centerline: BNGPoint[], widthM: number): BNGPolygon {
  const p0 = centerline[0];
  const p1 = centerline[centerline.length - 1];
  const dir = geo.normalize(geo.sub(p1, p0));
  const normal: BNGPoint = [dir[1], -dir[0]];
  const offset = geo.scale(normal, widthM / 2);
  return [geo.add(p0, offset), geo.add(p1, offset), geo.sub(p1, offset), geo.sub(p0, offset)];
}

export function checkInvariants(
  output: EngineOutput,
  boundary: BNGPolygon,
  entrance: BNGPoint,
  inputs: EngineInputs = {}
): InvariantResult[] {
  boundary = geo.stripClosingDuplicate(boundary);
  const results: InvariantResult[] = [];
  const { plots, roads } = output.layout;

  if (plots.length === 0) {
    results.push({
      id: "has-plots",
      label: "Layout produced at least one plot",
      pass: false,
      detail: "Zero plots generated — nothing further to check against.",
    });
    return results;
  }

  const road = roads[0];
  const roadPoly = road ? roadRect(road.centerlineBng, road.widthM) : null;

  // 1. All plots fully inside the boundary and clear of the boundary offset.
  const erodedBoundary = geo.offsetPolygonInward(boundary, rules.BOUNDARY_OFFSET_M);
  const erosionValid = geo.isValidOffsetResult(boundary, erodedBoundary);
  const insideBoundary =
    erosionValid && plots.every((p) => geo.convexPolygonFullyInside(fullPlotRect(p), erodedBoundary));
  results.push({
    id: "inside-boundary",
    label: "All plots inside boundary, clear of setbacks",
    pass: insideBoundary,
    detail: erosionValid
      ? insideBoundary
        ? "Every plot sits within the boundary minus its offset."
        : "At least one plot falls outside the boundary (or inside the offset no-build zone)."
      : "Independent boundary-offset recomputation was invalid — cannot confirm.",
  });

  // 2. No overlaps between plots, road and parking.
  const plotRects = plots.map(fullPlotRect);
  let overlap = false;
  outer: for (let i = 0; i < plotRects.length; i++) {
    if (roadPoly && geo.convexPolygonsOverlap(plotRects[i], roadPoly)) {
      overlap = true;
      break outer;
    }
    for (let j = i + 1; j < plotRects.length; j++) {
      if (geo.convexPolygonsOverlap(plotRects[i], plotRects[j])) {
        overlap = true;
        break outer;
      }
    }
  }
  const parkingInsideAPlot = output.layout.parkingSpacesBng.every((pt) =>
    plotRects.some((rect) => geo.pointInPolygon(pt, rect))
  );
  results.push({
    id: "no-overlaps",
    label: "No overlaps between plots, road and parking",
    pass: !overlap && parkingInsideAPlot,
    detail: overlap
      ? "At least one pair of plots/road overlap."
      : !parkingInsideAPlot
        ? "At least one parking space falls outside every plot (not independently confirmed non-overlapping)."
        : "No plot/road overlaps found; every parking space sits within a plot.",
  });

  // 3. Every plot has road frontage; road connects to the entrance.
  const frontageOk =
    roadPoly != null && plots.every((p) => geo.minDistanceBetweenPolygons(fullPlotRect(p), roadPoly) <= 1e-2);
  results.push({
    id: "frontage",
    label: "Every plot has road frontage",
    pass: frontageOk,
    detail: frontageOk ? "All plots touch the road." : "At least one plot does not touch the road.",
  });

  const roadConnectsEntrance = roadPoly != null && geo.pointInPolygon(entrance, roadPoly);
  results.push({
    id: "road-entrance",
    label: "Road connects to the entrance point",
    pass: roadConnectsEntrance,
    detail: roadConnectsEntrance ? "Entrance point lies on the road." : "Entrance point is not on the road.",
  });

  // 4. NDSS GIA, garden depth, back-to-back — recomputed from geometry, not the engine's claimed metrics.
  const ndss: Record<HouseTypeId, number> = { ...rules.NDSS_MIN_GIA_M2, ...inputs.ndssMinGiaM2 };
  const ndssOk = plots.every((p) => {
    const footprintArea = geo.area(p.footprintBng);
    const storeys = rules.STOREYS[p.houseType];
    return footprintArea * storeys >= ndss[p.houseType] - 1e-6;
  });
  results.push({
    id: "ndss",
    label: "NDSS minimum GIA",
    pass: ndssOk,
    detail: ndssOk
      ? "Every plot's footprint area × storeys meets its NDSS minimum."
      : "At least one plot's recomputed GIA is below its NDSS minimum.",
  });

  const gardenDepthRequired = inputs.minGardenDepthM ?? rules.MIN_GARDEN_DEPTH_M;
  const roadDir = road ? geo.normalize(geo.sub(road.centerlineBng[road.centerlineBng.length - 1], road.centerlineBng[0])) : [1, 0];
  const depthAxis: BNGPoint = [roadDir[1], -roadDir[0]];
  const gardenOk = plots.every((p) => {
    if (!p.gardenBng) return false;
    const projections = p.gardenBng.map((pt) => geo.dot(pt, depthAxis));
    const depth = Math.max(...projections) - Math.min(...projections);
    return depth >= gardenDepthRequired - 1e-6;
  });
  results.push({
    id: "garden-depth",
    label: `Minimum garden depth (${gardenDepthRequired}m)`,
    pass: gardenOk,
    detail: gardenOk ? "Every garden meets the minimum depth." : "At least one garden is shallower than required.",
  });

  const backToBackRequired = inputs.backToBackM ?? rules.BACK_TO_BACK_M;
  const tangentAxis = roadDir as BNGPoint;
  function rearInfo(p: PlacedPlot) {
    const garden = p.gardenBng!;
    const depthProj = garden.map((pt) => geo.dot(pt, depthAxis));
    const tangentProj = garden.map((pt) => geo.dot(pt, tangentAxis));
    const avgDepth = depthProj.reduce((s, v) => s + v, 0) / depthProj.length;
    const side = Math.sign(avgDepth) || 1;
    const rearDepthValue = side < 0 ? Math.min(...depthProj) : Math.max(...depthProj);
    const rearTangentMid = (Math.min(...tangentProj) + Math.max(...tangentProj)) / 2;
    const rearPoint = geo.add(geo.scale(depthAxis, rearDepthValue), geo.scale(tangentAxis, rearTangentMid));
    const outwardNormal = geo.scale(depthAxis, side);
    return { side, rearPoint, outwardNormal };
  }
  let facingPairFound = false;
  let minFacingDistance = Infinity;
  for (let i = 0; i < plots.length; i++) {
    for (let j = i + 1; j < plots.length; j++) {
      if (!plots[i].gardenBng || !plots[j].gardenBng) continue;
      const a = rearInfo(plots[i]);
      const b = rearInfo(plots[j]);
      if (a.side === b.side) continue;
      const d = geo.sub(b.rearPoint, a.rearPoint);
      const dNorm = geo.normalize(d);
      const facingA = geo.dot(dNorm, a.outwardNormal) > 0.7;
      const facingB = geo.dot(geo.scale(dNorm, -1), b.outwardNormal) > 0.7;
      if (facingA && facingB) {
        facingPairFound = true;
        minFacingDistance = Math.min(minFacingDistance, geo.length(d));
      }
    }
  }
  const backToBackOk = !facingPairFound || minFacingDistance >= backToBackRequired - 1e-6;
  results.push({
    id: "back-to-back",
    label: `${backToBackRequired}m back-to-back distance`,
    pass: backToBackOk,
    detail: facingPairFound
      ? `Closest facing pair: ${minFacingDistance.toFixed(1)}m (independently recomputed).`
      : "No two plots face each other in this layout — nothing to violate (a real limitation of v0's single-ribbon topology, not proof the rule would hold for a denser one).",
  });

  // 5. No compliance "green" on a rule violation — cross-check the subset
  // of engine-reported compliance checks that have a direct independent
  // counterpart above. (Turning head / road width / parking / fire access
  // aren't independently recomputed yet — flagged, not silently assumed covered.)
  const crossCheck: { engineId: string; harnessPass: boolean }[] = [
    { engineId: "plots-inside-boundary", harnessPass: insideBoundary },
    { engineId: "no-overlaps", harnessPass: !overlap && parkingInsideAPlot },
    { engineId: "plot-frontage", harnessPass: frontageOk },
    { engineId: "road-connects-entrance", harnessPass: roadConnectsEntrance },
    { engineId: "ndss-gia", harnessPass: ndssOk },
    { engineId: "garden-depth", harnessPass: gardenOk },
    { engineId: "back-to-back", harnessPass: backToBackOk },
  ];
  const greenOnViolation: string[] = [];
  for (const { engineId, harnessPass } of crossCheck) {
    const engineCheck = output.compliance.find((c) => c.id === engineId);
    if (engineCheck?.status === "pass" && !harnessPass) {
      greenOnViolation.push(engineId);
    }
  }
  results.push({
    id: "no-green-on-violation",
    label: "No compliance 'green' on a rule violation",
    pass: greenOnViolation.length === 0,
    detail:
      greenOnViolation.length === 0
        ? "Every engine-reported PASS (for the checks recomputed above) matches an independently-verified pass."
        : `Engine reported PASS but the harness found a violation for: ${greenOnViolation.join(", ")}.`,
  });

  return results;
}
