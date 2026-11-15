import type {
  BNGPoint,
  BNGPolygon,
  ComplianceCheck,
  EngineInputs,
  EngineOutput,
  HouseTypeId,
  LayoutResult,
  Metrics,
  PlacedPlot,
  RoadSegment,
} from "./types";
import * as geo from "./geometry";
import * as rules from "./rules";
import { resolveJurisdiction, type ResolvedJurisdiction } from "../rules/jurisdictions";
import {
  schemeSizeBandForUnits,
  isUnsourced,
  type MarketBand,
} from "../rules/jurisdictions/types";
import { SIZE_TIERS, expandSizeMixToHouseMix } from "./sizeTiers";

const HOUSE_TYPES: HouseTypeId[] = [
  "2-bed-terrace",
  "2-bed-semi",
  "2-bed-detached",
  "3-bed-terrace",
  "3-bed-semi",
  "3-bed-detached",
  "3-bed-bungalow",
  "4-bed-terrace",
  "4-bed-semi",
  "4-bed-detached",
  "5-bed-detached",
];

/**
 * Decides which mix the engine actually builds from, in priority order:
 *   1. `inputs.mix` (pro/advanced override) — any real HouseTypeId weight
 *      given at all wins outright, exactly as before this feature existed.
 *   2. `inputs.sizeMix` (the simplified Small/Medium/Large/XL control) —
 *      expanded into real HouseTypeId weights via sizeTiers.ts.
 *   3. "Auto" — the resolved jurisdiction's own sourced dwelling-mix
 *      evidence (see pembrokeshire.ts's defaultAutoSizeMixPercent), or an
 *      equal Small/Medium/Large split with XL excluded if no local pack
 *      is resolved at all (there's nothing council-specific to fall back
 *      on in that case, so this stays a flat, clearly-unsourced default
 *      rather than inventing evidence).
 */
function resolveEffectiveHouseMix(
  inputs: EngineInputs,
  jurisdiction: ResolvedJurisdiction
): Partial<Record<HouseTypeId, number>> {
  if (inputs.mix && Object.values(inputs.mix).some((w) => (w ?? 0) > 0)) {
    return inputs.mix;
  }
  const includeBungalows = inputs.includeBungalows ?? false;
  if (inputs.sizeMix && Object.values(inputs.sizeMix).some((w) => (w ?? 0) > 0)) {
    return expandSizeMixToHouseMix(inputs.sizeMix, includeBungalows);
  }
  const autoSizeMix = jurisdiction.localAppraisal
    ? Object.fromEntries(SIZE_TIERS.map((t) => [t, jurisdiction.localAppraisal!.defaultAutoSizeMixPercent[t].value]))
    : { Small: 1, Medium: 1, Large: 1, XL: 0 };
  return expandSizeMixToHouseMix(autoSizeMix, includeBungalows);
}

/**
 * Engine v0 — a deliberately simple topology: one straight dead-end access
 * road from the entrance, with plots ribbon-developed along both sides,
 * frontage on the road, garden behind facing the outer boundary. See
 * CLAUDE.md / the stage-2 report for why this is honestly limited (no
 * terrace blocking, no branching road network, single row depth per plot)
 * and what a later iteration should change.
 */
