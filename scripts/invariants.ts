// Independent invariant checks for the test harness — recomputed from the
// engine's OUTPUT geometry (world/BNG coordinates), not by reading the
// engine's own ComplianceCheck claims. A layout that breaks any of these
// is a hard FAIL regardless of unit count, per the brief: "no compliance
// green on a rule violation."

import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput, HouseTypeId, PlacedPlot } from "../src/engine/types";
import { geo, rules } from "../src/engine";
import { resolveJurisdiction } from "../src/rules/jurisdictions";
import { schemeSizeBandForUnits } from "../src/rules/jurisdictions/types";

export interface InvariantResult {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

/**
 * Independent re-verification that nothing placed overlaps a HARD
 * restriction ("keep clear" zone) from inputs.restrictions — recomputed
 * directly against each restriction's own polygon, not by trusting the
 * engine's own "restrictions" ComplianceCheck. Shared by both
 * checkInvariants and checkBranchingInvariants: restriction enforcement
 * is identical across every topology (see generateLayout.ts's
 * overlapsAnyHardRestriction/overlapsEverythingRestriction), so one
 * shared check covers all of them. roadPolys is every road segment's
 * rectangle in WORLD/BNG coords (checkBranchingInvariants passes all of
 * them; checkInvariants passes just its one road, or none for frontage
 * ribbon).
 *
 * Split by `bars` (RestrictionBars, defaulting to "everything" when
 * omitted, same as the engine): a "buildings"-bars zone only keeps a
 * house FOOTPRINT out — a whole plot's driveway/garden, a road corridor
 * or a turning head may freely cross or run along it — while
 * "everything" keeps a whole plot/road out entirely.
 */
function checkRestrictions(plots: PlacedPlot[], roadPolys: BNGPolygon[], inputs: EngineInputs): InvariantResult {
  const hardRestrictions = (inputs.restrictions ?? []).filter((r) => r.hardness === "hard");
  const allHardPolys = hardRestrictions.map((r) => r.polygon);
  const everythingPolys = hardRestrictions.filter((r) => (r.bars ?? "everything") === "everything").map((r) => r.polygon);
  if (allHardPolys.length === 0) {
    return { id: "restrictions", label: "Keep-clear (restriction) zones respected", pass: true, detail: "No hard restriction zones set." };
  }
  const violatingPlots = plots.filter(
    (p) =>
      allHardPolys.some((h) => geo.convexPolygonsOverlap(p.footprintBng, h)) ||
      everythingPolys.some((h) => geo.convexPolygonsOverlap(fullPlotRect(p), h))
  );
  const violatingRoads = roadPolys.filter((rp) => everythingPolys.some((h) => geo.convexPolygonsOverlap(rp, h)));
  const ok = violatingPlots.length === 0 && violatingRoads.length === 0;
  return {
    id: "restrictions",
    label: "Keep-clear (restriction) zones respected",
    pass: ok,
    detail: ok
      ? `${allHardPolys.length} hard restriction zone(s) — no plot/footprint or road segment overlaps any of them.`
      : `${violatingPlots.length} plot(s) and ${violatingRoads.length} road segment(s) overlap a hard restriction zone.`,
  };
}

function fullPlotRect(p: PlacedPlot): BNGPolygon {
  return p.plotBng;
}

function hardRestrictionPolygons(inputs: EngineInputs): BNGPolygon[] {
  return (inputs.restrictions ?? []).filter((r) => r.hardness === "hard").map((r) => r.polygon);
}

function overlapsAnyHardRestrictionPoly(rect: BNGPolygon, hardPolys: BNGPolygon[]): boolean {
  return hardPolys.some((h) => geo.convexPolygonsOverlap(rect, h));
}

/**
 * Independently recomputes the SAME buildable-area erosion generateLayout.ts
 * applies before placing anything — boundary offset, then (if the resolved
 * jurisdiction has appraisal data) the non-housing reserve's extra inward
 * offset — using the same exported, pure functions the engine itself calls,
 * not by reading anything off the engine's output. This is the same
 * epistemic status as reusing rules.NDSS_MIN_GIA_M2 for the ndss check
 * above: an independently-recomputed, evidence-sourced number, not a
 * trusted claim from the engine's own reasoning.
 *
 * Needed specifically for checkBranchingInvariants' no-wasted-gaps check:
 * on a site with a real non-housing reserve, a gap that LOOKS wasted by a
 * simple boundary-offset-only erosion can be a genuine pinch once the
 * reserve's extra erosion is accounted for (confirmed directly on
 * pond-bridge-johnston — a unit fits at a boundary-offset-only erosion but
 * genuinely doesn't once the reserve is included, and the engine correctly
 * skips it). Without this, the no-wasted-gaps heuristic below would
 * misreport a real pinch as a bug.
 */
function erodedBuildableBoundary(boundary: BNGPolygon, inputs: EngineInputs): BNGPolygon {
  const eroded = geo.offsetPolygonInward(boundary, rules.BOUNDARY_OFFSET_M);
  if (!geo.isValidOffsetResult(boundary, eroded)) return eroded;

  const jurisdiction = resolveJurisdiction(inputs.localAuthority);
  if (!jurisdiction.localAppraisal) return eroded;

  const boundaryAreaM2 = geo.area(boundary);
  const localDensityTiers = jurisdiction.localPlanning
    ? Object.values(jurisdiction.localPlanning.minGrossDensityDphByTier).map((d) => d.value)
    : [];
  const provisionalDph = localDensityTiers.length > 0 ? Math.min(...localDensityTiers) : 25;
  const provisionalUnits = Math.max(1, Math.round((boundaryAreaM2 / 10000) * provisionalDph));
  const provisionalBand = schemeSizeBandForUnits(provisionalUnits);
  const netToGrossRatio = jurisdiction.localAppraisal.bySchemeSize[provisionalBand].netToGrossRatio.value;
  if (netToGrossRatio >= 1) return eroded;

  const targetAreaM2 = boundaryAreaM2 * netToGrossRatio;
  let lo = 0;
  let hi = Math.sqrt(boundaryAreaM2);
  let best = eroded;
  let bestArea = geo.area(eroded);
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const candidate = geo.offsetPolygonInward(boundary, rules.BOUNDARY_OFFSET_M + mid);
    const valid =
      geo.isValidOffsetResult(boundary, candidate) &&
      geo.isSimplePolygon(candidate) &&
      candidate.every((p) => geo.pointInPolygon(p, boundary));
    const candidateArea = valid ? geo.area(candidate) : 0;
    if (!valid || candidateArea < targetAreaM2) {
      hi = mid;
    } else {
      lo = mid;
      best = candidate;
      bestArea = candidateArea;
    }
  }
  return bestArea < geo.area(eroded) ? best : eroded;
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
    // A zero-plot result is only a genuine invariant failure if the
    // engine gave no reason — per generateLayout.ts's "never a silent
    // zero" rule, every zero-unit EngineOutput carries
    // metrics.zeroHomesReason. A reasoned zero (e.g. "Frontage is 9m: a
    // road and one plot need about 14m.") is the engine correctly
    // recognising an infeasible site, not a bug — PASS. An unreasoned
    // zero would mean that rule broke somewhere, which IS a bug — FAIL.
    const hasReason = !!output.metrics.zeroHomesReason;
    results.push({
      id: "has-plots",
      label: "Layout produced at least one plot, or a plain-English reason for zero",
      pass: hasReason,
      detail: hasReason
        ? `Zero plots, with a reason given: "${output.metrics.zeroHomesReason}"`
        : "Zero plots generated and NO reason was given — this breaks the 'never a silent zero' rule.",
    });
    return results;
  }

  // Branching spurs (generateLayout.ts's tryBranchingSpurs) has N road
  // segments (one spine + one per spur), each running a different
  // direction — the single roads[0]/roadPoly/one-road-direction
  // assumption the rest of this function relies on genuinely doesn't
  // apply, the same reason frontage ribbon gets its own entranceFrame
  // branch below rather than forcing a road-direction fiction onto a
  // topology that has none. Dedicated, fully independent recheck.
  if (output.metrics.topologyUsed === "branching-spurs") {
    return checkBranchingInvariants(output, boundary, entrance, inputs);
  }

  const road = roads[0];
  const roadPoly = road ? roadRect(road.centerlineBng, road.widthM) : null;
  const isFrontageRibbon = output.metrics.topologyUsed === "frontage-ribbon";
  // Frontage ribbon (generateLayout.ts's tryFrontageRibbon) builds no
  // road at all — plots front directly onto the EXISTING boundary edge
  // the entrance sits on. Independently find that edge the same way the
  // engine itself does (entranceEdgeFrame), rather than trusting the
  // engine's own placement — this is still a from-geometry recheck, just
  // against the boundary edge instead of a road polygon.
  const entranceFrame = isFrontageRibbon ? geo.entranceEdgeFrame(boundary, entrance) : null;

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
  // Frontage ribbon has no road to check against — independently find
  // the entrance's own boundary edge (same tolerance the engine's
  // entranceEdgeFrame uses) and check plots front THAT instead.
  let entranceEdge: { a: BNGPoint; b: BNGPoint } | null = null;
  if (isFrontageRibbon) {
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i];
      const b = boundary[(i + 1) % boundary.length];
      if (geo.distancePointToSegment(entrance, a, b) <= 0.5) {
        entranceEdge = { a, b };
        break;
      }
    }
  }
  const frontageOk = isFrontageRibbon
    ? entranceEdge != null &&
      plots.every((p) => {
        const d = geo.minDistanceBetweenPolygons(fullPlotRect(p), [entranceEdge!.a, entranceEdge!.b, entranceEdge!.b, entranceEdge!.a]);
        return Math.abs(d - rules.BOUNDARY_OFFSET_M) <= 1e-1;
      })
    : roadPoly != null && plots.every((p) => geo.minDistanceBetweenPolygons(fullPlotRect(p), roadPoly) <= 1e-2);
  results.push({
    id: "frontage",
    label: "Every plot has road frontage",
    pass: frontageOk,
    detail: frontageOk
      ? isFrontageRibbon
        ? "All plots front the existing boundary edge, offset by the standard boundary setback."
        : "All plots touch the road."
      : isFrontageRibbon
        ? "At least one plot does not correctly front the existing boundary edge."
        : "At least one plot does not touch the road.",
  });

  const roadConnectsEntrance = isFrontageRibbon
    ? entranceEdge != null
    : roadPoly != null && geo.pointInPolygon(entrance, roadPoly);
  results.push({
    id: "road-entrance",
    label: "Road connects to the entrance point",
    pass: roadConnectsEntrance,
    detail: isFrontageRibbon
      ? roadConnectsEntrance
        ? "No new road is built — the entrance sits directly on the frontage edge every plot fronts."
        : "Could not independently find the entrance's own boundary edge."
      : roadConnectsEntrance
        ? "Entrance point lies on the road."
        : "Entrance point is not on the road.",
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
  // "Tangent" = the direction frontage width stacks along (the road, for
  // the estate-road topologies; the existing boundary edge itself, for
  // frontage ribbon). "Depth" is perpendicular to it, into the site.
  // Frontage ribbon has no road to derive this from, so it uses the same
  // entranceEdgeFrame the engine itself resolves the edge from —
  // normal/tangent there are already exact perpendiculars (see
  // geometry.ts), so this never disagrees with how the engine reasons
  // about its own local frame.
  const roadDir: BNGPoint = road
    ? geo.normalize(geo.sub(road.centerlineBng[road.centerlineBng.length - 1], road.centerlineBng[0]))
    : entranceFrame
      ? entranceFrame.tangent
      : [1, 0];
  const depthAxis: BNGPoint = entranceFrame ? entranceFrame.normal : [roadDir[1], -roadDir[0]];
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
    ...(["2-bed-terrace", "3-bed-semi", "4-bed-detached", "3-bed-bungalow"] as HouseTypeId[]).map((t) => {
      const giaM2 = (inputs.ndssMinGiaM2?.[t] ?? rules.NDSS_MIN_GIA_M2[t]) as number;
      const footprintDepthM = rules.ASSUMED_FOOTPRINT_DEPTH_M[t];
      const footprintWidthM = giaM2 / rules.STOREYS[t] / footprintDepthM;
      const parkingWidthM = (inputs.parkingRatioPerUnit ?? rules.PARKING_SPACES_PER_UNIT) * rules.PARKING_SPACE_WIDTH_M;
      return Math.max(footprintWidthM, parkingWidthM);
    })
  );
  const hardPolys = hardRestrictionPolygons(inputs);
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
        const depthProj = group.flatMap((p) => p.plotBng.map((pt) => geo.dot(pt, depthAxis)));
        return {
          blockId: group[0].blockId,
          yStart: Math.min(...tangentProj),
          yEnd: Math.max(...tangentProj),
          depthMin: Math.min(...depthProj),
          depthMax: Math.max(...depthProj),
        };
      })
      .sort((a, b) => a.yStart - b.yStart);
    for (let i = 0; i < sideBlocks.length - 1; i++) {
      const gap = sideBlocks[i + 1].yStart - sideBlocks[i].yEnd;
      const probeStepM = inputs.quality === "draft" ? rules.DRAFT_PROBE_STEP_M : rules.PROBE_STEP_M;
      const maxReasonableGap = rules.SIDE_GAP_M + smallestFrontageWidthM + probeStepM; // probe-step slack, matching the engine's own search granularity for whichever quality this run used
      if (gap > maxReasonableGap) {
        // Before reporting this as wasted, check whether a hard
        // restriction zone (either bars type — a footprint can't stand
        // in either) explains the gap: build the real-world rectangle
        // the gap actually spans (tangent extent of the gap itself,
        // depth extent of the two neighbouring blocks together — depth
        // and tangent axes are orthonormal, so depthAxis*d +
        // tangentAxis*t exactly reconstructs the real point, no origin
        // offset needed) and skip flagging it if a restriction overlaps
        // that rectangle. A restriction-caused gap is the engine
        // correctly leaving land unbuilt, not a wasted-space bug.
        const depthMin = Math.min(sideBlocks[i].depthMin, sideBlocks[i + 1].depthMin);
        const depthMax = Math.max(sideBlocks[i].depthMax, sideBlocks[i + 1].depthMax);
        const corner = (d: number, t: number): BNGPoint => geo.add(geo.scale(depthAxis, d), geo.scale(tangentAxis, t));
        const gapRect: BNGPolygon = [
          corner(depthMin, sideBlocks[i].yEnd),
          corner(depthMin, sideBlocks[i + 1].yStart),
          corner(depthMax, sideBlocks[i + 1].yStart),
          corner(depthMax, sideBlocks[i].yEnd),
        ];
        if (!overlapsAnyHardRestrictionPoly(gapRect, hardPolys)) {
          wastedGapFound = true;
          wastedGapDetail = `Between ${sideBlocks[i].blockId} and ${sideBlocks[i + 1].blockId}: ${gap.toFixed(1)}m gap.`;
        }
      }
    }
  }
  results.push({
    id: "no-wasted-gaps",
    label: "No gap large enough for a smaller unit to fit",
    pass: !wastedGapFound,
    detail: wastedGapFound ? wastedGapDetail : "No gap between blocks is large enough to have fit another unit.",
  });

  // The exported road[0] segment's own centerline (and so roadPoly, built
  // from it) stops at roadEndY — it does NOT reach as far as
  // generateLayout.ts's own internal roadPolygonLocal, which reserves an
  // extra TURNING_HEAD_DIAMETER_M beyond that for the turning head itself
  // (roadLengthWithHead = roadEndY + turningHeadSide). Reusing roadPoly
  // as-is here would under-check: a hard restriction sitting only in that
  // reserved turning-head stretch — confirmed directly on
  // meads-priory-road-milford-haven's ecology-buffer fixture, where the
  // engine's own "restrictions" check correctly reports FAIL but a naive
  // recheck against the plain roadPoly reported PASS — would be missed.
  // Branching's own exported road segments already include this
  // extension in their own centrelines (see tryBranchingSpurs), so
  // checkBranchingInvariants below needs no equivalent fix.
  const roadPolyForRestrictions = road
    ? (() => {
        const [p0, p1] = road.centerlineBng;
        const dir = geo.normalize(geo.sub(p1, p0));
        const extendedP1 = geo.add(p1, geo.scale(dir, rules.TURNING_HEAD_DIAMETER_M));
        return roadRect([p0, extendedP1], road.widthM);
      })()
    : null;
  const restrictionsResult = checkRestrictions(plots, roadPolyForRestrictions ? [roadPolyForRestrictions] : [], inputs);
  results.push(restrictionsResult);

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
    { engineId: "restrictions", harnessPass: restrictionsResult.pass },
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

