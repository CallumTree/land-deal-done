// Converts the engine's existing BNG-metre output (LayoutResult, the
// boundary polygon) into three.js geometry for the 3D view. Pure
// geometry construction only — never touches generateLayout.ts or any
// engine file; this reads EngineOutput the same way SiteCanvas.tsx (2D)
// already does.
//
// Everything renders unlit (MeshBasicMaterial, vertexColors) rather than
// with real lights: cheaper (no normals to compute, no light sources to
// manage) and it suits the flat "Grid Runner" neon look better than
// realistic shading would. "3D form" still reads clearly because walls
// are rendered at a darker shade of their roof/footprint colour — see
// WALL_SHADE — not because of any actual lighting calculation.

import * as THREE from "three";
import type { BNGPolygon, LayoutResult, PlacedPlot } from "@/engine/types";
import * as rules from "@/engine/rules";
import { GRID_AMBER, GRID_KEEPCLEAR, HOUSE_TYPE_COLOR, ROAD_GREY_BLUE } from "../gridColors";
import { bufferStraightRoad } from "../bufferRoad";
import { bngToScene, type SceneOrigin } from "./coords";

/**
 * Storey-to-floor height, metres. A presentation-layer modelling choice
 * for this 3D view (NOT read from the engine, which only tracks STOREY
 * COUNT via rules.STOREYS, never a physical floor height) — 2.7m is a
 * standard UK residential floor-to-floor figure, stated as a modelling
 * assumption, not a citation, the same honesty bar rules.ts itself uses
 * for e.g. ASSUMED_FOOTPRINT_DEPTH_M.
 */
const STOREY_HEIGHT_M = 2.7;
/** Ridge height above the eaves for a modest pitched roof — same modelling-choice status as STOREY_HEIGHT_M above. */
const ROOF_RISE_M = 2.0;
/** Walls render at this fraction of the roof/footprint colour's brightness — fakes "shaded 3D form" cheaply under an unlit material, see module header. */
const WALL_SHADE = 0.6;

function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface TriBuilder {
  positions: number[];
  colors: number[];
}

function newBuilder(): TriBuilder {
  return { positions: [], colors: [] };
}

function pushTri(
  b: TriBuilder,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  color: [number, number, number]
) {
  b.positions.push(...p0, ...p1, ...p2);
  for (let i = 0; i < 3; i++) b.colors.push(...color);
}

/** p0,p1,p2,p3 in order around a planar, convex quad. */
function pushQuad(
  b: TriBuilder,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  color: [number, number, number]
) {
  pushTri(b, p0, p1, p2, color);
  pushTri(b, p0, p2, p3, color);
}

function finishGeometry(b: TriBuilder): THREE.BufferGeometry | null {
  if (b.positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(b.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(b.colors, 3));
  return geometry;
}

function dedupeClosingPoint(ring: BNGPolygon): BNGPolygon {
  if (ring.length > 1) {
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx === lx && fy === ly) return ring.slice(0, -1);
  }
  return ring;
}

/**
 * Extruded walls + a simple pitched gable roof for one plot's footprint.
 * Only handles a 4-point rectangle — v0's engine only ever emits
 * rectangular footprints (generateLayout.ts's buildPlotRect) possibly
 * rotated in BNG space, never an arbitrary polygon; anything else is
 * skipped rather than guessed at.
 */
function addHouseGeometry(b: TriBuilder, plot: PlacedPlot, origin: SceneOrigin, isTight: boolean) {
  const ring = dedupeClosingPoint(plot.footprintBng);
  if (ring.length !== 4) return;

  const pts2d = ring.map((p) => bngToScene(p, origin));
  const [p0, p1, p2, p3] = pts2d as [[number, number], [number, number], [number, number], [number, number]];

  const storeys = rules.STOREYS[plot.houseType];
  const eaveY = storeys * STOREY_HEIGHT_M;
  const ridgeY = eaveY + ROOF_RISE_M;

  const baseHex = isTight ? GRID_AMBER : HOUSE_TYPE_COLOR[plot.houseType];
  const roofColor = hexToRgb01(baseHex);
  const wallColor: [number, number, number] = [roofColor[0] * WALL_SHADE, roofColor[1] * WALL_SHADE, roofColor[2] * WALL_SHADE];

  const at = (p: [number, number], y: number): [number, number, number] => [p[0], y, p[1]];

  // Walls: 4 vertical quads, eave height.
  const corners0 = [p0, p1, p2, p3];
  for (let i = 0; i < 4; i++) {
    const a = corners0[i];
    const next = corners0[(i + 1) % 4];
    pushQuad(b, at(a, 0), at(next, 0), at(next, eaveY), at(a, eaveY), wallColor);
  }

  // Roof: ridge runs parallel to the LONGER pair of opposite edges.
  // Rotate the corner list so edge(c0,c1) is always a long edge — lets
  // the rest of this function use one code path regardless of which
  // pair of the rectangle's edges happens to be longer.
  const len01 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const len12 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const [c0, c1, c2, c3] = len01 >= len12 ? [p0, p1, p2, p3] : [p1, p2, p3, p0];

  const midpoint = (a: [number, number], c: [number, number]): [number, number] => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  // Short edges are (c3,c0) and (c1,c2) — their midpoints are the ridge's two ends.
  const ridgeNear01 = midpoint(c3, c0);
  const ridgeNear23 = midpoint(c1, c2);

  pushQuad(b, at(c0, eaveY), at(c1, eaveY), at(ridgeNear23, ridgeY), at(ridgeNear01, ridgeY), roofColor);
  pushQuad(b, at(c2, eaveY), at(c3, eaveY), at(ridgeNear01, ridgeY), at(ridgeNear23, ridgeY), roofColor);
  pushTri(b, at(c3, eaveY), at(c0, eaveY), at(ridgeNear01, ridgeY), roofColor);
  pushTri(b, at(c1, eaveY), at(c2, eaveY), at(ridgeNear23, ridgeY), roofColor);
}