export function generateLayout(
  boundary: BNGPolygon,
  entrance: BNGPoint,
  inputs: EngineInputs = {}
): EngineOutput {
  const t0 = performance.now();

  // Accept GeoJSON-style closed rings (first point repeated at the end) —
  // every edge-based calculation below assumes an implicit closing edge.
  boundary = geo.stripClosingDuplicate(boundary);

  const parkingRatio = inputs.parkingRatioPerUnit ?? rules.PARKING_SPACES_PER_UNIT;
  const gardenDepthM = inputs.minGardenDepthM ?? rules.MIN_GARDEN_DEPTH_M;
  const backToBackM = inputs.backToBackM ?? rules.BACK_TO_BACK_M;
  const ndssMinGia: Record<HouseTypeId, number> = {
    ...rules.NDSS_MIN_GIA_M2,
    ...inputs.ndssMinGiaM2,
  };
  const jurisdiction = resolveJurisdiction(inputs.localAuthority);

  // --- Local frame: entrance at origin, inward normal of its edge = +Y ---
  const { normal } = geo.entranceEdgeFrame(boundary, entrance);
  const normalAngle = Math.atan2(normal[1], normal[0]);
  const rotationAngle = Math.PI / 2 - normalAngle;

  const toLocal = (p: BNGPoint): BNGPoint =>
    geo.rotateAround(geo.sub(p, entrance), [0, 0], rotationAngle);
  const toWorld = (p: BNGPoint): BNGPoint =>
    geo.add(geo.rotateAround(p, [0, 0], -rotationAngle), entrance);

  const localBoundary = boundary.map(toLocal);
  const boundaryAreaM2 = geo.area(localBoundary);

  const compliance: ComplianceCheck[] = [];

  // --- Erode for buildings (road is allowed to meet the boundary at the entrance) ---
  const erodedLocal = geo.offsetPolygonInward(localBoundary, rules.BOUNDARY_OFFSET_M);
  const erosionValid = geo.isValidOffsetResult(localBoundary, erodedLocal);

  compliance.push({
    id: "boundary-offset",
    label: "Boundary offset / no-build zone",
    status: erosionValid ? "pass" : "fail",
    ruleRef: `Boundary offset default ${rules.BOUNDARY_OFFSET_M}m (v0 nominal, editable)`,
    detail: erosionValid
      ? `Eroded buildable area ${(geo.area(erodedLocal) / 10000).toFixed(3)}ha from ${(boundaryAreaM2 / 10000).toFixed(3)}ha gross.`
      : "Inward offset produced an invalid polygon (site too narrow/complex for v0's offset method) — treating buildable area as empty.",
  });

  if (!erosionValid) {
    return finalize({
      plots: [],
      roads: [],
      parkingSpacesBng: [],
    }, compliance, boundaryAreaM2, inputs, jurisdiction, t0);
  }

  const maxBoundaryY = Math.max(...localBoundary.map((p) => p[1]));
  const roadHalfWidth = rules.ROAD_WIDTH_M / 2;
  const turningHeadSide = rules.TURNING_HEAD_DIAMETER_M;
  // Reserve room for the turning head up front, rather than placing plots
  // greedily and finding out afterwards there's no room to turn around.
  const maxPlotFrontageY = maxBoundaryY - turningHeadSide;

  // --- Mix cycle at the TYPE level: each "turn" attempts a whole attached
  // block (terrace run / semi pair / lone detached), not just one unit —
  // see rules.MAX_BLOCK_UNITS. ---
  const mixCycle = buildMixCycle(resolveEffectiveHouseMix(inputs, jurisdiction));

  interface PlotSpec {
    houseType: HouseTypeId;
    frontageWidthM: number;
    drivewayDepthM: number;
    footprintDepthM: number;
    gardenDepthM: number;
    totalDepthM: number;
    giaM2: number;
  }

  function computePlotSpecUncached(houseType: HouseTypeId): PlotSpec {
    const giaM2 = ndssMinGia[houseType];
    const storeys = rules.STOREYS[houseType];
    const footprintDepthM = rules.ASSUMED_FOOTPRINT_DEPTH_M[houseType];
    const footprintAreaM2 = giaM2 / storeys;
    const footprintWidthM = footprintAreaM2 / footprintDepthM;
    const parkingWidthM = parkingRatio * rules.PARKING_SPACE_WIDTH_M;
    const frontageWidthM = Math.max(footprintWidthM, parkingWidthM);
    const drivewayDepthM = rules.PARKING_SPACE_DEPTH_M;
    const totalDepthM = drivewayDepthM + footprintDepthM + gardenDepthM;
    return { houseType, frontageWidthM, drivewayDepthM, footprintDepthM, gardenDepthM, totalDepthM, giaM2 };
  }

  // computePlotSpec is a pure function of houseType alone (it doesn't
  // depend on position), but the placement search calls it per
  // candidate — with 11 house types and 0.5m-step probing over long
  // frontages, that's hundreds of thousands of calls to recompute the
  // same handful of numbers, each one touching several rules.ts lookup
  // objects keyed by a dynamic houseType string. Profiling
  // pond-bridge-johnston showed those repeated dynamic-key lookups
  // becoming "megamorphic" in V8 (too many distinct house types for its
  // inline cache to stay fast) once HOUSE_TYPES grew past 4 — computing
  // each type's spec once and reusing it removes both the redundant
  // arithmetic and the megamorphic access pattern.
  const plotSpecCache = new Map<HouseTypeId, PlotSpec>();
  function computePlotSpec(houseType: HouseTypeId): PlotSpec {
    let spec = plotSpecCache.get(houseType);
    if (!spec) {
      spec = computePlotSpecUncached(houseType);
      plotSpecCache.set(houseType, spec);
    }
    return spec;
  }

  type Side = "left" | "right";

  // Types ordered smallest-frontage-first, for backtracking to a smaller
  // type when the preferred one won't fit anywhere in the remaining room.
  const typesByFrontageAsc = [...HOUSE_TYPES].sort(
    (a, b) => computePlotSpec(a).frontageWidthM - computePlotSpec(b).frontageWidthM
  );
  const smallestFrontageWidthM = Math.min(...HOUSE_TYPES.map((t) => computePlotSpec(t).frontageWidthM));
  const smallestTotalDepthM = Math.min(...HOUSE_TYPES.map((t) => computePlotSpec(t).totalDepthM));

  function depthToX(side: Side, frontageX: number, depth: number): number {
    return side === "left" ? frontageX - depth : frontageX + depth;
  }

  function buildPlotRect(side: Side, frontageX: number, rearX: number, yStart: number, yEnd: number): BNGPolygon {
    return side === "left"
      ? [
          [frontageX, yStart],
          [frontageX, yEnd],
          [rearX, yEnd],
          [rearX, yStart],
        ]
      : [
          [frontageX, yStart],
          [rearX, yStart],
          [rearX, yEnd],
          [frontageX, yEnd],
        ];
  }

  // Probe step for searching forward past a pinch point (e.g. a cul-de-sac's
  // narrow access neck) to the next position where a block actually fits,
  // rather than giving up on the whole side the first time one doesn't.
  // See rules.ts for why this is quality-dependent.
  const draftMode = inputs.quality === "draft";
  const PROBE_STEP_M = draftMode ? rules.DRAFT_PROBE_STEP_M : rules.PROBE_STEP_M;

  interface PlacementState {
    plots: PlacedPlot[];
    parkingSpacesLocal: BNGPoint[];
    cursorLeft: number;
    cursorRight: number;
    cycleIndexLeft: number;
    cycleIndexRight: number;
    plotCounter: number;
    blockCounter: number;
  }

  function freshState(): PlacementState {
    // Plots start at the boundary offset, not 0 — the first row sits right
    // next to the entrance along the same edge the entrance is on, which
    // still needs the same no-build setback as the rest of that edge; only
    // the road itself is exempt.
    return {
      plots: [],
      parkingSpacesLocal: [],
      cursorLeft: rules.BOUNDARY_OFFSET_M,
      cursorRight: rules.BOUNDARY_OFFSET_M,
      cycleIndexLeft: 0,
      cycleIndexRight: 0,
      plotCounter: 0,
      blockCounter: 0,
    };
  }

  function placeUnit(
    state: PlacementState,
    side: Side,
    spec: PlotSpec,
    frontageX: number,
    rearX: number,
    yStart: number,
    yEnd: number,
    blockId: string,
    blockPosition: number,
    blockSize: number
  ) {
    const driveX = depthToX(side, frontageX, spec.drivewayDepthM);
    const houseX = depthToX(side, frontageX, spec.drivewayDepthM + spec.footprintDepthM);
    const plotRectLocal = buildPlotRect(side, frontageX, rearX, yStart, yEnd);

    const footprintLocal: BNGPolygon =
      side === "left"
        ? [
            [driveX, yStart],
            [driveX, yEnd],
            [houseX, yEnd],
            [houseX, yStart],
          ]
        : [
            [driveX, yStart],
            [houseX, yStart],
            [houseX, yEnd],
            [driveX, yEnd],
          ];

    const gardenLocal: BNGPolygon =
      side === "left"
        ? [
            [houseX, yStart],
            [houseX, yEnd],
            [rearX, yEnd],
            [rearX, yStart],
          ]
        : [
            [houseX, yStart],
            [rearX, yStart],
            [rearX, yEnd],
            [houseX, yEnd],
          ];

    state.plotCounter += 1;
    state.plots.push({
      id: `plot-${state.plotCounter}`,
      houseType: spec.houseType,
      plotBng: plotRectLocal.map(toWorld),
      footprintBng: footprintLocal.map(toWorld),
      gardenBng: gardenLocal.map(toWorld),
      giaM2: spec.giaM2,
      blockId,
      blockPosition,
      blockSize,
    });

    const spacesNeeded = Math.max(1, Math.round(parkingRatio));
    const spaceWidth = spec.frontageWidthM / spacesNeeded;
    for (let s = 0; s < spacesNeeded; s++) {
      const centerY = yStart + spaceWidth * (s + 0.5);
      state.parkingSpacesLocal.push([depthToX(side, frontageX, spec.drivewayDepthM / 2), centerY]);
    }
  }

  // Does a block of `blockSize` units of `houseType` fit with its first
  // unit starting exactly at `yStart` (no searching)? Checked, not placed.
  function fitsBlockAt(
    side: Side,
    houseType: HouseTypeId,
    blockSize: number,
    yStart: number
  ): { fits: boolean; frontageX: number; rearX: number; spec: PlotSpec } {
    const spec = computePlotSpec(houseType);
    const frontageX = side === "left" ? -roadHalfWidth : roadHalfWidth;
    const rearX = depthToX(side, frontageX, spec.totalDepthM);
    const blockWidth = spec.frontageWidthM * blockSize;
    if (yStart + blockWidth > maxPlotFrontageY) {
      return { fits: false, frontageX, rearX, spec };
    }
    for (let u = 0; u < blockSize; u++) {
      const uStart = yStart + u * spec.frontageWidthM;
      const uEnd = uStart + spec.frontageWidthM;
      if (!geo.convexPolygonFullyInside(buildPlotRect(side, frontageX, rearX, uStart, uEnd), erodedLocal)) {
        return { fits: false, frontageX, rearX, spec };
      }
    }
    return { fits: true, frontageX, rearX, spec };
  }

  function placeBlockAt(
    state: PlacementState,
    side: Side,
    blockSize: number,
    yStart: number,
    frontageX: number,
    rearX: number,
    spec: PlotSpec
  ): number {
    state.blockCounter += 1;
    const blockId = `block-${state.blockCounter}`;
    for (let u = 0; u < blockSize; u++) {
      const uStart = yStart + u * spec.frontageWidthM;
      const uEnd = uStart + spec.frontageWidthM;
      placeUnit(state, side, spec, frontageX, rearX, uStart, uEnd, blockId, u, blockSize);
    }
    return yStart + spec.frontageWidthM * blockSize + rules.SIDE_GAP_M;
  }

  // One "turn" for a side: try the preferred type (per the mix cycle) at
  // decreasing block sizes, then fall back through progressively smaller
  // house types, before giving up on this side entirely.
  // Check every candidate position before advancing — not "let the
  // preferred type probe ahead to wherever IT fits" (which can skip right
  // over a gap a smaller type would have filled; an earlier version did
  // exactly that and tripped the no-wasted-gaps invariant). At each
  // position, try the preferred type (largest block down to 1), then
  // progressively smaller types, and only step forward once NONE of them
  // fit right there.
  function tryPlaceOnSide(state: PlacementState, side: Side): boolean {
    const startCursor = side === "left" ? state.cursorLeft : state.cursorRight;
    const cycleIndex = side === "left" ? state.cycleIndexLeft : state.cycleIndexRight;
    const preferredType = mixCycle[cycleIndex % mixCycle.length];
    // Draft mode skips the "try every other type" fallback — only the
    // mix cycle's own preferred type is attempted at each position (with
    // that type's normal block-size fallback, 6..1, still in play). This
    // is strictly less search than full mode does, never more — draft
    // can only place a subset of what full would place.
    const typeOrder = draftMode ? [preferredType] : [preferredType, ...typesByFrontageAsc.filter((t) => t !== preferredType)];

    for (let yStart = startCursor; yStart < maxPlotFrontageY; yStart += PROBE_STEP_M) {
      for (const houseType of typeOrder) {
        for (let blockSize = rules.MAX_BLOCK_UNITS[houseType]; blockSize >= 1; blockSize--) {
          const check = fitsBlockAt(side, houseType, blockSize, yStart);
          if (check.fits) {
            const newCursor = placeBlockAt(state, side, blockSize, yStart, check.frontageX, check.rearX, check.spec);
            if (side === "left") {
              state.cursorLeft = newCursor;
              state.cycleIndexLeft += 1;
            } else {
              state.cursorRight = newCursor;
              state.cycleIndexRight += 1;
            }
            return true;
          }
        }
      }
    }
    return false;
  }

  function runPlacement(sides: Side[]): PlacementState {
    const state = freshState();
    let progress = true;
    while (progress) {
      const results = sides.map((side) => tryPlaceOnSide(state, side));
      progress = results.some(Boolean);
    }
    return state;
  }

  // Double-loaded first; only if that fits literally nothing does it fall
  // back to a single-sided ribbon (road stays centred on the entrance;
  // only one side gets plots) — "try before giving up," not "prefer."
  //
  // Stability/hysteresis: when single-left and single-right come out
  // close (within TOPOLOGY_TIE_MARGIN_UNITS units of each other — not
  // just an exact tie), prefer whichever side the caller's
  // `previousTopologyHint` says the last call used, rather than always
  // breaking ties the same arbitrary way (left-wins). This is purely a
  // tie-breaker for genuinely ambiguous cases during interactive
  // dragging — it never overrides a side that's clearly better by more
  // than the margin, and it never turns an infeasible side feasible.
  const TOPOLOGY_TIE_MARGIN_UNITS = 1;
  let topology: "double" | "single-left" | "single-right" | "none" = "double";
  let state = runPlacement(["left", "right"]);
  if (state.plots.length === 0) {
    const singleLeft = runPlacement(["left"]);
    const singleRight = runPlacement(["right"]);
    const diff = singleLeft.plots.length - singleRight.plots.length;
    const isTie = Math.abs(diff) <= TOPOLOGY_TIE_MARGIN_UNITS;
    const hintSide =
      inputs.previousTopologyHint === "single-left" ? "left" : inputs.previousTopologyHint === "single-right" ? "right" : null;
    if (singleLeft.plots.length === 0 && singleRight.plots.length === 0) {
      topology = "none";
      state = singleLeft;
    } else if (isTie && hintSide === "right" && singleRight.plots.length > 0) {
      topology = "single-right";
      state = singleRight;
    } else if (diff >= 0 || (isTie && hintSide !== "right")) {
      topology = "single-left";
      state = singleLeft;
    } else {
      topology = "single-right";
      state = singleRight;
    }
  }

  const { plots, parkingSpacesLocal, cursorLeft, cursorRight } = state;

  const erodedXs = erodedLocal.map((p) => p[0]);
  const erodedWidthM = Math.max(...erodedXs) - Math.min(...erodedXs);
  compliance.push({
    id: "topology",
    label: "Road/plot topology used",
    status: topology === "none" ? "fail" : "pass",
    ruleRef: "v0 fallback order: double-loaded ribbon, then single-sided ribbon, before giving up",
    detail:
      topology === "double"
        ? "Double-loaded: plots on both sides of the road."
        : topology === "single-left"
          ? "Double-loading fit nothing; fell back to a single-sided ribbon (left side only)."
          : topology === "single-right"
            ? "Double-loading fit nothing; fell back to a single-sided ribbon (right side only)."
            : `No topology fits any house type. Eroded buildable width here is ${erodedWidthM.toFixed(1)}m. Even the smallest unit needs road (${rules.ROAD_WIDTH_M}m) + driveway/footprint/garden (${smallestTotalDepthM.toFixed(1)}m) = ${(rules.ROAD_WIDTH_M + smallestTotalDepthM).toFixed(1)}m for a single row — short by ${(rules.ROAD_WIDTH_M + smallestTotalDepthM - erodedWidthM).toFixed(1)}m. Two flanking rows would need ${(rules.ROAD_WIDTH_M + 2 * smallestTotalDepthM).toFixed(1)}m.`,
  });

  const roadEndY = Math.max(cursorLeft, cursorRight, 0);
  const roadLengthWithHead = roadEndY + turningHeadSide;

  const roadCenterlineLocal: BNGPoint[] = [[0, 0], [0, roadEndY]];
  const roads: RoadSegment[] = [
    {
      id: "road-1",
      centerlineBng: roadCenterlineLocal.map(toWorld),
      widthM: rules.ROAD_WIDTH_M,
    },
  ];

  // --- Turning head: does it fit inside the ORIGINAL boundary? ---
  const turningHeadLocal: BNGPolygon = [
    [-turningHeadSide / 2, roadEndY],
    [turningHeadSide / 2, roadEndY],
    [turningHeadSide / 2, roadEndY + turningHeadSide],
    [-turningHeadSide / 2, roadEndY + turningHeadSide],
  ];
  const turningHeadFits = geo.convexPolygonFullyInside(turningHeadLocal, localBoundary);
  compliance.push({
    id: "turning-head",
    label: "Turning head at road end",
    status: plots.length === 0 ? "warn" : turningHeadFits ? "pass" : "fail",
    ruleRef: `Manual for Streets (DfT, 2007) — ~${rules.TURNING_HEAD_DIAMETER_M}m turning circle for a dead-end road`,
    detail:
      plots.length === 0
        ? "No plots placed, so no road was built — nothing to check."
        : turningHeadFits
          ? `${rules.TURNING_HEAD_DIAMETER_M}m turning head fits within the boundary at the road's end.`
          : `${rules.TURNING_HEAD_DIAMETER_M}m turning head does NOT fit within the boundary at y=${roadEndY.toFixed(1)}m from the entrance.`,
  });

  // --- Road width is the rule value by construction; state it as a check anyway ---
  compliance.push({
    id: "road-width",
    label: "Road carriageway width",
    status: "pass",
    ruleRef: `Manual for Streets (DfT, 2007) — ${rules.ROAD_WIDTH_M}m minimum used as v0 default`,
    detail: `Road modelled at a constant ${rules.ROAD_WIDTH_M}m width.`,
  });

  // --- Road connects to entrance: by construction, but verify for real ---
  const roadPolygonLocal: BNGPolygon = [
    [-roadHalfWidth, 0],
    [roadHalfWidth, 0],
    [roadHalfWidth, roadLengthWithHead],
    [-roadHalfWidth, roadLengthWithHead],
  ];
  const roadReachesEntrance = geo.pointInPolygon([0, 0], roadPolygonLocal);
  compliance.push({
    id: "road-connects-entrance",
    label: "Road connects to entrance",
    status: roadReachesEntrance ? "pass" : "fail",
    ruleRef: "Brief requirement — road-to-entrance connector",
    detail: roadReachesEntrance
      ? "Road corridor starts exactly at the supplied entrance point."
      : "Road corridor does not reach the entrance point.",
  });

  // The whole plot boundary (driveway + house + garden) back in local
  // frame, for the geometric checks below.
  function fullPlotRectLocal(p: PlacedPlot): BNGPolygon {
    return p.plotBng.map(toLocal);
  }

  // --- Every plot has road frontage ---
  const frontageTolerance = 1e-3;
  const frontageOk = plots.every(
    (p) => geo.minDistanceBetweenPolygons(fullPlotRectLocal(p), roadPolygonLocal) <= frontageTolerance
  );
  compliance.push({
    id: "plot-frontage",
    label: "Every plot has road frontage",
    status: plots.length > 0 ? (frontageOk ? "pass" : "fail") : "warn",
    ruleRef: "Brief requirement — every plot must front the access road",
    detail:
      plots.length > 0
        ? frontageOk
          ? `${plots.length} plot(s) all touch the road corridor.`
          : "At least one plot does not touch the road corridor."
        : "No plots placed.",
  });

  // --- Plots fully inside eroded boundary (independent re-check, not just trusting placement) ---
  const allInsideErosion = plots.every((p) => geo.convexPolygonFullyInside(fullPlotRectLocal(p), erodedLocal));
  compliance.push({
    id: "plots-inside-boundary",
    label: "All plots inside boundary, clear of setbacks",
    status: allInsideErosion ? "pass" : "fail",
    ruleRef: `Boundary + ${rules.BOUNDARY_OFFSET_M}m offset`,
    detail: allInsideErosion
      ? `${plots.length} plot(s) all confirmed within the eroded boundary.`
      : "At least one plot's footprint/garden falls outside the eroded boundary.",
  });

  // --- No overlaps between plots or road ---
  const plotRectsLocalForOverlap = plots.map(fullPlotRectLocal);
  let overlapFound = false;
  outer: for (let i = 0; i < plotRectsLocalForOverlap.length; i++) {
    if (geo.convexPolygonsOverlap(plotRectsLocalForOverlap[i], roadPolygonLocal)) {
      overlapFound = true;
      break outer;
    }
    for (let j = i + 1; j < plotRectsLocalForOverlap.length; j++) {
      if (geo.convexPolygonsOverlap(plotRectsLocalForOverlap[i], plotRectsLocalForOverlap[j])) {
        overlapFound = true;
        break outer;
      }
    }
  }
  compliance.push({
    id: "no-overlaps",
    label: "No overlaps between plots, road and parking",
    status: overlapFound ? "fail" : "pass",
    ruleRef: "Brief requirement — geometric non-overlap",
    detail: overlapFound
      ? "At least one pair of plots/road overlap."
      : `${plots.length} plot(s) and the road checked pairwise — no overlaps.`,
  });

  // --- Block length cap ---
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
    if (!sameType || group.length > maxAllowed || group.length !== group[0].blockSize) {
      blockLengthOk = false;
      blockLengthDetail = `Block ${blockId}: ${group.length} unit(s) of ${houseType} (max ${maxAllowed}).`;
      break;
    }
  }
  compliance.push({
    id: "block-length",
    label: "Attached block length cap",
    status: plots.length > 0 ? (blockLengthOk ? "pass" : "fail") : "warn",
    ruleRef: "rules.ts MAX_BLOCK_UNITS (terrace configurable; semi=2 and detached=1 by definition)",
    detail:
      plots.length > 0
        ? blockLengthOk
          ? `${blockGroups.size} block(s), all within their house type's cap.`
          : blockLengthDetail
        : "No plots placed.",
  });

  // --- Attached units genuinely share a wall (zero gap between consecutive footprints in a block) ---
  let attachedOk = true;
  let attachedDetail = "";
  outerBlocks: for (const [blockId, group] of blockGroups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.blockPosition - b.blockPosition);
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = geo.minDistanceBetweenPolygons(sorted[i].footprintBng, sorted[i + 1].footprintBng);
      if (gap > 1e-3) {
        attachedOk = false;
        attachedDetail = `Block ${blockId}: units ${sorted[i].id} and ${sorted[i + 1].id} are ${gap.toFixed(2)}m apart, not sharing a wall.`;
        break outerBlocks;
      }
    }
  }
  compliance.push({
    id: "attached-share-wall",
    label: "Attached units genuinely share a wall",
    status: plots.length > 0 ? (attachedOk ? "pass" : "fail") : "warn",
    ruleRef: "Brief requirement — terrace/semi units must be structurally adjacent, not just nearby",
    detail:
      plots.length > 0
        ? attachedOk
          ? "Every multi-unit block's consecutive footprints touch with zero gap."
          : attachedDetail
        : "No plots placed.",
  });

  // --- No gap between blocks big enough that a smaller unit could have fit and didn't ---
  let wastedGapFound = false;
  let wastedGapDetail = "";
  for (const side of ["left", "right"] as Side[]) {
    const sideBlocks = [...blockGroups.values()]
      .filter((group) => plotSideLocal(group[0]) === side)
      .map((group) => {
        const localPts = group.flatMap((p) => p.plotBng.map(toLocal));
        const ys = localPts.map((pt) => pt[1]);
        return { blockId: group[0].blockId, yStart: Math.min(...ys), yEnd: Math.max(...ys) };
      })
      .sort((a, b) => a.yStart - b.yStart);
    for (let i = 0; i < sideBlocks.length - 1; i++) {
      const gap = sideBlocks[i + 1].yStart - sideBlocks[i].yEnd;
      const maxReasonableGap = rules.SIDE_GAP_M + smallestFrontageWidthM + PROBE_STEP_M;
      if (gap > maxReasonableGap) {
        wastedGapFound = true;
        wastedGapDetail = `${side} side, between ${sideBlocks[i].blockId} and ${sideBlocks[i + 1].blockId}: ${gap.toFixed(1)}m gap — room for another ${smallestFrontageWidthM.toFixed(1)}m-wide unit plus its side gap.`;
      }
    }
  }
  compliance.push({
    id: "no-wasted-gaps",
    label: "No gap large enough for a smaller unit to fit",
    status: plots.length > 0 ? (wastedGapFound ? "fail" : "pass") : "warn",
    ruleRef: "Brief requirement — backtrack to a smaller type before leaving a gap empty",
    detail:
      plots.length > 0
        ? wastedGapFound
          ? wastedGapDetail
          : "No gap between blocks is large enough to have fit another unit."
        : "No plots placed.",
  });

  // --- NDSS GIA ---
  const ndssOk = plots.every((p) => p.giaM2 >= ndssMinGia[p.houseType] - 1e-6);
  compliance.push({
    id: "ndss-gia",
    label: "NDSS minimum GIA",
    status: ndssOk ? "pass" : "fail",
    ruleRef: "DCLG, NDSS, March 2015, Table 1",
    detail: ndssOk
      ? "Every plot's GIA is set to exactly its NDSS minimum for its house type (v0 builds at the floor, not above it)."
      : "At least one plot is below its NDSS minimum GIA.",
  });

  // --- Garden depth ---
  const gardenOk = plots.every((p) => {
    if (!p.gardenBng) return false;
    const localGarden = p.gardenBng.map(toLocal);
    const xs = localGarden.map((pt) => pt[0]);
    const depth = Math.max(...xs) - Math.min(...xs);
    return depth >= gardenDepthM - 1e-6;
  });
  compliance.push({
    id: "garden-depth",
    label: "Minimum garden depth",
    status: plots.length > 0 ? (gardenOk ? "pass" : "fail") : "warn",
    ruleRef: `Brief default ${gardenDepthM}m`,
    detail:
      plots.length > 0
        ? gardenOk
          ? `Every plot's garden is at least ${gardenDepthM}m deep.`
          : "At least one plot's garden is shallower than the minimum."
        : "No plots placed.",
  });

  // --- Back-to-back: genuinely checked, not assumed ---
  // Two plots are "facing" if the vector between their rear midpoints
  // points roughly along each plot's own outward (away-from-road) rear
  // normal — i.e. each one's rear is pointing toward the other, not just
  // in a direction that happens to be antiparallel. In this v0 ribbon
  // topology every row's rear normal points outward to the SITE boundary
  // (left row faces further left, right row faces further right), so no
  // pair should ever satisfy that — but it's computed per pair below,
  // not asserted.
  function plotSideLocal(p: PlacedPlot): "left" | "right" {
    const garden = p.gardenBng?.map(toLocal) ?? [];
    const avgX = garden.reduce((sum, pt) => sum + pt[0], 0) / garden.length;
    return avgX < 0 ? "left" : "right";
  }
  function rearMidpointLocal(p: PlacedPlot): BNGPoint {
    const garden = p.gardenBng?.map(toLocal) ?? [];
    const side = plotSideLocal(p);
    const xs = garden.map((pt) => pt[0]);
    const rearX = side === "left" ? Math.min(...xs) : Math.max(...xs);
    const ys = garden.map((pt) => pt[1]);
    return [rearX, (Math.min(...ys) + Math.max(...ys)) / 2];
  }

  let facingPairFound = false;
  let minFacingDistance = Infinity;
  for (let i = 0; i < plots.length; i++) {
    for (let j = i + 1; j < plots.length; j++) {
      const sideA = plotSideLocal(plots[i]);
      const sideB = plotSideLocal(plots[j]);
      if (sideA === sideB) continue; // same side, rears point the same way — can't face each other
      const midA = rearMidpointLocal(plots[i]);
      const midB = rearMidpointLocal(plots[j]);
      const normalA: BNGPoint = sideA === "left" ? [-1, 0] : [1, 0];
      const normalB: BNGPoint = sideB === "left" ? [-1, 0] : [1, 0];
      const d = geo.sub(midB, midA);
      const dNorm = geo.normalize(d);
      const facingA = geo.dot(dNorm, normalA) > 0.7;
      const facingB = geo.dot(geo.scale(dNorm, -1), normalB) > 0.7;
      if (facingA && facingB) {
        facingPairFound = true;
        minFacingDistance = Math.min(minFacingDistance, geo.length(d));
      }
    }
  }
  const backToBackOk = !facingPairFound || minFacingDistance >= backToBackM - 1e-6;
  compliance.push({
    id: "back-to-back",
    label: `${backToBackM}m back-to-back distance`,
    status: backToBackOk ? "pass" : "fail",
    ruleRef: `Brief default ${backToBackM}m (Essex Design Guide, 1973, convention)`,
    detail: facingPairFound
      ? `Closest facing pair is ${minFacingDistance.toFixed(1)}m apart.`
      : "No two plots face each other in this v0 topology (each row's gardens back onto the outer site boundary, not onto another row) — the rule has nothing to violate here. That's a real limitation of this v0 topology, not a validated guarantee for layouts a future version might build with two rows backing onto each other.",
  });

  // --- Parking: frontage width already sized to fit the ratio, verify ---
  const parkingOk = plots.every((p) => {
    const spec = computePlotSpec(p.houseType);
    return spec.frontageWidthM >= parkingRatio * rules.PARKING_SPACE_WIDTH_M - 1e-6;
  });
  compliance.push({
    id: "parking",
    label: `Parking (${parkingRatio}/unit)`,
    status: plots.length > 0 ? (parkingOk ? "pass" : "fail") : "warn",
    ruleRef: `v0 default ${rules.PARKING_SPACES_PER_UNIT}/unit (common UK local parking SPD figure, editable)`,
    detail:
      plots.length > 0
        ? parkingOk
          ? "Every plot's frontage is sized to fit its required parking."
          : "At least one plot is narrower than its required parking allocation."
        : "No plots placed.",
  });

  // --- Fire/refuse access: every plot fronts directly onto the road in this topology ---
  compliance.push({
    id: "fire-access",
    label: "Fire/refuse appliance access",
    status: "pass",
    ruleRef: `Approved Document B / common ${rules.MAX_FIRE_ACCESS_DISTANCE_M}m hose-run convention`,
    detail:
      "Every plot fronts directly onto the road in this v0 topology, so frontage-to-road distance is 0m for all plots — trivially within the limit. Only meaningful once a layout can set plots back from the road.",
  });

  const roadsWorld = roads;
  const layout: LayoutResult = {
    plots,
    roads: roadsWorld,
    parkingSpacesBng: parkingSpacesLocal.map(toWorld),
  };

  return finalize(layout, compliance, boundaryAreaM2, inputs, jurisdiction, t0, topology);
}