/**
 * Independent invariant checks for the branching-spurs topology
 * (generateLayout.ts's tryBranchingSpurs) — a spine plus N spur roads,
 * each running a different direction, so none of checkInvariants' above
 * single-road-direction assumptions (one roadPoly, one depthAxis/
 * tangentAxis) apply. Recomputes every check from OUTPUT geometry only,
 * same discipline as the function above: each plot's own
 * footprint→garden vector stands in for "the road direction" (there
 * isn't one that's shared across the whole layout), and frontage/road-
 * connects-entrance/no-overlaps check against EVERY road segment, not
 * just roads[0].
 */
function checkBranchingInvariants(
  output: EngineOutput,
  boundary: BNGPolygon,
  entrance: BNGPoint,
  inputs: EngineInputs
): InvariantResult[] {
  const results: InvariantResult[] = [];
  const { plots, roads } = output.layout;
  const roadPolys = roads.map((r) => roadRect(r.centerlineBng, r.widthM));

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

  // No overlaps: plot-vs-plot, plot-vs-ANY-road-segment. Road-vs-road
  // overlap is expected at every spine/spur T-junction, so it's not
  // treated as a violation here (same reasoning as the engine's own
  // branching compliance list).
  const plotRects = plots.map(fullPlotRect);
  let overlap = false;
  outer: for (let i = 0; i < plotRects.length; i++) {
    for (const rp of roadPolys) {
      if (geo.convexPolygonsOverlap(plotRects[i], rp)) {
        overlap = true;
        break outer;
      }
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

  const frontageOk = plots.every((p) => roadPolys.some((rp) => geo.minDistanceBetweenPolygons(fullPlotRect(p), rp) <= 1e-2));
  results.push({
    id: "frontage",
    label: "Every plot has road frontage",
    pass: frontageOk,
    detail: frontageOk
      ? "All plots touch at least one road segment (their own spur)."
      : "At least one plot does not touch any road segment.",
  });

  const roadConnectsEntrance = roadPolys.some((rp) => geo.pointInPolygon(entrance, rp));
  results.push({
    id: "road-entrance",
    label: "Road connects to the entrance point",
    pass: roadConnectsEntrance,
    detail: roadConnectsEntrance ? "Entrance point lies on a road segment (the spine)." : "Entrance point is not on any road segment.",
  });

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

  function centroid(rect: BNGPolygon): BNGPoint {
    const xs = rect.map((p) => p[0]);
    const ys = rect.map((p) => p[1]);
    return [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
  }
  // Each plot's own footprint→garden vector stands in for "the road
  // direction" here — there is no single direction shared by the whole
  // layout (the spine runs one way, each spur perpendicular to it), so
  // this has to be genuinely per-plot, recomputed from its own placed
  // geometry, not assumed from any one road segment.
  function outwardNormal(p: PlacedPlot): BNGPoint {
    return geo.normalize(geo.sub(centroid(p.gardenBng!), centroid(p.footprintBng)));
  }

  const gardenDepthRequired = inputs.minGardenDepthM ?? rules.MIN_GARDEN_DEPTH_M;
  const gardenOk = plots.every((p) => {
    if (!p.gardenBng) return false;
    const normal = outwardNormal(p);
    const projections = p.gardenBng.map((pt) => geo.dot(pt, normal));
    return Math.max(...projections) - Math.min(...projections) >= gardenDepthRequired - 1e-6;
  });
  results.push({
    id: "garden-depth",
    label: `Minimum garden depth (${gardenDepthRequired}m)`,
    pass: gardenOk,
    detail: gardenOk ? "Every garden meets the minimum depth." : "At least one garden is shallower than required.",
  });

  function rearMidpoint(p: PlacedPlot, normal: BNGPoint): BNGPoint {
    const garden = p.gardenBng!;
    const projections = garden.map((pt) => geo.dot(pt, normal));
    const maxProj = Math.max(...projections);
    const farPoints = garden.filter((_, idx) => Math.abs(projections[idx] - maxProj) < 1e-6);
    return [
      farPoints.reduce((s, pt) => s + pt[0], 0) / farPoints.length,
      farPoints.reduce((s, pt) => s + pt[1], 0) / farPoints.length,
    ];
  }

  const backToBackRequired = inputs.backToBackM ?? rules.BACK_TO_BACK_M;
  let facingPairFound = false;
  let minFacingDistance = Infinity;
  for (let i = 0; i < plots.length; i++) {
    for (let j = i + 1; j < plots.length; j++) {
      if (!plots[i].gardenBng || !plots[j].gardenBng) continue;
      const normalA = outwardNormal(plots[i]);
      const normalB = outwardNormal(plots[j]);
      const rearA = rearMidpoint(plots[i], normalA);
      const rearB = rearMidpoint(plots[j], normalB);
      const d = geo.sub(rearB, rearA);
      const dNorm = geo.normalize(d);
      const facingA = geo.dot(dNorm, normalA) > 0.7;
      const facingB = geo.dot(geo.scale(dNorm, -1), normalB) > 0.7;
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
      ? `Closest facing pair: ${minFacingDistance.toFixed(1)}m (independently recomputed from each plot's own footprint→garden direction).`
      : "No two plots face each other (independently checked across every plot pair, not assumed).",
  });

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
    detail: attachedOk ? "Every multi-unit block's consecutive footprints touch with zero gap." : attachedDetail,
  });

  // No wasted gaps — grouped per road segment + which way the block's
  // row faces (its outward normal), since blocks on different spurs or
  // on opposite sides of the same spur are never comparable for this
  // check. Each block is assigned to whichever road segment it's
  // actually closest to, independently of the engine's own bookkeeping —
  // EXCLUDING the spine (roads[0], by this topology's own construction in
  // generateLayout.ts's tryBranchingSpurs, which never places a plot
  // fronting it). Without this exclusion, a block right at the start of
  // ANY spur (u≈0, i.e. right where the spur meets the spine) sits almost
  // exactly on the spine's own edge too, registering a spurious ~0m tie
  // with the spine — confirmed directly on gibbas-way-pembroke, where
  // that tie silently merged two DIFFERENT spurs' south-facing rows (same
  // outward-normal direction, since "south" means the same main-frame
  // direction on every spur regardless of which spur it is) into one
  // false "wasted gap" between blocks that were never actually adjacent.
  function nearestRoadIndex(p: PlacedPlot): number {
    let best = roadPolys.length > 1 ? 1 : 0;
    let bestD = Infinity;
    roadPolys.forEach((rp, idx) => {
      if (roadPolys.length > 1 && idx === 0) return; // spine — see above
      const d = geo.minDistanceBetweenPolygons(fullPlotRect(p), rp);
      if (d < bestD) {
        bestD = d;
        best = idx;
      }
    });
    return best;
  }
  const smallestFrontageWidthM = Math.min(
    ...(["2-bed-terrace", "3-bed-semi", "4-bed-detached", "3-bed-bungalow"] as HouseTypeId[]).map((t) => {
      const giaM2 = (inputs.ndssMinGiaM2?.[t] ?? rules.NDSS_MIN_GIA_M2[t]) as number;
      const footprintDepthM = rules.ASSUMED_FOOTPRINT_DEPTH_M[t];
      const footprintWidthM = giaM2 / rules.STOREYS[t] / footprintDepthM;
      const parkingWidthM = (inputs.parkingRatioPerUnit ?? rules.PARKING_SPACES_PER_UNIT) * rules.PARKING_SPACE_WIDTH_M;
      return Math.max(footprintWidthM, parkingWidthM);
    })
  );
  const smallestTotalDepthM = Math.min(
    ...(["2-bed-terrace", "3-bed-semi", "4-bed-detached", "3-bed-bungalow"] as HouseTypeId[]).map(
      (t) => rules.PARKING_SPACE_DEPTH_M + rules.ASSUMED_FOOTPRINT_DEPTH_M[t] + (inputs.minGardenDepthM ?? rules.MIN_GARDEN_DEPTH_M)
    )
  );
  const buildableBoundary = erodedBuildableBoundary(boundary, inputs);

  interface SideGroup {
    origin: BNGPoint;
    tangent: BNGPoint;
    normal: BNGPoint;
    frontN: number;
    blocks: { blockId: string; alongMin: number; alongMax: number }[];
  }
  const sideGroups = new Map<string, SideGroup>();
  for (const [blockId, group] of blockGroups) {
    const roadIdx = nearestRoadIndex(group[0]);
    const r = roads[roadIdx];
    const origin = r.centerlineBng[0];
    const tangent = geo.normalize(geo.sub(r.centerlineBng[r.centerlineBng.length - 1], r.centerlineBng[0]));
    const normal = outwardNormal(group[0]);
    // Groups purely by (road, which way this block's row faces) — any
    // stable bucketing of "facing the same way on the same road" is
    // enough here, since the point is only to compare blocks that could
    // plausibly abut each other.
    const key = `${roadIdx}-${normal[0].toFixed(3)}-${normal[1].toFixed(3)}`;
    const relPts = group.flatMap((p) => p.plotBng.map((pt) => geo.sub(pt, origin)));
    const along = relPts.map((pt) => geo.dot(pt, tangent));
    const frontN = Math.min(...relPts.map((pt) => geo.dot(pt, normal)));
    const existing = sideGroups.get(key);
    const entry = existing ?? { origin, tangent, normal, frontN, blocks: [] };
    entry.blocks.push({ blockId, alongMin: Math.min(...along), alongMax: Math.max(...along) });
    sideGroups.set(key, entry);
  }

  // A gap beyond the simple tolerance is only a genuine violation if a
  // real unit could actually have fit SOMEWHERE in it — checked directly
  // against the independently-recomputed buildable boundary (offset +
  // non-housing reserve), not assumed from the gap's size alone. A real
  // pinch (confirmed on pond-bridge-johnston: a 30m gap where the
  // reserve-eroded boundary genuinely narrows below one unit's depth)
  // must read as a pass, exactly like the engine itself correctly
  // skipped it, not as a false "wasted gap" bug report.
  const hardPolys = hardRestrictionPolygons(inputs);
  function someUnitFitsInGap(group: SideGroup, gapStart: number, gapEnd: number): boolean {
    const probeStepM = inputs.quality === "draft" ? rules.DRAFT_PROBE_STEP_M : rules.PROBE_STEP_M;
    for (let t = gapStart; t + smallestFrontageWidthM <= gapEnd + 1e-6; t += probeStepM) {
      const corners = [
        [t, group.frontN],
        [t + smallestFrontageWidthM, group.frontN],
        [t + smallestFrontageWidthM, group.frontN + smallestTotalDepthM],
        [t, group.frontN + smallestTotalDepthM],
      ] as [number, number][];
      const rect: BNGPolygon = corners.map(([tt, nn]) =>
        geo.add(group.origin, geo.add(geo.scale(group.tangent, tt), geo.scale(group.normal, nn)))
      );
      // A restriction-blocked spot doesn't count as "fits" — a hard
      // restriction (either bars type) stops a footprint just as surely
      // as the boundary does, so skip it rather than reporting a gap
      // the engine left empty for a real reason as a wasted-space bug.
      if (geo.convexPolygonFullyInside(rect, buildableBoundary) && !overlapsAnyHardRestrictionPoly(rect, hardPolys)) return true;
    }
    return false;
  }

  let wastedGapFound = false;
  let wastedGapDetail = "";
  for (const group of sideGroups.values()) {
    const sorted = [...group.blocks].sort((a, b) => a.alongMin - b.alongMin);
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].alongMin - sorted[i].alongMax;
      const probeStepM = inputs.quality === "draft" ? rules.DRAFT_PROBE_STEP_M : rules.PROBE_STEP_M;
      const maxReasonableGap = rules.SIDE_GAP_M + smallestFrontageWidthM + probeStepM;
      if (gap > maxReasonableGap && someUnitFitsInGap(group, sorted[i].alongMax, sorted[i + 1].alongMin)) {
        wastedGapFound = true;
        wastedGapDetail = `Between ${sorted[i].blockId} and ${sorted[i + 1].blockId}: ${gap.toFixed(1)}m gap, and a unit genuinely fits somewhere in it.`;
      }
    }
  }
  results.push({
    id: "no-wasted-gaps",
    label: "No gap large enough for a smaller unit to fit",
    pass: !wastedGapFound,
    detail: wastedGapFound ? wastedGapDetail : "No gap between blocks is large enough to have fit another unit (any gap beyond the simple tolerance was confirmed to be a genuine pinch, not assumed).",
  });

  const restrictionsResult = checkRestrictions(plots, roadPolys, inputs);
  results.push(restrictionsResult);

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
    { engineId: "restrictions", harnessPass: restrictionsResult.pass },
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
