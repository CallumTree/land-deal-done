// BNG (British National Grid, metres) -> three.js scene-space conversion,
// shared by every geometry builder in this folder. Pure, no three.js/DOM
// imports — just numbers — so it's trivially testable and reusable by
// the ground-texture capture (which needs the same extent math, not the
// coordinate mapping itself).
//
// Convention (arbitrary but fixed, applied identically everywhere): the
// scene origin is the boundary's own bounding-box centre, so the model
// sits near (0,0,0) regardless of where the real site is on the BNG
// grid (large BNG numbers like 193540 would otherwise land the whole
// scene far from the WebGL origin, which hurts floating-point precision
// for no benefit). Easting -> scene X unchanged; northing -> scene Z
// NEGATED, so increasing-north points move toward -Z — with the default
// camera placed at +Z looking back toward the origin (see Scene3D.tsx),
// that reads as "looking north", a conventional map orientation. Height
// (storeys) is scene Y, with the ground plane at Y=0.

import type { BNGPoint, BNGPolygon } from "@/engine/types";

export interface SceneOrigin {
  x: number;
  y: number;
}

export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function polygonExtent(points: BNGPolygon): Extent {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function extentCenter(e: Extent): SceneOrigin {
  return { x: (e.minX + e.maxX) / 2, y: (e.minY + e.maxY) / 2 };
}

/** BNG [easting, northing] -> scene [x, z], relative to `origin`. See module header for the axis convention. */
export function bngToScene(p: BNGPoint, origin: SceneOrigin): [number, number] {
  return [p[0] - origin.x, -(p[1] - origin.y)];
}