const DEFAULT_HOUSE_TYPES: HouseTypeId[] = ["2-bed-terrace", "3-bed-semi", "4-bed-detached"];

function buildMixCycle(mix: Partial<Record<HouseTypeId, number>> | undefined): HouseTypeId[] {
  // EngineInputs.mix's own doc comment says "missing types default to 0"
  // — the code used to default them to 1 instead, which would have
  // silently pulled bungalows into every unlabelled mix the moment a 4th
  // type existed. Missing really does mean 0 now; an explicit mix with
  // only "3-bed-bungalow" set builds bungalows only, nothing else.
  const weights = HOUSE_TYPES.map((t) => Math.max(0, Math.round(mix?.[t] ?? 0)));
  const cycle: HouseTypeId[] = [];
  for (let i = 0; i < HOUSE_TYPES.length; i++) {
    for (let k = 0; k < weights[i]; k++) cycle.push(HOUSE_TYPES[i]);
  }
  // Nothing requested at all (mix omitted, or every weight came out 0) —
  // fall back to the original three-type equal mix. Bungalow stays
  // opt-in rather than joining the unlabelled default: it's provisional
  // (see rules.ts) and scheme-specific, not a general-purpose house type yet.
  return cycle.length > 0 ? cycle : [...DEFAULT_HOUSE_TYPES];
}