function addFlatPolygon(b: TriBuilder, ring: BNGPolygon, origin: SceneOrigin, color: [number, number, number], y = 0) {
  const pts = dedupeClosingPoint(ring).map((p) => bngToScene(p, origin));
  if (pts.length < 3) return;
  // Fan triangulation from vertex 0 — every ring here is convex
  // (rectangles from bufferStraightRoad/plot gardens, or the user-drawn
  // boundary, which the engine already requires to place anything at
  // all), so a simple fan is correct and avoids pulling in an earcut
  // dependency for arbitrary concave polygons v0 never actually produces.
  for (let i = 1; i < pts.length - 1; i++) {
    pushTri(b, [pts[0][0], y, pts[0][1]], [pts[i][0], y, pts[i][1]], [pts[i + 1][0], y, pts[i + 1][1]], color);
  }
}

export interface SceneGeometries {
  homes: THREE.BufferGeometry | null;
  roads: THREE.BufferGeometry | null;
  gardens: THREE.BufferGeometry | null;
  /**
   * "Keep clear" zones (EngineInputs.restrictions) as a flat, tinted
   * ground marker — land set aside, not an error, so no extrusion and a
   * calm colour (GRID_KEEPCLEAR), not red/amber. v0 doesn't attempt a
   * true diagonal-hatch TEXTURE here (unlike the 2D map's SVG/canvas
   * pattern) — a flat tinted plane is a deliberately simpler, honestly-
   * scoped stand-in that still reads clearly in 3D.
   */
  restrictions: THREE.BufferGeometry | null;
  /** Boundary outline points in scene space, Y-elevated slightly to avoid z-fighting with the ground plane — for a THREE.Line, not a filled mesh. */
  boundaryPoints: THREE.Vector3[];
  /** Entrance marker position in scene space, or null if no entrance set. */
  entrancePosition: THREE.Vector3 | null;
}

const GARDEN_COLOR: [number, number, number] = hexToRgb01("#27573f"); // a dark, desaturated green — distinct from the neon GRID_GREEN used for live/entrance accents, since a flat ground slab rendered at full neon brightness would fight with the homes for attention.
const ROAD_COLOR: [number, number, number] = hexToRgb01(ROAD_GREY_BLUE);
const RESTRICTION_COLOR: [number, number, number] = hexToRgb01(GRID_KEEPCLEAR);
const BOUNDARY_Y = 0.05;

export function buildSceneGeometry(
  layout: LayoutResult | null,
  boundary: BNGPolygon,
  entrance: [number, number] | null,
  tightPlotIds: ReadonlySet<string>,
  origin: SceneOrigin,
  restrictionZones: BNGPolygon[] = []
): SceneGeometries {
  const homesB = newBuilder();
  const roadsB = newBuilder();
  const gardensB = newBuilder();
  const restrictionsB = newBuilder();

  for (const plot of layout?.plots ?? []) {
    addHouseGeometry(homesB, plot, origin, tightPlotIds.has(plot.id));
    if (plot.gardenBng) addFlatPolygon(gardensB, plot.gardenBng, origin, GARDEN_COLOR, 0.01);
  }

  for (const road of layout?.roads ?? []) {
    const rect = bufferStraightRoad(road.centerlineBng, road.widthM);
    if (rect) addFlatPolygon(roadsB, rect, origin, ROAD_COLOR, 0.02);
  }

  // Above roads/gardens but below the boundary outline, so a zone drawn
  // over a garden/road still reads as the topmost flat layer there.
  for (const zone of restrictionZones) {
    addFlatPolygon(restrictionsB, zone, origin, RESTRICTION_COLOR, 0.03);
  }

  const boundaryPoints = boundary.map((p) => {
    const [x, z] = bngToScene(p, origin);
    return new THREE.Vector3(x, BOUNDARY_Y, z);
  });
  if (boundaryPoints.length > 0) boundaryPoints.push(boundaryPoints[0].clone());

  const entrancePosition = entrance
    ? (() => {
        const [x, z] = bngToScene(entrance, origin);
        return new THREE.Vector3(x, BOUNDARY_Y, z);
      })()
    : null;

  return {
    homes: finishGeometry(homesB),
    roads: finishGeometry(roadsB),
    gardens: finishGeometry(gardensB),
    restrictions: finishGeometry(restrictionsB),
    boundaryPoints,
    entrancePosition,
  };
}
