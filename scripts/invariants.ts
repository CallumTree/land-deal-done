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
  // Reference point to subtract before taking any dot product used for a
  // sign/bucket decision (which side of the road). BNG eastings/northings
  // are large and always positive, so a dot product of the raw coordinate
  // has the same sign for every plot regardless of which side it's on —
  // this bit once already (see the no-wasted-gaps side filter below,
  // fixed the same way). Localizing relative to the road's own start
  // point removes that offset; differences (depths, gaps) don't need it,
  // only signs do.
  const localOrigin = road ? road.centerlineBng[0] : entrance;
  function rearInfo(p: PlacedPlot) {
    const garden = p.gardenBng!.map((pt) => geo.sub(pt, localOrigin));
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

  // 5. Block length cap, independently grouped and counted from blockId.
  const blockGroups = new Map<string, PlacedPlot[]>();
  for (const p of plots) {
    const group = blockGroups.get(p.blockId) ?? [];
    group.push(p);
    blockGroups.set(p.blockId, group);
  }
  let blockLengthOk = true;
  let blockLengthDetail = "";
  for (const [blockId, group] of blockGroups) {
    const houseType = group[0].houseType;
    const maxAllowed = rules.MAX_BLOCK_UNITS[houseType];
    const sameType = group.every((p) => p.houseType === houseType);
    if (!sameType || group.length > maxAllowed) {
      blockLengthOk = false;
      blockLengthDetail = `Block ${blockId}: ${group.length} unit(s) of ${houseType} (max ${maxAllowed}).`;
      break;
    }
  }
  results.push({
    id: "block-length",
    label: "Attached block length cap",
    pass: blockLengthOk,
    detail: blockLengthOk
      ? `${blockGroups.size} block(s), all within their house type's cap (independently counted).`
      : blockLengthDetail,
  });

  // 6. Attached units genuinely share a wall — zero gap between consecutive footprints in a block.
  let attachedOk = true;
  let attachedDetail = "";
  outerAttached: for (const [blockId, group] of blockGroups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.blockPosition - b.blockPosition);
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = geo.minDistanceBetweenPolygons(sorted[i].footprintBng, sorted[i + 1].footprintBng);
      if (gap > 1e-3) {
        attachedOk = false;
        attachedDetail = `Block ${blockId}: units ${sorted[i].id} and ${sorted[i + 1].id} are ${gap.toFixed(2)}m apart.`;
        break outerAttached;
      }
    }
  }
  results.push({
    id: "attached-share-wall",
    label: "Attached units genuinely share a wall",
    pass: attachedOk,
    detail: attachedOk
      ? "Every multi-unit block's consecutive footprints touch with zero gap."
      : attachedDetail,
  });

  // 7. No gap between blocks big enough that a smaller unit could have fit and didn't.
  const smallestFrontageWidthM = Math.min(
    ...(["2-bed-terrace", "3-bed-semi", "4-bed-detached"] as HouseTypeId[]).map((t) => {
      const giaM2 = (inputs.ndssMinGiaM2?.[t] ?? rules.NDSS_MIN_GIA_M2[t]) as number;
      const footprintDepthM = rules.ASSUMED_FOOTPRINT_DEPTH_M[t];
      const footprintWidthM = giaM2 / rules.STOREYS[t] / footprintDepthM;
      const parkingWidthM = (inputs.parkingRatioPerUnit ?? rules.PARKING_SPACES_PER_UNIT) * rules.PARKING_SPACE_WIDTH_M;
      return Math.max(footprintWidthM, parkingWidthM);
    })
  );
  let wastedGapFound = false;
  let wastedGapDetail = "";
  for (const sideSign of [-1, 1]) {
    const sideBlocks = [...blockGroups.values()]
      .filter((group) => {
        // Same fix as rearInfo above: localize relative to the road's
        // start point before taking the sign, or every block comes out
        // on the same "side" because raw BNG coordinates are always
        // positive.
        const avgDepth =
          group.reduce((s, p) => s + geo.dot(geo.sub(p.plotBng[0], localOrigin), depthAxis), 0) / group.length;
        return (Math.sign(avgDepth) || 1) === sideSign;
      })
      .map((group) => {
        const tangentProj = group.flatMap((p) => p.plotBng.map((pt) => geo.dot(pt, tangentAxis)));
        return { blockId: group[0].blockId, yStart: Math.min(...tangentProj), yEnd: Math.max(...tangentProj) };
      })
      .sort((a, b) => a.yStart - b.yStart);
    for (let i = 0; i < sideBlocks.length - 1; i++) {
      const gap = sideBlocks[i + 1].yStart - sideBlocks[i].yEnd;
      const maxReasonableGap = rules.SIDE_GAP_M + smallestFrontageWidthM + 0.5; // 0.5m probe-step slack, matching the engine's own search granularity
      if (gap > maxReasonableGap) {
        wastedGapFound = true;
        wastedGapDetail = `Between ${sideBlocks[i].blockId} and ${sideBlocks[i + 1].blockId}: ${gap.toFixed(1)}m gap.`;
      }
    }
  }
  results.push({
    id: "no-wasted-gaps",
    label: "No gap large enough for a smaller unit to fit",
    pass: !wastedGapFound,
    detail: wastedGapFound ? wastedGapDetail : "No gap between blocks is large enough to have fit another unit.",
  });

  // 8. No compliance "green" on a rule violation — cross-check the subset
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
    { engineId: "block-length", harnessPass: blockLengthOk },
    { engineId: "attached-share-wall", harnessPass: attachedOk },
    { engineId: "no-wasted-gaps", harnessPass: !wastedGapFound },
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