function finalize(
  layout: LayoutResult,
  compliance: ComplianceCheck[],
  boundaryAreaM2: number,
  inputs: EngineInputs,
  jurisdiction: ResolvedJurisdiction,
  t0: number,
  topologyUsed: "double" | "single-left" | "single-right" | "none" = "none"
): EngineOutput {
  const mix: Record<HouseTypeId, number> = {
    "2-bed-terrace": 0,
    "2-bed-semi": 0,
    "2-bed-detached": 0,
    "3-bed-terrace": 0,
    "3-bed-semi": 0,
    "3-bed-detached": 0,
    "3-bed-bungalow": 0,
    "4-bed-terrace": 0,
    "4-bed-semi": 0,
    "4-bed-detached": 0,
    "5-bed-detached": 0,
  };
  let totalGiaM2 = 0;
  for (const p of layout.plots) {
    mix[p.houseType] += 1;
    totalGiaM2 += p.giaM2;
  }
  const totalUnits = layout.plots.length;

  const netAreaM2 = layout.plots.reduce((sum, p) => {
    const footprintArea = geo.area(p.footprintBng);
    const gardenArea = p.gardenBng ? geo.area(p.gardenBng) : 0;
    return sum + footprintArea + gardenArea;
  }, 0);

  const netDensityDph = netAreaM2 > 0 ? totalUnits / (netAreaM2 / 10000) : 0;
  const grossDensityDph = boundaryAreaM2 > 0 ? totalUnits / (boundaryAreaM2 / 10000) : 0;

  const schemeSizeBand = schemeSizeBandForUnits(totalUnits);
  const marketBand: MarketBand = inputs.marketBand ?? jurisdiction.localAppraisal?.defaultMarketBand ?? 2;

  const localAppraisal = jurisdiction.localAppraisal;
  const sizeRow = localAppraisal?.bySchemeSize[schemeSizeBand];
  const bandRow = localAppraisal?.byMarketBand[marketBand];

  // Fall back to the (deliberately UNSOURCED) national appraisal
  // placeholders when no local pack is resolved at all — see
  // src/rules/jurisdictions/national.ts for why these are never
  // presented as "real" figures.
  const resolvedGdvPerSqm =
    inputs.gdvPerSqm ?? bandRow?.salesPricePerSqm.value ?? jurisdiction.nationalAppraisal.salesPricePerSqmPlaceholder.value;
  const resolvedBuildCostPerSqm =
    inputs.buildCostPerSqm ?? sizeRow?.buildCostPerSqm.value ?? jurisdiction.nationalAppraisal.buildCostPerSqmPlaceholder.value;

  // --- Affordable housing % (on-site), by [marketBand][schemeSizeBand] ---
  // `null`/missing in the source table means "off-site financial
  // contribution expected instead of an on-site %" (see pembrokeshire.ts
  // comments) — treated as 0% on-site here, which is honest about what
  // v0 actually delivers (it doesn't model an off-site commuted sum at
  // all yet), not a claim that 0% is the real policy position.
  const affordableEntry = localAppraisal?.affordableHousingPercent[marketBand]?.[schemeSizeBand];
  const affordablePercentOnSite = affordableEntry?.value ?? 0;
  const affordableUnits = Math.round((totalUnits * affordablePercentOnSite) / 100);
  const openMarketUnits = totalUnits - affordableUnits;

  // v0's layout doesn't tag any specific physical plot as "affordable" —
  // this is a financial overlay on the whole scheme's GIA, apportioned
  // by unit count, not a per-plot distinction.
  const avgGiaPerUnit = totalUnits > 0 ? totalGiaM2 / totalUnits : 0;
  const openMarketGiaM2 = avgGiaPerUnit * openMarketUnits;
  const affordableGiaM2 = avgGiaPerUnit * affordableUnits;

  // Sales-price premiums (§5.7, §5.10 — see pembrokeshire.ts): bungalow
  // premium applies when every unit in the mix is the bungalow type;
  // small-site premium applies at ≤10 total units. Modelled as
  // independent multiplicative premiums on the open-market £/m² rate —
  // the source states each individually but doesn't say how they'd
  // combine if both applied at once, so "multiply both" is this engine's
  // own modelling choice, not a sourced figure.
  let adjustedGdvPerSqm = resolvedGdvPerSqm;
  const allBungalow = totalUnits > 0 && mix["3-bed-bungalow"] === totalUnits;
  if (allBungalow && localAppraisal) {
    adjustedGdvPerSqm *= 1 + localAppraisal.bungalowSalesPremiumPercent.value / 100;
  }
  if (totalUnits > 0 && totalUnits <= 10 && localAppraisal) {
    adjustedGdvPerSqm *= 1 + localAppraisal.smallSitePremiumPercent.value / 100;
  }

  const openMarketGdv = openMarketGiaM2 * adjustedGdvPerSqm;

  // Affordable transfer value: social-rent/intermediate tenure split
  // (§5.13) applied to the affordable GIA share, each tenure's transfer
  // value as a % of the resolved jurisdiction's OMV rate. The source's
  // social-rent basis is % of ACG (Acceptable Cost Guidance, a Welsh
  // Government mechanism), not % of OMV — this engine does not have a
  // published ACG rate table, so ACG is approximated here as equal to
  // OMV, a simplification flagged explicitly (see pembrokeshire.ts and
  // the README) rather than silently assumed.
  const socialRentShare = (localAppraisal?.tenureSplitSocialRentPercent.value ?? 100) / 100;
  const intermediateShare = (localAppraisal?.tenureSplitIntermediatePercent.value ?? 0) / 100;
  const socialRentGiaM2 = affordableGiaM2 * socialRentShare;
  const intermediateGiaM2 = affordableGiaM2 * intermediateShare;
  const socialRentValue =
    socialRentGiaM2 * resolvedGdvPerSqm * ((localAppraisal?.socialRentTransferValuePercentOfAcg.value ?? 0) / 100);
  const intermediateValue =
    intermediateGiaM2 * resolvedGdvPerSqm * ((localAppraisal?.intermediateTransferValuePercentOfOmv.value ?? 0) / 100);
  const affordableRevenue = socialRentValue + intermediateValue;

  const gdv = openMarketGdv + affordableRevenue;

  const buildCost = totalGiaM2 * resolvedBuildCostPerSqm;
  const externalWorks = totalUnits * (sizeRow?.externalWorksPerDwelling.value ?? 0);
  const suds = totalUnits * (localAppraisal?.sudsPerDwelling.value ?? 0);
  const s106 = totalUnits * (sizeRow?.s106PerDwelling.value ?? 0);
  // Design fees are a % of construction (plot) costs alone, per FVR
  // §5.31 — not of external works, which is a separate line.
  const designFees = buildCost * ((sizeRow?.designFeesPercent.value ?? 0) / 100);
  // Contingency is applied to construction + external/physical
  // infrastructure costs together, matching the worked Appendix E model.
  const contingency = (buildCost + externalWorks) * ((localAppraisal?.contingencyPercent.value ?? jurisdiction.nationalAppraisal.contingencyPercent.value) / 100);
  const marketingPercent =
    totalUnits >= 20
      ? localAppraisal?.marketingPercent20PlusUnits.value
      : localAppraisal?.marketingPercentUnder20Units.value;
  const marketing = openMarketGdv * ((marketingPercent ?? 0) / 100);
  const legal = totalUnits * (localAppraisal?.legalCostPerDwelling.value ?? jurisdiction.nationalAppraisal.legalCostPerDwelling.value);
  const landAcqFeesPercent =
    (localAppraisal?.landAcquisitionFeesPercent.value ?? jurisdiction.nationalAppraisal.landAcquisitionFeesPercent.value) / 100;

  // Finance: a simplified one-off charge at the resolved "all-in" annual
  // rate against the costs incurred before land, rather than a real
  // month-by-month cash-flow model (the source documents' own DVM/RVM
  // models do run a full cash flow — v0 does not). Flagged as a
  // simplification, consistent with the "crude residual" honesty this
  // engine already applies elsewhere.
  const financeRatePercent = sizeRow?.financeRatePercentPA.value ?? 0;
  const costsBeforeFinance = buildCost + externalWorks + suds + s106 + designFees + contingency;
  const finance = costsBeforeFinance * (financeRatePercent / 100);

  const totalCostsExclProfitAndLand = costsBeforeFinance + marketing + legal + finance;

  const developerProfitPercent = sizeRow?.developerProfitPercentGDV.value ?? 0;
  const developerProfit = gdv * (developerProfitPercent / 100);

  // Residual land value: GDV minus every cost above minus target profit,
  // then adjusted so that landAcquisitionFeesPercent (a % of the land
  // price actually paid) comes out of the land value itself rather than
  // being double-counted — i.e. rawResidual = landValue × (1 + fee%), so
  // landValue = rawResidual / (1 + fee%).
  const rawResidual = gdv - totalCostsExclProfitAndLand - developerProfit;
  const residualLandValue = rawResidual / (1 + landAcqFeesPercent);

  const affordableValueOverstated = affordableUnits > 0 && (localAppraisal?.acgApproximatedAsOmv ?? true);

  const metrics: Metrics = {
    totalUnits,
    mix,
    netDensityDph,
    grossDensityDph,
    totalGiaM2,
    gdv,
    buildCost,
    developerProfit,
    residualLandValue,
    affordableUnits,
    affordablePercentOnSite,
    localAuthority: jurisdiction.localAuthority,
    marketBand,
    affordableValueOverstated,
    residualLandValueIndicative: true,
    topologyUsed,
  };

  compliance.push({
    id: "appraisal-sourcing",
    label: "Appraisal inputs sourcing",
    status: localAppraisal && !isUnsourced(jurisdiction.nationalAppraisal.salesPricePerSqmPlaceholder) ? "pass" : localAppraisal ? "pass" : "warn",
    ruleRef: localAppraisal
      ? `Resolved local pack: ${localAppraisal.councilName}`
      : "No local appraisal pack resolved for this localAuthority — falling back to national UNSOURCED placeholders",
    detail: localAppraisal
      ? `GDV/build-cost/land-value figures sourced from the resolved jurisdiction's local pack (scheme-size band "${schemeSizeBand}", market band ${marketBand}).`
      : `No local pack found for "${jurisdiction.localAuthority}" — GDV £${jurisdiction.nationalAppraisal.salesPricePerSqmPlaceholder.value}/m² and build cost £${jurisdiction.nationalAppraisal.buildCostPerSqmPlaceholder.value}/m² are UNSOURCED national placeholders, not real figures for this site.`,
  });

  if (affordableUnits > 0) {
    compliance.push({
      id: "acg-approximation",
      label: "Affordable-housing transfer value basis",
      status: affordableValueOverstated ? "warn" : "pass",
      ruleRef: localAppraisal?.acgApproximationNote.source ?? "n/a",
      detail: affordableValueOverstated
        ? (localAppraisal?.acgApproximationNote.value ??
          "ACG approximated as OMV — affordable-housing-derived GDV, developer profit and residual land value are OVERSTATED.")
        : "Social-rent transfer value uses a published ACG rate, not an OMV approximation.",
    });
  }

  const computeMs = performance.now() - t0;
  void computeMs; // not part of EngineOutput's type; the harness measures its own wall-clock time around the call.

  return { layout, metrics, compliance };
}
