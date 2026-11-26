// Report (not a test): how far "No homes here" cover rectangles overshoot
// a flood zone, worst case. The engine needs convex restrictions, so a
// flood outline is covered with axis-aligned strips (coverRectangles in
// src/lib/siteLayers/server/flood.ts). That never under-covers, but on a
// narrow DIAGONAL strip each 2m-tall rectangle spans the strip's full
// horizontal sweep across that row, so it overshoots. This measures the
// WORST case across angles and widths, not the average.
//
// Per case: max reach = furthest any cover-rectangle corner sits from
// the real strip (the max of a convex distance function over a convex
// rectangle is at a corner, so corners are exact); area overshoot =
// extra land blocked / real strip area; uncovered = real strip area the
// cover misses (must be 0).
//
// Run with: npm run report:flood-cover

import polygonClipping, { type MultiPolygon } from "polygon-clipping";
import { coverRectangles, multiPolygonArea } from "../src/lib/siteLayers/server/flood";
import { distancePointToSegment } from "../src/engine/geometry";
import type { BNGPoint } from "../src/engine/types";

const LENGTH_M = 100;
const WIDTHS_M = [1, 2, 3, 5, 8];
const ANGLES_DEG = Array.from({ length: 91 }, (_, i) => i); // 0 = horizontal (E-W), 90 = vertical (N-S)
const ORIGIN: BNGPoint = [200000.3, 210000.7]; // off-grid on purpose, like a real outline

function strip(angleDeg: number, width: number): BNGPoint[] {
  const a = (angleDeg * Math.PI) / 180;
  const [ux, uy] = [Math.cos(a), Math.sin(a)];
  const [nx, ny] = [-uy * (width / 2), ux * (width / 2)];
  const [ex, ey] = [ux * LENGTH_M, uy * LENGTH_M];
  const [ox, oy] = ORIGIN;
  return [
    [ox + nx, oy + ny],
    [ox + ex + nx, oy + ey + ny],
    [ox + ex - nx, oy + ey - ny],
    [ox - nx, oy - ny],
  ];
}

function distanceToConvex(p: BNGPoint, poly: BNGPoint[]): number {
  // inside -> 0 (convex, CCW-agnostic: same side of every edge)
  let sign = 0;
  let inside = true;
  for (let i = 0; i < poly.length; i++) {
    const [a, b] = [poly[i], poly[(i + 1) % poly.length]];
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const s = Math.sign(cross);
    if (s !== 0) {
      if (sign === 0) sign = s;
      else if (s !== sign) inside = false;
    }
  }
  if (inside) return 0;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distancePointToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

type Row = { angle: number; width: number; reach: number; areaPct: number; extraM2: number; uncovered: number; rects: number };
const rows: Row[] = [];
for (const width of WIDTHS_M) {
  for (const angle of ANGLES_DEG) {
    const s = strip(angle, width);
    const mp: MultiPolygon = [[[...s, s[0]] as [number, number][]]];
    const cover = coverRectangles(mp);
    const coverMp: MultiPolygon = polygonClipping.union(...(cover.map((r) => [[...r, r[0]]]) as [MultiPolygon[number], ...MultiPolygon[number][]]));
    const real = multiPolygonArea(mp);
    const coverArea = multiPolygonArea(coverMp);
    const uncovered = multiPolygonArea(polygonClipping.difference(mp, coverMp));
    let reach = 0;
    for (const r of cover) for (const p of r) reach = Math.max(reach, distanceToConvex(p as BNGPoint, s));
    rows.push({ angle, width, reach, areaPct: ((coverArea - real) / real) * 100, extraM2: coverArea - real, uncovered, rects: cover.length });
  }
}

const fmt = (r: Row) =>
  `${String(r.width).padStart(3)}m wide @ ${String(r.angle).padStart(2)}°: reach ${r.reach.toFixed(2)}m, area +${r.areaPct.toFixed(0)}% (+${r.extraM2.toFixed(0)}m²), ${r.rects} rects, uncovered ${r.uncovered.toFixed(3)}m²`;

console.log(`Narrow ${LENGTH_M}m flood strips, angles 0-90° in 1° steps, widths ${WIDTHS_M.join("/")}m, cover strip height 2m.\n`);
console.log("Worst per width (by area overshoot, then by reach):");
for (const w of WIDTHS_M) {
  const ws = rows.filter((r) => r.width === w);
  console.log("  " + fmt(ws.reduce((a, b) => (b.areaPct > a.areaPct ? b : a))));
  console.log("  " + fmt(ws.reduce((a, b) => (b.reach > a.reach ? b : a))));
}
const worstArea = rows.reduce((a, b) => (b.areaPct > a.areaPct ? b : a));
const worstReach = rows.reduce((a, b) => (b.reach > a.reach ? b : a));
const worstUncovered = rows.reduce((a, b) => (b.uncovered > a.uncovered ? b : a));
console.log("\nLARGEST overshoot by area:  " + fmt(worstArea));
console.log("LARGEST overshoot by reach: " + fmt(worstReach));
console.log("Largest uncovered area:     " + worstUncovered.uncovered.toExponential(2) + "m² (must be 0)");
console.log("\nAt 45° specifically:");
for (const r of rows.filter((r) => r.angle === 45)) console.log("  " + fmt(r));
