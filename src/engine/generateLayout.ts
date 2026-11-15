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

const HOUSE_TYPES: HouseTypeId[] = ["2-bed-terrace", "3-bed-semi", "4-bed-detached"];

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
  const gdvPerSqFt = inputs.gdvPerSqFt ?? rules.DEFAULT_GDV_PER_SQFT;
  const buildCostPerSqFt = inputs.buildCostPerSqFt ?? rules.DEFAULT_BUILD_COST_PER_SQFT;

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
    }, compliance, boundaryAreaM2, { gdvPerSqFt, buildCostPerSqFt }, t0);
  }

  const maxBoundaryY = Math.max(...localBoundary.map((p) => p[1]));
  const roadHalfWidth = rules.ROAD_WIDTH_M / 2;
  const turningHeadSide = rules.TURNING_HEAD_DIAMETER_M;
  // Reserve room for the turning head up front, rather than placing plots
  // greedily and finding out afterwards there's no room to turn around.
  const maxPlotFrontageY = maxBoundaryY - turningHeadSide;

  // --- Mix cycle: repeat each house type `weight` times (default 1 each) ---
  const mixCycle = buildMixCycle(inputs.mix);

  interface PlotSpec {
    houseType: HouseTypeId;
    frontageWidthM: number;
    drivewayDepthM: number;
    footprintDepthM: number;
    gardenDepthM: number;
    totalDepthM: number;
    giaM2: number;
  }

  function computePlotSpec(houseType: HouseTypeId): PlotSpec {
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

  type Side = "left" | "right";
  const plots: PlacedPlot[] = [];
  const parkingSpacesLocal: BNGPoint[] = [];
  // Plots start at the boundary offset, not 0 — the first row sits right
  // next to the entrance along the same edge the entrance is on, which
  // still needs the same no-build setback as the rest of that edge; only
  // the road itself is exempt.
  let cursorLeft = rules.BOUNDARY_OFFSET_M;
  let cursorRight = rules.BOUNDARY_OFFSET_M;
  let cycleIndexLeft = 0;
  let cycleIndexRight = 0;
  let plotCounter = 0;

  function depthToX(side: Side, frontageX: number, depth: number): number {
    return side === "left" ? frontageX - depth : frontageX + depth;
  }

  // Probe step for searching forward past a pinch point (e.g. a cul-de-sac's
  // narrow access neck) to the next position where a plot actually fits,
  // rather than giving up on the whole side the first time one doesn't.
  const PROBE_STEP_M = 0.5;

  function tryPlaceOnSide(side: Side): boolean {
    const startCursor = side === "left" ? cursorLeft : cursorRight;
    const cycleIndex = side === "left" ? cycleIndexLeft : cycleIndexRight;
    const houseType = mixCycle[cycleIndex % mixCycle.length];
    const spec = computePlotSpec(houseType);
    const frontageX = side === "left" ? -roadHalfWidth : roadHalfWidth;
    const rearX = depthToX(side, frontageX, spec.totalDepthM);

    for (let yStart = startCursor; yStart + spec.frontageWidthM <= maxPlotFrontageY; yStart += PROBE_STEP_M) {
      const yEnd = yStart + spec.frontageWidthM;

      const plotRectLocal: BNGPolygon =
        side === "left"
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

      if (geo.convexPolygonFullyInside(plotRectLocal, erodedLocal)) {
        return placePlot(side, spec, frontageX, rearX, yStart, yEnd, plotRectLocal);
      }
    }
    return false;
  }

  function placePlot(
    side: Side,
    spec: ReturnType<typeof computePlotSpec>,
    frontageX: number,
    rearX: number,
    yStart: number,
    yEnd: number,
    plotRectLocal: BNGPolygon
  ): boolean {
    const driveX = depthToX(side, frontageX, spec.drivewayDepthM);
    const houseX = depthToX(side, frontageX, spec.drivewayDepthM + spec.footprintDepthM);

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

    plotCounter += 1;
    plots.push({
      id: `plot-${plotCounter}`,
      houseType: spec.houseType,
      plotBng: plotRectLocal.map(toWorld),
      footprintBng: footprintLocal.map(toWorld),
      gardenBng: gardenLocal.map(toWorld),
      giaM2: spec.giaM2,
    });

    const spacesNeeded = Math.max(1, Math.round(parkingRatio));
    const spaceWidth = spec.frontageWidthM / spacesNeeded;
    for (let s = 0; s < spacesNeeded; s++) {
      const centerY = yStart + spaceWidth * (s + 0.5);
      parkingSpacesLocal.push([depthToX(side, frontageX, spec.drivewayDepthM / 2), centerY]);
    }

    if (side === "left") {
      cursorLeft = yEnd;
      cycleIndexLeft += 1;
    } else {
      cursorRight = yEnd;
      cycleIndexRight += 1;
    }
    return true;
  }

  // Alternate sides so the road grows roughly evenly rather than filling
  // one side completely before starting the other.
  let progress = true;
  while (progress) {
    const placedLeft = tryPlaceOnSide("left");
    const placedRight = tryPlaceOnSide("right");
    progress = placedLeft || placedRight;
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

  return finalize(layout, compliance, boundaryAreaM2, { gdvPerSqFt, buildCostPerSqFt }, t0);
}

function buildMixCycle(mix: Partial<Record<HouseTypeId, number>> | undefined): HouseTypeId[] {
  const weights = HOUSE_TYPES.map((t) => Math.max(0, Math.round(mix?.[t] ?? 1)));
  const cycle: HouseTypeId[] = [];
  for (let i = 0; i < HOUSE_TYPES.length; i++) {
    for (let k = 0; k < weights[i]; k++) cycle.push(HOUSE_TYPES[i]);
  }
  return cycle.length > 0 ? cycle : [...HOUSE_TYPES];
}

function finalize(
  layout: LayoutResult,
  compliance: ComplianceCheck[],
  boundaryAreaM2: number,
  costInputs: { gdvPerSqFt: number; buildCostPerSqFt: number },
  t0: number
): EngineOutput {
  const mix: Record<HouseTypeId, number> = {
    "2-bed-terrace": 0,
    "3-bed-semi": 0,
    "4-bed-detached": 0,
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

  const totalGiaSqFt = totalGiaM2 / rules.SQM_PER_SQFT;
  const gdv = totalGiaSqFt * costInputs.gdvPerSqFt;
  const buildCost = totalGiaSqFt * costInputs.buildCostPerSqFt;
  // Crude residual: GDV minus build cost only. No profit margin, fees,
  // abnormals, s106/CIL or finance costs — a real appraisal needs those.
  // Flagged here, not hidden.
  const residualLandValue = gdv - buildCost;

  const metrics: Metrics = {
    totalUnits,
    mix,
    netDensityDph,
    grossDensityDph,
    totalGiaM2,
    gdv,
    buildCost,
    residualLandValue,
  };

  const computeMs = performance.now() - t0;
  void computeMs; // not part of EngineOutput's type; the harness measures its own wall-clock time around the call.

  return { layout, metrics, compliance };
}
