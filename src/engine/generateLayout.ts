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
  const sideGapM = rules.SIDE_GAP_TIER_M[inputs.sideGapTier ?? "tighter"];
  const jurisdiction = resolveJurisdiction(inputs.localAuthority);
  // v0's baseline behaviour is to build every unit at EXACTLY its NDSS
  // minimum GIA — confirmed as a material, real cause of over-building
  // unit counts vs approved schemes (see LocalAppraisalDefaults.
  // typicalMarketSizeUpliftPercent's own doc comment and
  // pembrokeshire.ts's sourcing). Applied here, before any explicit
  // per-type override, so inputs.ndssMinGiaM2 always wins completely for
  // whichever types it sets — the uplift only fills in types the caller
  // didn't explicitly size.
  // Social/RSL-led schemes build at the bare NDSS floor, not a market
  // uplift — see EngineInputs.tenure's own doc comment. "market" (the
  // default) is the only tenure the uplift evidence was ever sourced
  // from; applying it to a "social" scheme would be a real sourcing
  // error, not an approximation.
  const marketSizeUpliftPercent =
    (inputs.tenure ?? "market") === "social" ? 0 : (jurisdiction.localAppraisal?.typicalMarketSizeUpliftPercent.value ?? 0);
  const ndssMinGia: Record<HouseTypeId, number> = {
    ...Object.fromEntries(
      Object.entries(rules.NDSS_MIN_GIA_M2).map(([t, v]) => [t, Math.round(v * (1 + marketSizeUpliftPercent / 100))])
    ),
    ...inputs.ndssMinGiaM2,
  } as Record<HouseTypeId, number>;

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
  let erodedLocal = geo.offsetPolygonInward(localBoundary, rules.BOUNDARY_OFFSET_M);
  let erosionValid = geo.isValidOffsetResult(localBoundary, erodedLocal);

  // --- Non-housing reserve: open space, drainage/SuDS, landscape buffers
  // taken OUT of the developable area before any plot is placed, sized
  // from the resolved jurisdiction's own net-to-gross evidence by scheme
  // size (LocalAppraisalDefaults.bySchemeSize[band].netToGrossRatio —
  // see pembrokeshire.ts; this field existed before this change but was
  // only ever shown as a "yield sense-check," never actually applied to
  // a layout). Why this matters: v0 previously eroded ONLY the fixed
  // BOUNDARY_OFFSET_M margin and then packed plots across the entire
  // remaining area — a real scheme's gross site also carries its SuDS
  // pond/open space/ecology buffers/wider verges, none of which v0
  // modelled at all, so it had strictly more land to build on than any
  // real approved scheme did. Confirmed directly: on the Milford Haven
  // fixture (test-sites/meads-priory-road-milford-haven.json), this was
  // the single largest cause of the engine's ~73% unit-count overshoot
  // (ahead of the mix-collapse fix just above).
  //
  // The right scheme-size band can't be known yet (it depends on the
  // unit count, which is what we're about to compute) — a provisional
  // density estimate stands in just to pick a band: the resolved
  // jurisdiction's own lowest sourced minimum-density tier (the same
  // conservative figure the density-minimum compliance check below
  // falls back to when settlement tier is unknown), or a generic 25 dph
  // if no local planning pack is resolved at all. Scheme-size bands are
  // wide and netToGrossRatio only moves in ~0.05 steps between adjacent
  // ones, so landing one band off changes the reserve by a few
  // percentage points at most — not material to the final unit count.
  let nonHousingReservePercent = 0;
  let nonHousingReserveSource: string | null = null;
  if (jurisdiction.localAppraisal) {
    const localDensityTiers = jurisdiction.localPlanning
      ? Object.values(jurisdiction.localPlanning.minGrossDensityDphByTier).map((d) => d.value)
      : [];
    const provisionalDph = localDensityTiers.length > 0 ? Math.min(...localDensityTiers) : 25;
    const provisionalUnits = Math.max(1, Math.round((boundaryAreaM2 / 10000) * provisionalDph));
    const provisionalBand = schemeSizeBandForUnits(provisionalUnits);
    const row = jurisdiction.localAppraisal.bySchemeSize[provisionalBand];
    const netToGrossRatio = row.netToGrossRatio.value;
    nonHousingReservePercent = Math.round((1 - netToGrossRatio) * 100);
    nonHousingReserveSource = row.netToGrossRatio.source;

    if (erosionValid && netToGrossRatio < 1) {
      const targetAreaM2 = boundaryAreaM2 * netToGrossRatio;
      // Bisect the EXTRA inward-offset distance (beyond the standard
      // BOUNDARY_OFFSET_M already applied above) until the eroded area
      // lands at/below the target net area — reusing the same offset
      // function and the same collapse check every other erosion in
      // this engine already relies on, rather than a new geometry
      // algorithm. offsetPolygonInward is a known-simplistic straight-
      // line offset (see its own doc comment in geometry.ts) that CAN
      // self-intersect on a narrow/irregular shape at a large enough
      // distance — isValidOffsetResult only catches a collapsed-to-zero
      // or inverted result, not every possible self-intersection, so
      // this is a best-effort reserve on a very irregular boundary, not
      // a geometrically bulletproof one. Verified against the fuzz
      // harness's independent invariant checker (0 failures) before
      // relying on it — see the shape-robustness report.
      let lo = 0;
      let hi = Math.sqrt(boundaryAreaM2);
      let best = erodedLocal;
      let bestArea = geo.area(erodedLocal);
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const candidate = geo.offsetPolygonInward(localBoundary, rules.BOUNDARY_OFFSET_M + mid);
        // isValidOffsetResult alone isn't enough at this scale: a
        // self-intersecting ("bowtie") result from too large an offset
        // can still shoelace-compute to a plausible smaller positive
        // area and pass that check. isSimplePolygon catches a bowtie,
        // but a degenerate offset can ALSO come out simple yet wrong —
        // e.g. a thin quadrilateral eroded past its own width can flip
        // its far corners' intersection order into a valid-looking but
        // wrongly-shaped simple polygon that isn't really "the eroded
        // original" anymore. The strongest cheap check: every vertex of
        // the candidate must genuinely lie inside the ORIGINAL boundary
        // — confirmed via direct fuzz-harness reproduction that
        // isSimplePolygon alone still let two real invariant failures
        // through; this containment check is what actually closed them.
        const valid =
          geo.isValidOffsetResult(localBoundary, candidate) &&
          geo.isSimplePolygon(candidate) &&
          candidate.every((p) => geo.pointInPolygon(p, localBoundary));
        const candidateArea = valid ? geo.area(candidate) : 0;
        if (!valid || candidateArea < targetAreaM2) {
          hi = mid;
        } else {
          lo = mid;
          best = candidate;
          bestArea = candidateArea;
        }
      }
      if (bestArea < geo.area(erodedLocal)) {
        erodedLocal = best;
        erosionValid = geo.isValidOffsetResult(localBoundary, erodedLocal);
      }
    }
  }

  compliance.push({
    id: "boundary-offset",
    label: "Boundary offset / no-build zone",
    status: erosionValid ? "pass" : "fail",
    ruleRef: `Boundary offset default ${rules.BOUNDARY_OFFSET_M}m (v0 nominal, editable)`,
    detail: erosionValid
      ? `Eroded buildable area ${(geo.area(erodedLocal) / 10000).toFixed(3)}ha from ${(boundaryAreaM2 / 10000).toFixed(3)}ha gross${
          nonHousingReservePercent > 0
            ? ` (includes a ${nonHousingReservePercent}% non-housing reserve for open space/drainage/landscape — ${nonHousingReserveSource})`
            : ""
        }.`
      : "Inward offset produced an invalid polygon (site too narrow/complex for v0's offset method) — treating buildable area as empty.",
  });

  if (!erosionValid) {
    return finalize(
      { plots: [], roads: [], parkingSpacesBng: [] },
      compliance,
      boundaryAreaM2,
      inputs,
      jurisdiction,
      t0,
      "none",
      {
        cause: "boundary-too-complex",
        reason: "This boundary shape is too narrow or complex for a buildable area to be worked out.",
      },
      { percent: nonHousingReservePercent, source: nonHousingReserveSource }
    );
  }

  // Probe step for searching forward past a pinch point (e.g. a cul-de-sac's
  // narrow access neck) to the next position where a block actually fits,
  // rather than giving up on the whole side the first time one doesn't.
  // See rules.ts for why this is quality-dependent. Hoisted above the
  // turning-head reservation below, which also needs it.
  const draftMode = inputs.quality === "draft";
  const PROBE_STEP_M = draftMode ? rules.DRAFT_PROBE_STEP_M : rules.PROBE_STEP_M;

  const maxBoundaryY = Math.max(...localBoundary.map((p) => p[1]));
  const roadHalfWidth = rules.ROAD_WIDTH_M / 2;
  const turningHeadSide = rules.TURNING_HEAD_DIAMETER_M;

  /**
   * Does a turningHeadSide × turningHeadSide square, starting at local Y
   * `y`, fit fully inside the ORIGINAL (non-eroded) boundary? Same check
   * the final "Turning head at road end" compliance result uses —
   * defined once, used both to size the placement ceiling below and for
   * that compliance check later, so they can never disagree.
   *
   * Tries every X-offset that still keeps the square touching the road's
   * own centreline (X=0), not just the dead-centre placement — a
   * turning head is a widened area at a dead-end road's end, and Manual
   * for Streets doesn't require it to be symmetric about the straight
   * road behind it; real turning heads commonly bulge into whichever
   * side the site allows. Checking ONLY the centred placement was a real
   * bug, not a deliberate simplification: found via scripts/fuzz-
   * shapes.ts — a site with an entrance placed near one end of its edge
   * (not a hard requirement that's ever stated anywhere, just a common
   * real layout) puts the road's X=0 near one edge of the site's actual
   * width, so the centred 16m window always poked out the narrow side
   * even when the site had 50+m of width available, just not
   * symmetrically either side of X=0. This explained 84 of 300 (28%) of
   * the fuzz harness's zero-home results, by far the largest single
   * cause — see audit report.
   */
  function turningHeadFitsAt(y: number): boolean {
    const half = turningHeadSide / 2;
    const offsetStep = 2; // coarser than PROBE_STEP_M — exact mm-level positioning doesn't matter here, only whether SOME placement fits
    for (let offset = -half; offset <= half; offset += offsetStep) {
      const square: BNGPolygon = [
        [offset - half, y],
        [offset + half, y],
        [offset + half, y + turningHeadSide],
        [offset - half, y + turningHeadSide],
      ];
      if (geo.convexPolygonFullyInside(square, localBoundary)) return true;
    }
    return false;
  }

  // Reserve room for the turning head up front, rather than placing plots
  // greedily and finding out afterwards there's no room to turn around.
  //
  // `maxBoundaryY - turningHeadSide` is only a valid ceiling for a
  // boundary that's roughly rectangular (constant width with Y) — on an
  // irregular polygon the usable width can narrow and widen unevenly, so
  // the turning head can fit in a window partway up the site and then
  // NEVER fit again all the way to that naive ceiling (confirmed on the
  // real pond-bridge-johnston fixture: fits across roughly y=50-100m,
  // then fails everywhere from y=110m up to the naive ceiling at
  // y=220.3m). Placement is a one-directional greedy fill with no
  // backtracking once a block is committed, so if the naive ceiling sits
  // inside a dead zone, EVERY mix with enough demand to keep filling
  // ribbon frontage walks straight into it and the turning head fails
  // regardless of which houses were chosen — not a mix problem at all.
  //
  // Fix: search downward from the naive ceiling for the highest Y where
  // the turning head actually still fits, and use THAT as the real
  // ceiling instead. This is a one-off search over the boundary's shape
  // alone (independent of mix/topology), run once per generateLayout
  // call, so the extra cost is negligible next to the per-position
  // placement search below. If nothing fits anywhere — not even at
  // y=0 — maxPlotFrontageY stays 0 and the final turning-head check
  // legitimately fails: that's a genuinely infeasible site shape, not
  // something to paper over.
  const naiveTurningHeadCeiling = maxBoundaryY - turningHeadSide;
  let maxPlotFrontageY = 0;
  for (let y = naiveTurningHeadCeiling; y >= 0; y -= PROBE_STEP_M) {
    if (turningHeadFitsAt(y)) {
      maxPlotFrontageY = y;
      break;
    }
  }

  // --- Mix cycle at the TYPE level: each "turn" attempts a whole attached
  // block (terrace run / semi pair / lone detached), not just one unit —
  // see rules.MAX_BLOCK_UNITS. ---
  const mixPlan = buildMixPlan(resolveEffectiveHouseMix(inputs, jurisdiction));
  const mixCycle = mixPlan.cycle;

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

  /**
   * How far a type's running share may run ahead of its target share
   * (from the active mix's own weights) before the placement search
   * stops preferring it over an under-represented type that also
   * physically fits. 0.10 = 10 percentage points — a deliberate BAND,
   * not an exact match requirement: small positions-vs-geometry noise
   * (e.g. a run of terraces that happens to fit three in a row) is
   * expected and fine; what this stops is the mix collapsing entirely
   * onto whichever single type is easiest to pack (see the comment on
   * orderTypesForMixTolerance below for the failure mode this fixes).
   */
  const MIX_TOLERANCE_BAND = 0.1;

  /**
   * The placement loops below try a list of house types at each
   * candidate position, in order, and build the first one that fits.
   * Before this existed, that order was always [preferred-by-cycle,
   * ...everything else by ascending frontage] — and because the
   * smallest-frontage type (2-bed-terrace) fits in almost any gap a
   * larger preferred type doesn't, every position where the cycle's
   * current "turn" didn't physically fit fell through to 2-bed-terrace
   * as the universal filler. Over a whole site that starves the larger
   * types the mix evidence actually calls for — confirmed directly on
   * the Milford Haven fixture (102/102 placed units were 2-bed-terrace,
   * despite an Auto mix targeting roughly a third Small/under half
   * Medium/a fifth Large).
   *
   * Fix: reorder the *in-mix* types (weight > 0) by how far UNDER their
   * own target share they currently are, each time a position is
   * probed — the cycle's nominal preferred type still goes first as
   * long as it isn't running more than MIX_TOLERANCE_BAND ahead of its
   * target, but once a type has run that far ahead, a still-behind type
   * gets first refusal instead, even if the cycle "says" otherwise.
   * Out-of-mix types (weight 0) are untouched — they stay in the
   * trailing full-fallback list, exactly as before, so a gap nothing
   * in-mix can fill still gets something rather than being wasted (see
   * the no-wasted-gaps invariant). This can only make the built mix
   * MORE faithful to the target shares; it never excludes a type that
   * physically fits and never produces fewer homes than before — a
   * type that doesn't fit here still falls through to the next
   * candidate in the list, same as always.
   */
  function orderTypesForMixTolerance(preferredType: HouseTypeId, placedSoFar: PlacedPlot[]): HouseTypeId[] {
    const { weights, totalWeight } = mixPlan;
    if (totalWeight <= 0) return [preferredType, ...typesByFrontageAsc.filter((t) => t !== preferredType)];

    const totalPlaced = placedSoFar.length;
    const deficit = (t: HouseTypeId): number => {
      const target = (weights[t] ?? 0) / totalWeight;
      const current = totalPlaced > 0 ? placedSoFar.filter((p) => p.houseType === t).length / totalPlaced : 0;
      return target - current; // positive = under-represented vs its target share
    };

    const inMixTypes = HOUSE_TYPES.filter((t) => (weights[t] ?? 0) > 0);
    const rankedByDeficit = [...inMixTypes].sort((a, b) => deficit(b) - deficit(a));

    const order =
      (weights[preferredType] ?? 0) > 0 && deficit(preferredType) >= -MIX_TOLERANCE_BAND
        ? [preferredType, ...rankedByDeficit.filter((t) => t !== preferredType)]
        : rankedByDeficit;

    return [...order, ...typesByFrontageAsc.filter((t) => !order.includes(t))];
  }

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
    return yStart + spec.frontageWidthM * blockSize + sideGapM;
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
    const typeOrder = draftMode ? [preferredType] : orderTypesForMixTolerance(preferredType, state.plots);

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
  let topology: "double" | "single-left" | "single-right" | "frontage-ribbon" | "none" = "double";
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

  // --- Frontage ribbon: fallback tried ONLY when the estate-road
  // topologies (double/single-left/single-right) place nothing. Instead
  // of a NEW road running into the site with plots flanking it, plots
  // front directly onto the EXISTING boundary edge the entrance sits
  // on — no new carriageway, no turning head (nothing dead-ends; access
  // is along the whole frontage, same as any infill plot on an existing
  // street). This is for sites too narrow/shallow for a new road PLUS a
  // row of plots behind it, but wide enough along the entrance edge
  // itself to hold a row of plots fronting it directly.
  //
  // Deliberately self-contained rather than reusing tryPlaceOnSide/
  // fitsBlockAt above: those assume a ROAD at local X=0 with plots
  // stacking along Y and depth along X. Frontage ribbon has no road at
  // all — plots stack along X (the entrance edge's own direction) with
  // depth along Y — a 90-degree swap of which axis is which, not a
  // variation the existing left/right placement functions can express
  // without their own road-centred assumptions leaking through (e.g.
  // plotSideLocal's left/right split below is an X-sign test that only
  // means "which side of the road" when a road actually runs along
  // X=0). Builds its own compliance list and returns directly via
  // finalize() rather than falling through to the estate-road compliance
  // block further down, which checks things that don't apply here
  // (turning head, road width, a road for frontage/entrance-connection
  // checks) the same way the erosion-invalid early return above does.
  const ribbon = topology === "none" ? tryFrontageRibbon() : null;

  // --- Branching spurs: tried ALONGSIDE every topology above (not just
  // as a last-resort fallback), since a site wide enough can fit more
  // homes behind a spine-and-spurs layout than a single ribbon ever
  // could, even when the ribbon itself succeeds. The engine keeps
  // whichever of the three candidates — ribbon/single-sided (`state`),
  // frontage-ribbon (`ribbon`), or branching (`branching`) — places the
  // most homes; every candidate only ever places plots that already
  // pass every hard rule, so "most homes" and "most compliant homes"
  // are the same thing here. See tryBranchingSpurs below for the
  // topology itself and why its spur spacing guarantees back-to-back by
  // construction (independently re-verified in its own compliance list,
  // not just assumed).
  const branching = tryBranchingSpurs();

  const stateUnits = state.plots.length;
  const ribbonUnits = ribbon?.plots.length ?? 0;
  const branchingUnits = branching?.plots.length ?? 0;

  if (branching && branchingUnits > stateUnits && branchingUnits > ribbonUnits) {
    return finalize(
      { plots: branching.plots, roads: branching.roads, parkingSpacesBng: branching.parkingSpacesLocal.map(toWorld) },
      branching.compliance,
      boundaryAreaM2,
      inputs,
      jurisdiction,
      t0,
      "branching-spurs",
      null,
      { percent: nonHousingReservePercent, source: nonHousingReserveSource }
    );
  }

  if (ribbon && ribbonUnits > 0 && ribbonUnits >= branchingUnits) {
    return finalize(
      { plots: ribbon.plots, roads: [], parkingSpacesBng: ribbon.parkingSpacesLocal.map(toWorld) },
      ribbon.compliance,
      boundaryAreaM2,
      inputs,
      jurisdiction,
      t0,
      "frontage-ribbon",
      null,
      { percent: nonHousingReservePercent, source: nonHousingReserveSource }
    );
  }

  interface FrontageRibbonResult {
    plots: PlacedPlot[];
    parkingSpacesLocal: BNGPoint[];
    compliance: ComplianceCheck[];
  }

  /**
   * Finds the entrance edge's own extent in LOCAL coordinates. The
   * entrance edge lies exactly along local Y=0 by construction (toLocal
   * rotates the whole boundary so the entrance's own edge tangent maps
   * to the X axis) — so the edge containing (0,0) within the same
   * tolerance entranceEdgeFrame uses is the one to find, and both its
   * endpoints are already at y≈0.
   */
  function findEntranceEdgeLocalXRange(): { minX: number; maxX: number } | null {
    const n = localBoundary.length;
    for (let i = 0; i < n; i++) {
      const a = localBoundary[i];
      const b = localBoundary[(i + 1) % n];
      if (geo.distancePointToSegment([0, 0], a, b) <= 0.5) {
        return { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]) };
      }
    }
    return null;
  }

  function tryFrontageRibbon(): FrontageRibbonResult | null {
    const edgeRange = findEntranceEdgeLocalXRange();
    if (!edgeRange) return null;

    // Plots front at yFront, BOUNDARY_OFFSET_M in from the existing
    // edge — the same no-build setback every other part of the site
    // boundary already requires. There's no "road is allowed to meet
    // the boundary" exception here (see the erosion comment near the
    // top of this function): nothing new crosses the boundary: the
    // plots themselves simply front onto it, same as any plot on any
    // other edge respects the offset from ITS nearest boundary.
    const yFront = rules.BOUNDARY_OFFSET_M;
    const maxX = edgeRange.maxX - rules.BOUNDARY_OFFSET_M;
    let cursorX = edgeRange.minX + rules.BOUNDARY_OFFSET_M;
    let cycleIndex = 0;
    let plotCounter = 0;
    let blockCounter = 0;
    const plots: PlacedPlot[] = [];
    const parkingSpacesLocal: BNGPoint[] = [];

    function buildFrontageRect(xStart: number, xEnd: number, yStart: number, yEnd: number): BNGPolygon {
      return [
        [xStart, yStart],
        [xEnd, yStart],
        [xEnd, yEnd],
        [xStart, yEnd],
      ];
    }

    function fitsFrontageBlockAt(houseType: HouseTypeId, blockSize: number, xStart: number): { fits: boolean; spec: PlotSpec } {
      const spec = computePlotSpec(houseType);
      const blockWidth = spec.frontageWidthM * blockSize;
      if (xStart + blockWidth > maxX) return { fits: false, spec };
      for (let u = 0; u < blockSize; u++) {
        const uStart = xStart + u * spec.frontageWidthM;
        const uEnd = uStart + spec.frontageWidthM;
        if (!geo.convexPolygonFullyInside(buildFrontageRect(uStart, uEnd, yFront, yFront + spec.totalDepthM), erodedLocal)) {
          return { fits: false, spec };
        }
      }
      return { fits: true, spec };
    }

    function placeFrontageUnit(xStart: number, xEnd: number, spec: PlotSpec, blockId: string, blockPosition: number, blockSize: number) {
      const driveY = yFront + spec.drivewayDepthM;
      const houseY = driveY + spec.footprintDepthM;
      const rearY = yFront + spec.totalDepthM;

      plotCounter += 1;
      plots.push({
        id: `plot-${plotCounter}`,
        houseType: spec.houseType,
        plotBng: buildFrontageRect(xStart, xEnd, yFront, rearY).map(toWorld),
        footprintBng: buildFrontageRect(xStart, xEnd, driveY, houseY).map(toWorld),
        gardenBng: buildFrontageRect(xStart, xEnd, houseY, rearY).map(toWorld),
        giaM2: spec.giaM2,
        blockId,
        blockPosition,
        blockSize,
      });

      const spacesNeeded = Math.max(1, Math.round(parkingRatio));
      const spaceWidth = (xEnd - xStart) / spacesNeeded;
      for (let s = 0; s < spacesNeeded; s++) {
        parkingSpacesLocal.push([xStart + spaceWidth * (s + 0.5), yFront + spec.drivewayDepthM / 2]);
      }
    }

    // Same probe-forward structure as tryPlaceOnSide above: try every
    // type/block-size at the current position before stepping forward,
    // so a gap a smaller type would fill is never skipped over.
    function tryPlaceFrontageUnit(): boolean {
      const preferredType = mixCycle[cycleIndex % mixCycle.length];
      const typeOrder = draftMode ? [preferredType] : orderTypesForMixTolerance(preferredType, plots);
      for (let xStart = cursorX; xStart < maxX; xStart += PROBE_STEP_M) {
        for (const houseType of typeOrder) {
          for (let blockSize = rules.MAX_BLOCK_UNITS[houseType]; blockSize >= 1; blockSize--) {
            const check = fitsFrontageBlockAt(houseType, blockSize, xStart);
            if (check.fits) {
              blockCounter += 1;
              const blockId = `block-${blockCounter}`;
              for (let u = 0; u < blockSize; u++) {
                const uStart = xStart + u * check.spec.frontageWidthM;
                const uEnd = uStart + check.spec.frontageWidthM;
                placeFrontageUnit(uStart, uEnd, check.spec, blockId, u, blockSize);
              }
              cursorX = xStart + check.spec.frontageWidthM * blockSize + sideGapM;
              cycleIndex += 1;
              return true;
            }
          }
        }
      }
      return false;
    }

    let progress = true;
    while (progress) progress = tryPlaceFrontageUnit();

    if (plots.length === 0) return null;

    // --- Frontage ribbon's own compliance list — simpler than the
    // estate-road one above (no turning head, no road width, no
    // left/right split to check back-to-back against — a single row
    // facing one direction can never face itself), but genuinely
    // independent, not assumed from placement succeeding. Same check
    // ids as the estate-road block where the concept is identical
    // (ndss-gia, garden-depth, parking, block-length,
    // attached-share-wall, no-wasted-gaps, plots-inside-boundary,
    // no-overlaps), so downstream consumers (the UI's plain-English
    // labels, the "no compliance green on a violation" cross-check in
    // scripts/invariants.ts) don't need a second code path to read
    // them. ---
    const fbCompliance: ComplianceCheck[] = [];

    fbCompliance.push({
      id: "topology",
      label: "Road/plot topology used",
      status: "pass",
      ruleRef: "v0 fallback: no new estate road — plots front the existing boundary edge directly",
      detail: `Frontage ribbon: ${plots.length} plot(s) front directly onto the existing edge at the entrance, no new estate road built.`,
    });

    const frontageEdgeSegLocal: [BNGPoint, BNGPoint] = [
      [edgeRange.minX, 0],
      [edgeRange.maxX, 0],
    ];
    const frontageOk = plots.every((p) => {
      const localRect = p.plotBng.map(toLocal);
      const frontMidLocal: BNGPoint = [
        (Math.min(...localRect.map((pt) => pt[0])) + Math.max(...localRect.map((pt) => pt[0]))) / 2,
        Math.min(...localRect.map((pt) => pt[1])),
      ];
      return Math.abs(geo.distancePointToSegment(frontMidLocal, frontageEdgeSegLocal[0], frontageEdgeSegLocal[1]) - rules.BOUNDARY_OFFSET_M) <= 1e-2;
    });
    fbCompliance.push({
      id: "plot-frontage",
      label: "Every plot has road frontage",
      status: frontageOk ? "pass" : "fail",
      ruleRef: "Brief requirement — every plot must front the access road (here, the existing street at the entrance edge)",
      detail: frontageOk
        ? `${plots.length} plot(s) all front the existing edge, ${rules.BOUNDARY_OFFSET_M}m in from the boundary.`
        : "At least one plot does not front the existing edge correctly.",
    });

    fbCompliance.push({
      id: "road-connects-entrance",
      label: "Road connects to entrance",
      status: "pass",
      ruleRef: "Brief requirement — road-to-entrance connector",
      detail: "No new road is built — the entrance sits directly on the frontage edge every plot fronts.",
    });

    const allInsideErosion = plots.every((p) => geo.convexPolygonFullyInside(p.plotBng.map(toLocal), erodedLocal));
    fbCompliance.push({
      id: "plots-inside-boundary",
      label: "All plots inside boundary, clear of setbacks",
      status: allInsideErosion ? "pass" : "fail",
      ruleRef: `Boundary + ${rules.BOUNDARY_OFFSET_M}m offset`,
      detail: allInsideErosion
        ? `${plots.length} plot(s) all confirmed within the eroded boundary.`
        : "At least one plot's footprint/garden falls outside the eroded boundary.",
    });

    let overlapFound = false;
    outerFb: for (let i = 0; i < plots.length; i++) {
      for (let j = i + 1; j < plots.length; j++) {
        if (geo.convexPolygonsOverlap(plots[i].plotBng.map(toLocal), plots[j].plotBng.map(toLocal))) {
          overlapFound = true;
          break outerFb;
        }
      }
    }
    fbCompliance.push({
      id: "no-overlaps",
      label: "No overlaps between plots, road and parking",
      status: overlapFound ? "fail" : "pass",
      ruleRef: "Brief requirement — geometric non-overlap",
      detail: overlapFound ? "At least one pair of plots overlap." : `${plots.length} plot(s) checked pairwise — no overlaps.`,
    });

    const fbBlockGroups = new Map<string, PlacedPlot[]>();
    for (const p of plots) {
      const group = fbBlockGroups.get(p.blockId) ?? [];
      group.push(p);
      fbBlockGroups.set(p.blockId, group);
    }
    let fbBlockLengthOk = true;
    let fbBlockLengthDetail = "";
    for (const [blockId, group] of fbBlockGroups) {
      const houseType = group[0].houseType;
      const maxAllowed = rules.MAX_BLOCK_UNITS[houseType];
      const sameType = group.every((p) => p.houseType === houseType);
      if (!sameType || group.length > maxAllowed || group.length !== group[0].blockSize) {
        fbBlockLengthOk = false;
        fbBlockLengthDetail = `Block ${blockId}: ${group.length} unit(s) of ${houseType} (max ${maxAllowed}).`;
        break;
      }
    }
    fbCompliance.push({
      id: "block-length",
      label: "Attached block length cap",
      status: fbBlockLengthOk ? "pass" : "fail",
      ruleRef: "rules.ts MAX_BLOCK_UNITS (terrace configurable; semi=2 and detached=1 by definition)",
      detail: fbBlockLengthOk ? `${fbBlockGroups.size} block(s), all within their house type's cap.` : fbBlockLengthDetail,
    });

    let fbAttachedOk = true;
    let fbAttachedDetail = "";
    outerFbBlocks: for (const [blockId, group] of fbBlockGroups) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => a.blockPosition - b.blockPosition);
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = geo.minDistanceBetweenPolygons(sorted[i].footprintBng, sorted[i + 1].footprintBng);
        if (gap > 1e-3) {
          fbAttachedOk = false;
          fbAttachedDetail = `Block ${blockId}: units ${sorted[i].id} and ${sorted[i + 1].id} are ${gap.toFixed(2)}m apart, not sharing a wall.`;
          break outerFbBlocks;
        }
      }
    }
    fbCompliance.push({
      id: "attached-share-wall",
      label: "Attached units genuinely share a wall",
      status: fbAttachedOk ? "pass" : "fail",
      ruleRef: "Brief requirement — terrace/semi units must be structurally adjacent, not just nearby",
      detail: fbAttachedOk ? "Every multi-unit block's consecutive footprints touch with zero gap." : fbAttachedDetail,
    });

    const fbSortedBlocks = [...fbBlockGroups.values()]
      .map((group) => {
        const xs = group.flatMap((p) => p.plotBng.map(toLocal).map((pt) => pt[0]));
        return { blockId: group[0].blockId, xStart: Math.min(...xs), xEnd: Math.max(...xs) };
      })
      .sort((a, b) => a.xStart - b.xStart);
    let fbWastedGapFound = false;
    let fbWastedGapDetail = "";
    for (let i = 0; i < fbSortedBlocks.length - 1; i++) {
      const gap = fbSortedBlocks[i + 1].xStart - fbSortedBlocks[i].xEnd;
      const maxReasonableGap = sideGapM + smallestFrontageWidthM + PROBE_STEP_M;
      if (gap > maxReasonableGap) {
        fbWastedGapFound = true;
        fbWastedGapDetail = `Between ${fbSortedBlocks[i].blockId} and ${fbSortedBlocks[i + 1].blockId}: ${gap.toFixed(1)}m gap — room for another ${smallestFrontageWidthM.toFixed(1)}m-wide unit plus its side gap.`;
      }
    }
    fbCompliance.push({
      id: "no-wasted-gaps",
      label: "No gap large enough for a smaller unit to fit",
      status: fbWastedGapFound ? "fail" : "pass",
      ruleRef: "Brief requirement — backtrack to a smaller type before leaving a gap empty",
      detail: fbWastedGapFound ? fbWastedGapDetail : "No gap between blocks is large enough to have fit another unit.",
    });

    const fbNdssFailingIds = plots.filter((p) => p.giaM2 < ndssMinGia[p.houseType] - 1e-6).map((p) => p.id);
    fbCompliance.push({
      id: "ndss-gia",
      label: "NDSS minimum GIA",
      status: fbNdssFailingIds.length === 0 ? "pass" : "fail",
      ruleRef: "DCLG, NDSS, March 2015, Table 1",
      detail:
        fbNdssFailingIds.length === 0
          ? marketSizeUpliftPercent > 0
            ? `Every plot's GIA is set to its NDSS minimum plus ${jurisdiction.localAuthority}'s sourced typical-market-size uplift (+${marketSizeUpliftPercent}%) — still built at a fixed target per type, not a range.`
            : (inputs.tenure ?? "market") === "social"
              ? "Every plot's GIA is set to exactly its NDSS minimum — tenure is set to \"social\": real RSL-led schemes typically build at the space-standard floor, so no market-size uplift is applied here even though the jurisdiction has one sourced."
              : "Every plot's GIA is set to exactly its NDSS minimum for its house type (v0 builds at the floor, not above it)."
          : `${fbNdssFailingIds.length} plot(s) below their NDSS minimum GIA.`,
      affectedPlotIds: fbNdssFailingIds,
    });

    const fbGardenFailingIds = plots.filter((p) => {
      const localGarden = p.gardenBng!.map(toLocal);
      const ys = localGarden.map((pt) => pt[1]);
      return Math.max(...ys) - Math.min(...ys) < gardenDepthM - 1e-6;
    }).map((p) => p.id);
    fbCompliance.push({
      id: "garden-depth",
      label: "Minimum garden depth",
      status: fbGardenFailingIds.length === 0 ? "pass" : "fail",
      ruleRef: `Brief default ${gardenDepthM}m`,
      detail:
        fbGardenFailingIds.length === 0
          ? `Every plot's garden is at least ${gardenDepthM}m deep.`
          : `${fbGardenFailingIds.length} plot(s) have a garden shallower than the minimum.`,
      affectedPlotIds: fbGardenFailingIds,
    });

    // Back-to-back: a single row, all facing the same direction (away
    // from the shared frontage edge, toward the site's interior) can
    // never face another row — there isn't one. Same honest "nothing to
    // violate" framing the estate-road single-sided case already uses,
    // not a validated guarantee for a layout with two rows.
    fbCompliance.push({
      id: "back-to-back",
      label: `${backToBackM}m back-to-back distance`,
      status: "pass",
      ruleRef: `Brief default ${backToBackM}m (Essex Design Guide, 1973, convention)`,
      detail: "Frontage ribbon is a single row facing one direction — no second row exists for it to face, nothing to violate.",
    });

    const fbParkingFailingIds = plots.filter((p) => computePlotSpec(p.houseType).frontageWidthM < parkingRatio * rules.PARKING_SPACE_WIDTH_M - 1e-6).map((p) => p.id);
    fbCompliance.push({
      id: "parking",
      label: `Parking (${parkingRatio}/unit)`,
      status: fbParkingFailingIds.length === 0 ? "pass" : "fail",
      ruleRef: `v0 default ${rules.PARKING_SPACES_PER_UNIT}/unit (common UK local parking SPD figure, editable)`,
      detail:
        fbParkingFailingIds.length === 0
          ? "Every plot's frontage is sized to fit its required parking."
          : `${fbParkingFailingIds.length} plot(s) are narrower than their required parking allocation.`,
      affectedPlotIds: fbParkingFailingIds,
    });

    fbCompliance.push({
      id: "fire-access",
      label: "Fire/refuse appliance access",
      status: "pass",
      ruleRef: `Approved Document B / common ${rules.MAX_FIRE_ACCESS_DISTANCE_M}m hose-run convention`,
      detail: "Every plot fronts directly onto the existing edge, so frontage-to-access distance is 0m for all plots.",
    });

    return { plots, parkingSpacesLocal, compliance: fbCompliance };
  }

  interface BranchingResult {
    plots: PlacedPlot[];
    roads: RoadSegment[];
    parkingSpacesLocal: BNGPoint[];
    compliance: ComplianceCheck[];
  }

  /**
   * Branching topology: a central spine road running straight in from the
   * entrance (same direction/position as the estate-road ribbon above —
   * local X=0 — but carrying no frontage of its own, pure circulation),
   * with spur cul-de-sacs branching off it perpendicular at intervals,
   * each ending in its own turning head, plots fronting both sides of
   * each spur. Gibbas Way's own real layout is exactly this shape
   * (a spine — "Spire Road" on its own drainage-strategy drawing — with
   * three spur cul-de-sacs off an existing access spur).
   *
   * Deliberately self-contained, like tryFrontageRibbon above, rather
   * than a generalisation of tryPlaceOnSide/fitsBlockAt: a spur's own
   * "along" axis is the MAIN frame's X (perpendicular to the spine), and
   * its "depth" axis is the main frame's Y — a 90-degree swap per spur,
   * and a different swap for every spur at a different spine position,
   * which the single fixed road-at-X=0 assumption baked into the
   * estate-road functions can't express.
   *
   * Spur spacing is set, not guessed: two spurs on the SAME side of the
   * spine (same dirX) must sit far enough apart, centre-to-centre, that
   * their outward-facing plot rows (each up to `largestTotalDepthM`
   * deep, plus the spur's OWN road corridor on each side of its
   * centreline — a plot's rear sits at `roadHalfWidth + totalDepthM`
   * from its spur's originY, not just `totalDepthM`) can never come
   * closer than `backToBackM` — this is exactly how the estate-road
   * ribbon's own rows stay compliant by construction (always backing
   * onto the outer boundary, never onto another row), just applied
   * between spurs instead. The back-to-back compliance check below
   * still measures the ACTUAL placed geometry pairwise, not just this
   * spacing formula — confirmed via the fuzz/fixture harness to catch a
   * real version of this formula that omitted the road-corridor term
   * (2.0m short of the requirement on a real fixture), not assumed safe.
   */
  function tryBranchingSpurs(): BranchingResult | null {
    const largestTotalDepthM = Math.max(...HOUSE_TYPES.map((t) => computePlotSpec(t).totalDepthM));
    const spurSpacingM = 2 * (roadHalfWidth + largestTotalDepthM) + backToBackM;

    const allPlots: PlacedPlot[] = [];
    const allParkingLocal: BNGPoint[] = [];
    const spurRoadsLocal: { originY: number; dirX: 1 | -1; lengthU: number }[] = [];
    const sideBlockExtents = new Map<string, { blockId: string; uStart: number; uEnd: number }[]>();
    let plotCounter = 0;
    let blockCounter = 0;

    // Maps a spur's own (along-spur, across-spur) coordinate to this
    // function's main local (X,Y) frame. u=0 sits exactly at the spine's
    // own edge (so the spur road touches the spine road with zero gap,
    // not an overlap); u increases away from the spine in direction
    // dirX. v=0 sits on the spur's own centreline at originY.
    function spurToMain(u: number, v: number, originY: number, dirX: 1 | -1): BNGPoint {
      return [dirX * (roadHalfWidth + u), originY + v];
    }

    function spurRectMain(
      side: "north" | "south",
      frontageV: number,
      rearV: number,
      uStart: number,
      uEnd: number,
      originY: number,
      dirX: 1 | -1
    ): BNGPolygon {
      const uv: [number, number][] =
        side === "north"
          ? [[uStart, frontageV], [uEnd, frontageV], [uEnd, rearV], [uStart, rearV]]
          : [[uStart, frontageV], [uStart, rearV], [uEnd, rearV], [uEnd, frontageV]];
      return uv.map(([u, v]) => spurToMain(u, v, originY, dirX));
    }

    function trySpur(originY: number, dirX: 1 | -1): { plots: PlacedPlot[]; lengthU: number } | null {
      const half = turningHeadSide / 2;
      function turningHeadFitsAtU(u: number): boolean {
        const offsetStep = 2;
        for (let offset = -half; offset <= half; offset += offsetStep) {
          const square: BNGPolygon = [
            spurToMain(u, offset - half, originY, dirX),
            spurToMain(u, offset + half, originY, dirX),
            spurToMain(u + turningHeadSide, offset + half, originY, dirX),
            spurToMain(u + turningHeadSide, offset - half, originY, dirX),
          ];
          if (geo.convexPolygonFullyInside(square, localBoundary)) return true;
        }
        return false;
      }

      const xsLocal = localBoundary.map((p) => p[0]);
      const maxXExtent = dirX < 0 ? -Math.min(...xsLocal) : Math.max(...xsLocal);
      const naiveUCeiling = maxXExtent - roadHalfWidth - turningHeadSide;
      let maxU = 0;
      let headFits = false;
      for (let u = Math.max(0, naiveUCeiling); u >= 0; u -= PROBE_STEP_M) {
        if (turningHeadFitsAtU(u)) {
          maxU = u;
          headFits = true;
          break;
        }
      }
      if (!headFits) return null;

      const spurPlots: PlacedPlot[] = [];
      let cursorNorth = 0;
      let cursorSouth = 0;
      let cycleIndexNorth = 0;
      let cycleIndexSouth = 0;

      function fitsSpurBlockAt(
        side: "north" | "south",
        houseType: HouseTypeId,
        blockSize: number,
        uStart: number
      ): { fits: boolean; frontageV: number; rearV: number; spec: PlotSpec } {
        const spec = computePlotSpec(houseType);
        const frontageV = side === "north" ? roadHalfWidth : -roadHalfWidth;
        const rearV = side === "north" ? frontageV + spec.totalDepthM : frontageV - spec.totalDepthM;
        const blockLength = spec.frontageWidthM * blockSize;
        if (uStart + blockLength > maxU) return { fits: false, frontageV, rearV, spec };
        for (let b = 0; b < blockSize; b++) {
          const bStart = uStart + b * spec.frontageWidthM;
          const bEnd = bStart + spec.frontageWidthM;
          if (!geo.convexPolygonFullyInside(spurRectMain(side, frontageV, rearV, bStart, bEnd, originY, dirX), erodedLocal)) {
            return { fits: false, frontageV, rearV, spec };
          }
        }
        return { fits: true, frontageV, rearV, spec };
      }

      function placeSpurUnit(
        side: "north" | "south",
        spec: PlotSpec,
        frontageV: number,
        rearV: number,
        uStart: number,
        uEnd: number,
        blockId: string,
        blockPosition: number,
        blockSize: number
      ) {
        const driveV = side === "north" ? frontageV + spec.drivewayDepthM : frontageV - spec.drivewayDepthM;
        const houseV = side === "north" ? driveV + spec.footprintDepthM : driveV - spec.footprintDepthM;

        plotCounter += 1;
        const plot: PlacedPlot = {
          id: `branch-plot-${plotCounter}`,
          houseType: spec.houseType,
          plotBng: spurRectMain(side, frontageV, rearV, uStart, uEnd, originY, dirX).map(toWorld),
          footprintBng: spurRectMain(side, driveV, houseV, uStart, uEnd, originY, dirX).map(toWorld),
          gardenBng: spurRectMain(side, houseV, rearV, uStart, uEnd, originY, dirX).map(toWorld),
          giaM2: spec.giaM2,
          blockId,
          blockPosition,
          blockSize,
        };
        spurPlots.push(plot);
        allPlots.push(plot);

        const spacesNeeded = Math.max(1, Math.round(parkingRatio));
        const spaceWidth = spec.frontageWidthM / spacesNeeded;
        const driveMidV = side === "north" ? frontageV + spec.drivewayDepthM / 2 : frontageV - spec.drivewayDepthM / 2;
        for (let s = 0; s < spacesNeeded; s++) {
          const centerU = uStart + spaceWidth * (s + 0.5);
          allParkingLocal.push(spurToMain(centerU, driveMidV, originY, dirX));
        }
      }

      function tryPlaceSpurSide(side: "north" | "south"): boolean {
        const cursor = side === "north" ? cursorNorth : cursorSouth;
        const cycleIndex = side === "north" ? cycleIndexNorth : cycleIndexSouth;
        const preferredType = mixCycle[cycleIndex % mixCycle.length];
        const typeOrder = draftMode ? [preferredType] : orderTypesForMixTolerance(preferredType, allPlots);
        for (let uStart = cursor; uStart < maxU; uStart += PROBE_STEP_M) {
          for (const houseType of typeOrder) {
            for (let blockSize = rules.MAX_BLOCK_UNITS[houseType]; blockSize >= 1; blockSize--) {
              const check = fitsSpurBlockAt(side, houseType, blockSize, uStart);
              if (check.fits) {
                blockCounter += 1;
                const blockId = `branch-block-${blockCounter}`;
                for (let b = 0; b < blockSize; b++) {
                  const bStart = uStart + b * check.spec.frontageWidthM;
                  const bEnd = bStart + check.spec.frontageWidthM;
                  placeSpurUnit(side, check.spec, check.frontageV, check.rearV, bStart, bEnd, blockId, b, blockSize);
                }
                const blockEnd = uStart + check.spec.frontageWidthM * blockSize;
                const key = `${originY}-${dirX}-${side}`;
                const list = sideBlockExtents.get(key) ?? [];
                list.push({ blockId, uStart, uEnd: blockEnd });
                sideBlockExtents.set(key, list);
                const newCursor = blockEnd + sideGapM;
                if (side === "north") {
                  cursorNorth = newCursor;
                  cycleIndexNorth += 1;
                } else {
                  cursorSouth = newCursor;
                  cycleIndexSouth += 1;
                }
                return true;
              }
            }
          }
        }
        return false;
      }

      let progress = true;
      while (progress) {
        const n = tryPlaceSpurSide("north");
        const s = tryPlaceSpurSide("south");
        progress = n || s;
      }

      if (spurPlots.length === 0) return null;
      return { plots: spurPlots, lengthU: maxU };
    }

    // Spine junctions, evenly spaced along Y starting half a spacing
    // interval in (so the spacing guarantee above also covers the gap
    // between the first junction and the entrance, even though nothing
    // there needs it). A generous but bounded cap guards against a
    // pathological, very long/narrow boundary looping excessively —
    // real UK sites this engine targets don't need anywhere near this
    // many spurs off one spine.
    const MAX_JUNCTIONS = 12;
    let junctionsTried = 0;
    for (let y = spurSpacingM / 2; y < maxBoundaryY && junctionsTried < MAX_JUNCTIONS; y += spurSpacingM, junctionsTried++) {
      for (const dirX of [-1, 1] as const) {
        const spur = trySpur(y, dirX);
        if (spur) {
          spurRoadsLocal.push({ originY: y, dirX, lengthU: spur.lengthU });
        }
      }
    }

    if (allPlots.length === 0) return null;

    const ySpineEnd = Math.max(...spurRoadsLocal.map((s) => s.originY), 0) + roadHalfWidth;
    const spineRectLocal: BNGPolygon = [
      [-roadHalfWidth, 0],
      [roadHalfWidth, 0],
      [roadHalfWidth, ySpineEnd],
      [-roadHalfWidth, ySpineEnd],
    ];
    const spurRectsLocal: BNGPolygon[] = spurRoadsLocal.map((s) => [
      spurToMain(0, -roadHalfWidth, s.originY, s.dirX),
      spurToMain(0, roadHalfWidth, s.originY, s.dirX),
      spurToMain(s.lengthU + turningHeadSide, roadHalfWidth, s.originY, s.dirX),
      spurToMain(s.lengthU + turningHeadSide, -roadHalfWidth, s.originY, s.dirX),
    ]);
    const allRoadRectsLocal = [spineRectLocal, ...spurRectsLocal];

    const roads: RoadSegment[] = [
      { id: "spine", centerlineBng: ([[0, 0], [0, ySpineEnd]] as BNGPolygon).map(toWorld), widthM: rules.ROAD_WIDTH_M },
      ...spurRoadsLocal.map((s, i) => ({
        id: `spur-${i + 1}`,
        centerlineBng: ([spurToMain(0, 0, s.originY, s.dirX), spurToMain(s.lengthU + turningHeadSide, 0, s.originY, s.dirX)] as BNGPolygon).map(
          toWorld
        ),
        widthM: rules.ROAD_WIDTH_M,
      })),
    ];

    // --- Compliance list, self-contained (mirrors the estate-road block
    // further below, generalised from one road segment to N) ---
    const branchCompliance: ComplianceCheck[] = [];

    branchCompliance.push({
      id: "topology",
      label: "Road/plot topology used",
      status: "pass",
      ruleRef: "v0: central spine + spur cul-de-sacs, each with its own turning head — tried alongside the single-ribbon and frontage-ribbon topologies, kept when it places more homes",
      detail: `Branching: ${spurRoadsLocal.length} spur(s) off a central spine, ${allPlots.length} plot(s) total.`,
    });

    const frontageOk = allPlots.every((p) =>
      allRoadRectsLocal.some((r) => geo.minDistanceBetweenPolygons(p.plotBng.map(toLocal), r) <= 1e-2)
    );
    branchCompliance.push({
      id: "plot-frontage",
      label: "Every plot has road frontage",
      status: frontageOk ? "pass" : "fail",
      ruleRef: "Brief requirement — every plot must front the access road (here, its own spur)",
      detail: frontageOk
        ? `${allPlots.length} plot(s) all touch their own spur's road corridor.`
        : "At least one plot does not touch any road corridor.",
    });

    const roadConnectsEntrance = geo.pointInPolygon([0, 0], spineRectLocal);
    branchCompliance.push({
      id: "road-connects-entrance",
      label: "Road connects to entrance",
      status: roadConnectsEntrance ? "pass" : "fail",
      ruleRef: "Brief requirement — road-to-entrance connector",
      detail: roadConnectsEntrance
        ? "The spine starts exactly at the supplied entrance point; every spur connects to the spine."
        : "The spine does not reach the entrance point.",
    });

    const allInsideErosion = allPlots.every((p) => geo.convexPolygonFullyInside(p.plotBng.map(toLocal), erodedLocal));
    branchCompliance.push({
      id: "plots-inside-boundary",
      label: "All plots inside boundary, clear of setbacks",
      status: allInsideErosion ? "pass" : "fail",
      ruleRef: `Boundary + ${rules.BOUNDARY_OFFSET_M}m offset`,
      detail: allInsideErosion
        ? `${allPlots.length} plot(s) all confirmed within the eroded boundary.`
        : "At least one plot's footprint/garden falls outside the eroded boundary.",
    });

    let overlapFound = false;
    outerBranch: for (let i = 0; i < allPlots.length; i++) {
      const rectI = allPlots[i].plotBng.map(toLocal);
      for (const r of allRoadRectsLocal) {
        if (geo.convexPolygonsOverlap(rectI, r)) {
          overlapFound = true;
          break outerBranch;
        }
      }
      for (let j = i + 1; j < allPlots.length; j++) {
        if (geo.convexPolygonsOverlap(rectI, allPlots[j].plotBng.map(toLocal))) {
          overlapFound = true;
          break outerBranch;
        }
      }
    }
    branchCompliance.push({
      id: "no-overlaps",
      label: "No overlaps between plots, road and parking",
      status: overlapFound ? "fail" : "pass",
      ruleRef: "Brief requirement — geometric non-overlap",
      detail: overlapFound ? "At least one pair of plots/road overlap." : `${allPlots.length} plot(s) and every road segment checked pairwise — no overlaps.`,
    });

    const branchBlockGroups = new Map<string, PlacedPlot[]>();
    for (const p of allPlots) {
      const group = branchBlockGroups.get(p.blockId) ?? [];
      group.push(p);
      branchBlockGroups.set(p.blockId, group);
    }
    let blockLengthOk = true;
    let blockLengthDetail = "";
    for (const [blockId, group] of branchBlockGroups) {
      const houseType = group[0].houseType;
      const maxAllowed = rules.MAX_BLOCK_UNITS[houseType];
      const sameType = group.every((p) => p.houseType === houseType);
      if (!sameType || group.length > maxAllowed || group.length !== group[0].blockSize) {
        blockLengthOk = false;
        blockLengthDetail = `Block ${blockId}: ${group.length} unit(s) of ${houseType} (max ${maxAllowed}).`;
        break;
      }
    }
    branchCompliance.push({
      id: "block-length",
      label: "Attached block length cap",
      status: blockLengthOk ? "pass" : "fail",
      ruleRef: "rules.ts MAX_BLOCK_UNITS (terrace configurable; semi=2 and detached=1 by definition)",
      detail: blockLengthOk ? `${branchBlockGroups.size} block(s), all within their house type's cap.` : blockLengthDetail,
    });

    let attachedOk = true;
    let attachedDetail = "";
    outerBranchBlocks: for (const [blockId, group] of branchBlockGroups) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => a.blockPosition - b.blockPosition);
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = geo.minDistanceBetweenPolygons(sorted[i].footprintBng, sorted[i + 1].footprintBng);
        if (gap > 1e-3) {
          attachedOk = false;
          attachedDetail = `Block ${blockId}: units ${sorted[i].id} and ${sorted[i + 1].id} are ${gap.toFixed(2)}m apart, not sharing a wall.`;
          break outerBranchBlocks;
        }
      }
    }
    branchCompliance.push({
      id: "attached-share-wall",
      label: "Attached units genuinely share a wall",
      status: attachedOk ? "pass" : "fail",
      ruleRef: "Brief requirement — terrace/semi units must be structurally adjacent, not just nearby",
      detail: attachedOk ? "Every multi-unit block's consecutive footprints touch with zero gap." : attachedDetail,
    });

    let wastedGapFound = false;
    let wastedGapDetail = "";
    for (const [key, list] of sideBlockExtents) {
      const sorted = [...list].sort((a, b) => a.uStart - b.uStart);
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1].uStart - sorted[i].uEnd;
        const maxReasonableGap = sideGapM + smallestFrontageWidthM + PROBE_STEP_M;
        if (gap > maxReasonableGap) {
          wastedGapFound = true;
          wastedGapDetail = `Spur/side ${key}, between ${sorted[i].blockId} and ${sorted[i + 1].blockId}: ${gap.toFixed(1)}m gap — room for another ${smallestFrontageWidthM.toFixed(1)}m-wide unit plus its side gap.`;
        }
      }
    }
    branchCompliance.push({
      id: "no-wasted-gaps",
      label: "No gap large enough for a smaller unit to fit",
      status: wastedGapFound ? "fail" : "pass",
      ruleRef: "Brief requirement — backtrack to a smaller type before leaving a gap empty",
      detail: wastedGapFound ? wastedGapDetail : "No gap between blocks is large enough to have fit another unit.",
    });

    const branchNdssFailingIds = allPlots.filter((p) => p.giaM2 < ndssMinGia[p.houseType] - 1e-6).map((p) => p.id);
    branchCompliance.push({
      id: "ndss-gia",
      label: "NDSS minimum GIA",
      status: branchNdssFailingIds.length === 0 ? "pass" : "fail",
      ruleRef: "DCLG, NDSS, March 2015, Table 1",
      detail:
        branchNdssFailingIds.length === 0
          ? marketSizeUpliftPercent > 0
            ? `Every plot's GIA is set to its NDSS minimum plus ${jurisdiction.localAuthority}'s sourced typical-market-size uplift (+${marketSizeUpliftPercent}%) — still built at a fixed target per type, not a range.`
            : (inputs.tenure ?? "market") === "social"
              ? "Every plot's GIA is set to exactly its NDSS minimum — tenure is set to \"social\": real RSL-led schemes typically build at the space-standard floor, so no market-size uplift is applied here even though the jurisdiction has one sourced."
              : "Every plot's GIA is set to exactly its NDSS minimum for its house type (v0 builds at the floor, not above it)."
          : `${branchNdssFailingIds.length} plot(s) below their NDSS minimum GIA.`,
      affectedPlotIds: branchNdssFailingIds,
    });

    // Garden depth, back-to-back and the plots' own outward ("rear")
    // normal are all computed directly from each PLOT's own placed
    // geometry (footprint→garden direction), not from a single global
    // road axis — unlike the estate-road ribbon, a branching layout has
    // no one road direction every plot shares (the spine runs one way,
    // each spur perpendicular to it), so this has to be genuinely
    // per-plot to mean anything.
    function plotCentroid(rect: BNGPolygon): BNGPoint {
      const xs = rect.map((p) => p[0]);
      const ys = rect.map((p) => p[1]);
      return [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
    }
    function plotOutwardNormal(p: PlacedPlot): BNGPoint {
      return geo.normalize(geo.sub(plotCentroid(p.gardenBng!), plotCentroid(p.footprintBng)));
    }
    function gardenDepthWorld(p: PlacedPlot): number {
      const normal = plotOutwardNormal(p);
      const projections = p.gardenBng!.map((pt) => geo.dot(pt, normal));
      return Math.max(...projections) - Math.min(...projections);
    }
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

    const branchGardenFailingIds = allPlots.filter((p) => gardenDepthWorld(p) < gardenDepthM - 1e-6).map((p) => p.id);
    branchCompliance.push({
      id: "garden-depth",
      label: "Minimum garden depth",
      status: branchGardenFailingIds.length === 0 ? "pass" : "fail",
      ruleRef: `Brief default ${gardenDepthM}m`,
      detail:
        branchGardenFailingIds.length === 0
          ? `Every plot's garden is at least ${gardenDepthM}m deep.`
          : `${branchGardenFailingIds.length} plot(s) have a garden shallower than the minimum.`,
      affectedPlotIds: branchGardenFailingIds,
    });

    let facingPairFound = false;
    let minFacingDistance = Infinity;
    for (let i = 0; i < allPlots.length; i++) {
      for (let j = i + 1; j < allPlots.length; j++) {
        const a = allPlots[i];
        const b = allPlots[j];
        const normalA = plotOutwardNormal(a);
        const normalB = plotOutwardNormal(b);
        const rearA = rearMidpoint(a, normalA);
        const rearB = rearMidpoint(b, normalB);
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
    const backToBackOk = !facingPairFound || minFacingDistance >= backToBackM - 1e-6;
    branchCompliance.push({
      id: "back-to-back",
      label: `${backToBackM}m back-to-back distance`,
      status: backToBackOk ? "pass" : "fail",
      ruleRef: `Brief default ${backToBackM}m (Essex Design Guide, 1973, convention)`,
      detail: facingPairFound
        ? `Closest facing pair is ${minFacingDistance.toFixed(1)}m apart (independently recomputed from each plot's own footprint→garden direction, not assumed from the spur spacing formula).`
        : "No two plots face each other — every facing pair's distance was checked directly, not assumed.",
    });

    const branchParkingFailingIds = allPlots
      .filter((p) => computePlotSpec(p.houseType).frontageWidthM < parkingRatio * rules.PARKING_SPACE_WIDTH_M - 1e-6)
      .map((p) => p.id);
    branchCompliance.push({
      id: "parking",
      label: `Parking (${parkingRatio}/unit)`,
      status: branchParkingFailingIds.length === 0 ? "pass" : "fail",
      ruleRef: `v0 default ${rules.PARKING_SPACES_PER_UNIT}/unit (common UK local parking SPD figure, editable)`,
      detail:
        branchParkingFailingIds.length === 0
          ? "Every plot's frontage is sized to fit its required parking."
          : `${branchParkingFailingIds.length} plot(s) are narrower than their required parking allocation.`,
      affectedPlotIds: branchParkingFailingIds,
    });

    branchCompliance.push({
      id: "fire-access",
      label: "Fire/refuse appliance access",
      status: "pass",
      ruleRef: `Approved Document B / common ${rules.MAX_FIRE_ACCESS_DISTANCE_M}m hose-run convention`,
      detail: "Every plot fronts directly onto its own spur road, so frontage-to-road distance is 0m for all plots.",
    });

    branchCompliance.push({
      id: "turning-head",
      label: "Turning head at road end",
      status: "pass",
      ruleRef: `Manual for Streets (DfT, 2007) — ~${rules.TURNING_HEAD_DIAMETER_M}m turning circle for a dead-end road`,
      detail: `${spurRoadsLocal.length} spur(s), each individually confirmed to fit a ${rules.TURNING_HEAD_DIAMETER_M}m turning head at its own dead end before any plot was placed on it.`,
    });

    branchCompliance.push({
      id: "road-width",
      label: "Road carriageway width",
      status: "pass",
      ruleRef: `Manual for Streets (DfT, 2007) — ${rules.ROAD_WIDTH_M}m minimum used as v0 default`,
      detail: `Spine and every spur modelled at a constant ${rules.ROAD_WIDTH_M}m width.`,
    });

    return { plots: allPlots, roads, parkingSpacesLocal: allParkingLocal, compliance: branchCompliance };
  }

  const { plots, parkingSpacesLocal, cursorLeft, cursorRight } = state;

  // The road is fixed at local X=0 (it starts exactly at the entrance,
  // by construction — see toLocal above), so the question a single-sided
  // fit actually depends on is "how much room is there from X=0 to the
  // eroded boundary's edge, on whichever side has MORE of it" — not the
  // boundary's raw left-to-right width. The two can differ hugely when
  // the entrance sits off-centre along its own edge (common: an entrance
  // doesn't have to be at an edge's midpoint), which skews most of a
  // genuinely wide site's width to one side of X=0. Comparing against
  // raw width here was a real bug, not just an approximation: found via
  // scripts/fuzz-shapes.ts reporting sites with 200+m of eroded width
  // still as "frontage too narrow" — the width existed, just not
  // reachable from the fixed road position without crossing to a side
  // that had almost none.
  const erodedXs = erodedLocal.map((p) => p[0]);
  const erodedLeftExtentM = -Math.min(...erodedXs); // room from X=0 going left (more negative)
  const erodedRightExtentM = Math.max(...erodedXs); // room from X=0 going right
  const bestSideExtentM = Math.max(erodedLeftExtentM, erodedRightExtentM);
  const requiredSideDepthM = roadHalfWidth + smallestTotalDepthM;
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
            : `No topology fits any house type. The best side has ${bestSideExtentM.toFixed(1)}m of room from the road's centreline. Even the smallest unit needs half the road (${roadHalfWidth.toFixed(1)}m) + driveway/footprint/garden (${smallestTotalDepthM.toFixed(1)}m) = ${requiredSideDepthM.toFixed(1)}m — short by ${(requiredSideDepthM - bestSideExtentM).toFixed(1)}m.`,
  });

  // --- Zero-homes classification: ONLY meaningful when topology === "none"
  // (every other path places at least one plot). Checked in the order a
  // fix would actually need to address them — a site with nowhere for a
  // turning head can't be helped by more frontage width, so that's
  // checked first, not folded into the width message below it. ---
  let zeroHomesInfo: { cause: Metrics["zeroHomesCause"]; reason: string } | null = null;
  if (topology === "none") {
    if (maxPlotFrontageY <= 0) {
      zeroHomesInfo = {
        cause: "turning-head-no-fit",
        reason: `No room for the ${rules.TURNING_HEAD_DIAMETER_M}m turning circle a dead-end road needs — it doesn't fit anywhere along this boundary.`,
      };
    } else if (bestSideExtentM < requiredSideDepthM) {
      zeroHomesInfo = {
        cause: "frontage-too-narrow",
        reason: `Frontage is ${bestSideExtentM.toFixed(0)}m: a road and one plot need about ${requiredSideDepthM.toFixed(0)}m.`,
      };
    } else {
      // Both the turning-head fit and the aggregate side-depth checks
      // above passed, yet nothing got placed — the eroded buildable
      // area (after the non-housing reserve, see that computation near
      // the top of this function) doesn't have one single CONTIGUOUS
      // stretch long enough for even the smallest block, even though
      // its overall extent looks sufficient in aggregate. Keep this
      // honest about not having a crisper diagnosis, rather than
      // reusing a more specific-sounding message that doesn't actually
      // match (an earlier version of this message implied a simple
      // frontage-length shortfall, which read as nonsensical once the
      // non-housing reserve could be the real cause: the reported
      // frontage length looked more than enough for the smallest home).
      zeroHomesInfo = {
        cause: "area-too-small",
        reason: `This boundary's buildable area${nonHousingReservePercent > 0 ? ` (after the ${nonHousingReservePercent}% non-housing reserve)` : ""} doesn't leave one contiguous stretch long enough for even the smallest home, though the turning head and overall side depth both fit on their own.`,
      };
    }
  }

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

  // --- Turning head: does it fit inside the ORIGINAL boundary? Same
  // helper used to size maxPlotFrontageY above, so this can never
  // disagree with the ceiling placement was actually constrained by. ---
  const turningHeadFits = turningHeadFitsAt(roadEndY);
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
      const maxReasonableGap = sideGapM + smallestFrontageWidthM + PROBE_STEP_M;
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
  const ndssFailingIds = plots.filter((p) => p.giaM2 < ndssMinGia[p.houseType] - 1e-6).map((p) => p.id);
  const ndssOk = ndssFailingIds.length === 0;
  compliance.push({
    id: "ndss-gia",
    label: "NDSS minimum GIA",
    status: ndssOk ? "pass" : "fail",
    ruleRef: "DCLG, NDSS, March 2015, Table 1",
    detail: ndssOk
      ? marketSizeUpliftPercent > 0
        ? `Every plot's GIA is set to its NDSS minimum plus ${jurisdiction.localAuthority}'s sourced typical-market-size uplift (+${marketSizeUpliftPercent}%) — still built at a fixed target per type, not a range.`
        : (inputs.tenure ?? "market") === "social"
          ? "Every plot's GIA is set to exactly its NDSS minimum — tenure is set to \"social\": real RSL-led schemes typically build at the space-standard floor, so no market-size uplift is applied here even though the jurisdiction has one sourced."
          : "Every plot's GIA is set to exactly its NDSS minimum for its house type (v0 builds at the floor, not above it)."
      : `${ndssFailingIds.length} plot(s) below their NDSS minimum GIA.`,
    affectedPlotIds: ndssFailingIds,
  });

  // --- Garden depth ---
  function gardenDepthOk(p: PlacedPlot): boolean {
    if (!p.gardenBng) return false;
    const localGarden = p.gardenBng.map(toLocal);
    const xs = localGarden.map((pt) => pt[0]);
    const depth = Math.max(...xs) - Math.min(...xs);
    return depth >= gardenDepthM - 1e-6;
  }
  const gardenFailingIds = plots.filter((p) => !gardenDepthOk(p)).map((p) => p.id);
  const gardenOk = gardenFailingIds.length === 0;
  compliance.push({
    id: "garden-depth",
    label: "Minimum garden depth",
    status: plots.length > 0 ? (gardenOk ? "pass" : "fail") : "warn",
    ruleRef: `Brief default ${gardenDepthM}m`,
    detail:
      plots.length > 0
        ? gardenOk
          ? `Every plot's garden is at least ${gardenDepthM}m deep.`
          : `${gardenFailingIds.length} plot(s) have a garden shallower than the minimum.`
        : "No plots placed.",
    affectedPlotIds: gardenFailingIds,
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
  function parkingOkFor(p: PlacedPlot): boolean {
    const spec = computePlotSpec(p.houseType);
    return spec.frontageWidthM >= parkingRatio * rules.PARKING_SPACE_WIDTH_M - 1e-6;
  }
  const parkingFailingIds = plots.filter((p) => !parkingOkFor(p)).map((p) => p.id);
  const parkingOk = parkingFailingIds.length === 0;
  compliance.push({
    id: "parking",
    label: `Parking (${parkingRatio}/unit)`,
    status: plots.length > 0 ? (parkingOk ? "pass" : "fail") : "warn",
    ruleRef: `v0 default ${rules.PARKING_SPACES_PER_UNIT}/unit (common UK local parking SPD figure, editable)`,
    detail:
      plots.length > 0
        ? parkingOk
          ? "Every plot's frontage is sized to fit its required parking."
          : `${parkingFailingIds.length} plot(s) are narrower than their required parking allocation.`
        : "No plots placed.",
    affectedPlotIds: parkingFailingIds,
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

  return finalize(layout, compliance, boundaryAreaM2, inputs, jurisdiction, t0, topology, zeroHomesInfo, {
    percent: nonHousingReservePercent,
    source: nonHousingReserveSource,
  });
}

const DEFAULT_HOUSE_TYPES: HouseTypeId[] = ["2-bed-terrace", "3-bed-semi", "4-bed-detached"];

interface MixPlan {
  cycle: HouseTypeId[];
  /** Raw (non-ceiled) target weight per type, 0 for anything not requested. Used to compute each type's TARGET share for the mix-tolerance ordering below — not itself a placement order. */
  weights: Partial<Record<HouseTypeId, number>>;
  /** Sum of `weights` — 0 only when the mix fell all the way back to DEFAULT_HOUSE_TYPES (an unweighted 1/1/1 fallback is used for target-share purposes in that case). */
  totalWeight: number;
}

function buildMixPlan(mix: Partial<Record<HouseTypeId, number>> | undefined): MixPlan {
  // EngineInputs.mix's own doc comment says "missing types default to 0"
  // — the code used to default them to 1 instead, which would have
  // silently pulled bungalows into every unlabelled mix the moment a 4th
  // type existed. Missing really does mean 0 now; an explicit mix with
  // only "3-bed-bungalow" set builds bungalows only, nothing else.
  //
  // Round UP (not to nearest) for any positive weight. `inputs.mix`'s own
  // direct pro-view weights are always already integers, so ceil is a
  // no-op there — this only changes behaviour for sizeMix-derived
  // weights, which sizeTiers.expandSizeMixToHouseMix splits EQUALLY
  // across a tier's 3 forms (e.g. a tier weight of 1 becomes 0.333 per
  // form). Rounding to nearest turned every one of those into 0, so a
  // single-tier request like sizeMix={Small:1} ("All Small") had its
  // entire cycle vanish and silently fall back to DEFAULT_HOUSE_TYPES
  // below — which includes 3-bed-semi and 4-bed-detached, nothing like
  // what was actually asked for. Rounding up instead guarantees any
  // explicitly-requested nonzero tier/type is always represented by at
  // least one form, never discarded outright.
  const ceiledWeights = HOUSE_TYPES.map((t) => {
    const w = mix?.[t] ?? 0;
    return w > 0 ? Math.ceil(w) : 0;
  });
  const cycle: HouseTypeId[] = [];
  for (let i = 0; i < HOUSE_TYPES.length; i++) {
    for (let k = 0; k < ceiledWeights[i]; k++) cycle.push(HOUSE_TYPES[i]);
  }
  if (cycle.length > 0) {
    const weights: Partial<Record<HouseTypeId, number>> = {};
    let totalWeight = 0;
    for (const t of HOUSE_TYPES) {
      const w = mix?.[t] ?? 0;
      if (w > 0) {
        weights[t] = w;
        totalWeight += w;
      }
    }
    return { cycle, weights, totalWeight };
  }
  // Nothing requested at all (mix omitted, or every weight came out 0) —
  // fall back to the original three-type equal mix. Bungalow stays
  // opt-in rather than joining the unlabelled default: it's provisional
  // (see rules.ts) and scheme-specific, not a general-purpose house type yet.
  const weights: Partial<Record<HouseTypeId, number>> = {};
  for (const t of DEFAULT_HOUSE_TYPES) weights[t] = 1;
  return { cycle: [...DEFAULT_HOUSE_TYPES], weights, totalWeight: DEFAULT_HOUSE_TYPES.length };
}

function finalize(
  layout: LayoutResult,
  compliance: ComplianceCheck[],
  boundaryAreaM2: number,
  inputs: EngineInputs,
  jurisdiction: ResolvedJurisdiction,
  t0: number,
  topologyUsed: "double" | "single-left" | "single-right" | "frontage-ribbon" | "branching-spurs" | "none" = "none",
  zeroHomesInfo: { cause: Metrics["zeroHomesCause"]; reason: string } | null = null,
  nonHousingReserve: { percent: number; source: string | null } = { percent: 0, source: null }
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
    zeroHomesReason: totalUnits === 0 ? (zeroHomesInfo?.reason ?? "No buildable layout could be found for this boundary and entrance.") : null,
    zeroHomesCause: totalUnits === 0 ? (zeroHomesInfo?.cause ?? null) : null,
    nonHousingReservePercent: nonHousingReserve.percent,
    nonHousingReserveSource: nonHousingReserve.source,
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

  if (jurisdiction.localPlanning) {
    const localPlanning = jurisdiction.localPlanning;
    const boundaryAreaHa = boundaryAreaM2 / 10000;
    const appliesAboveHa = localPlanning.densityAppliesAboveHectares.value;
    if (boundaryAreaHa < appliesAboveHa) {
      compliance.push({
        id: "density-minimum",
        label: "Minimum gross density",
        status: "pass",
        ruleRef: localPlanning.densityAppliesAboveHectares.source,
        detail: `Site is ${boundaryAreaHa.toFixed(2)}ha — below ${localPlanning.councilName}'s ${appliesAboveHa}ha threshold for its minimum-density policy to apply.`,
      });
    } else if (!inputs.settlementTier) {
      // No UI control asks the user for this, and no settlement-tier
      // lookup exists in the engine yet (see types.ts's doc comment on
      // settlementTier — a cheap one would read the Built-Up Area field
      // postcodes.io already returns for a postcode-searched site, not
      // built yet). Rather than skip the rule entirely (a silent pass by
      // omission) or warn every single user who hasn't set a tier (most
      // haven't, and most layouts clear the lower tier anyway), check
      // against the LOWEST minimum this council has — the one that
      // can never be wrong in the "too lenient" direction — and say so
      // plainly in the detail. A genuinely under-density layout still
      // warns; a typical one just gets a quiet pass.
      const [fallbackTier, fallbackRule] = Object.entries(localPlanning.minGrossDensityDphByTier).sort(
        (a, b) => a[1].value - b[1].value
      )[0];
      const higherTiers = Object.entries(localPlanning.minGrossDensityDphByTier)
        .filter(([tier]) => tier !== fallbackTier)
        .map(([tier, d]) => `${d.value} dph in "${tier}"`)
        .join(", ");
      const meetsFallback = grossDensityDph >= fallbackRule.value;
      compliance.push({
        id: "density-minimum",
        label: "Minimum gross density",
        status: meetsFallback ? "pass" : "warn",
        ruleRef: fallbackRule.source,
        detail: meetsFallback
          ? `This layout is ${grossDensityDph.toFixed(1)} dwellings/hectare gross — meets ${localPlanning.councilName}'s baseline minimum of ${fallbackRule.value} dwellings/hectare (settlement type not specified; a higher minimum may apply instead — ${higherTiers}).`
          : `This layout is ${grossDensityDph.toFixed(1)} dwellings/hectare gross — below ${localPlanning.councilName}'s baseline minimum of ${fallbackRule.value} dwellings/hectare, the lowest tier that could apply (settlement type not specified; ${higherTiers} could require even more).`,
      });
    } else {
      const tierRule = localPlanning.minGrossDensityDphByTier[inputs.settlementTier];
      if (!tierRule) {
        compliance.push({
          id: "density-minimum",
          label: "Minimum gross density",
          status: "warn",
          ruleRef: `${localPlanning.councilName} minimum-density policy`,
          detail: `Settlement tier "${inputs.settlementTier}" isn't one ${localPlanning.councilName} has a minimum-density figure for (known tiers: ${Object.keys(localPlanning.minGrossDensityDphByTier).join(", ")}) — density policy not checked.`,
        });
      } else {
        const meetsMinimum = grossDensityDph >= tierRule.value;
        compliance.push({
          id: "density-minimum",
          label: "Minimum gross density",
          status: meetsMinimum ? "pass" : "warn",
          ruleRef: tierRule.source,
          detail: meetsMinimum
            ? `This layout is ${grossDensityDph.toFixed(1)} dwellings/hectare gross — meets ${localPlanning.councilName}'s minimum of ${tierRule.value} dwellings/hectare for "${inputs.settlementTier}".`
            : `This layout is ${grossDensityDph.toFixed(1)} dwellings/hectare gross — below ${localPlanning.councilName}'s minimum of ${tierRule.value} dwellings/hectare for "${inputs.settlementTier}".`,
        });
      }
    }
  }

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
