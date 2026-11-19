// Plain 2D geometry helpers for the layout engine, operating on BNG metres.
// No projection/geographic assumptions anywhere — these are just planar
// vector-math primitives, shared by the engine and (imported directly) by
// the test harness's independent invariant checks, so "passes an invariant"
// means the same arithmetic ran twice, not "the engine's own claim".

import type { BNGPoint, BNGPolygon } from "./types";

export function add(a: BNGPoint, b: BNGPoint): BNGPoint {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub(a: BNGPoint, b: BNGPoint): BNGPoint {
  return [a[0] - b[0], a[1] - b[1]];
}

export function scale(a: BNGPoint, s: number): BNGPoint {
  return [a[0] * s, a[1] * s];
}

export function length(a: BNGPoint): number {
  // Math.hypot is correct for any magnitude (it guards against overflow/
  // underflow by rescaling internally) but that guard makes it several
  // times slower than a plain sqrt in V8 — profiling this engine's
  // hottest path (pointInPolygon, called via distancePointToSegment,
  // called via convexPolygonFullyInside on every placement candidate)
  // showed Math.hypot itself accounting for ~28% of total CPU time.
  // Every coordinate here is BNG metres or a local-frame derivative of
  // them — at most ~10^6 in magnitude, nowhere near sqrt's overflow
  // threshold (~10^154) — so the plain form is exactly as correct and
  // meaningfully faster.
  return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}

export function normalize(a: BNGPoint): BNGPoint {
  const l = length(a);
  if (l === 0) return [0, 0];
  return [a[0] / l, a[1] / l];
}

export function dot(a: BNGPoint, b: BNGPoint): number {
  return a[0] * b[0] + a[1] * b[1];
}

/**
 * Drop a trailing point that duplicates the first one. GeoJSON-style rings
 * conventionally repeat the first vertex at the end to close the loop;
 * every function here instead assumes an implicit closing edge
 * (poly[i] -> poly[(i+1) % n]), so an explicit duplicate creates a
 * zero-length edge that breaks edge-based math (offsetting, normals).
 * Call this on every boundary polygon entering the engine from outside.
 */
export function stripClosingDuplicate(polygon: BNGPolygon, toleranceM = 1e-6): BNGPolygon {
  if (polygon.length < 2) return polygon;
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  return length(sub(first, last)) < toleranceM ? polygon.slice(0, -1) : polygon;
}

/** Rotate a point around an origin by angleRad (radians, CCW positive). */
export function rotateAround(p: BNGPoint, originPt: BNGPoint, angleRad: number): BNGPoint {
  const d = sub(p, originPt);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return [originPt[0] + d[0] * cos - d[1] * sin, originPt[1] + d[0] * sin + d[1] * cos];
}

/**
 * Shoelace formula. Positive for CCW winding, negative for CW.
 *
 * Translates to the first vertex before summing. BNG coordinates are
 * ~3x10^5 in magnitude; the raw shoelace sum multiplies those directly
 * (products ~6x10^10) and the area is the tiny residual left after those
 * large terms nearly cancel — double precision only carries ~15-17
 * significant digits, so that residual can be off by ~1e-5, enough to
 * push a plot's computed GIA measurably below an NDSS minimum. Working
 * on each vertex relative to polygon[0] keeps the products small (tens
 * of metres) and removes the cancellation, without changing the
 * (translation-invariant) result.
 */
export function signedArea(polygon: BNGPolygon): number {
  if (polygon.length === 0) return 0;
  const origin = polygon[0];
  let sum = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = sub(polygon[i], origin);
    const [x2, y2] = sub(polygon[(i + 1) % n], origin);
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function area(polygon: BNGPolygon): number {
  return Math.abs(signedArea(polygon));
}

/** Returns a copy of the polygon wound counter-clockwise. */
export function ensureCCW(polygon: BNGPolygon): BNGPolygon {
  return signedArea(polygon) < 0 ? [...polygon].reverse() : [...polygon];
}

/** Squared distance from a point to a segment — avoids a sqrt call for callers that only need to compare against a fixed threshold (compare against threshold², not threshold). */
export function distanceSquaredPointToSegment(p: BNGPoint, a: BNGPoint, b: BNGPoint): number {
  const ab = sub(b, a);
  const abLenSq = dot(ab, ab);
  if (abLenSq === 0) {
    const d = sub(p, a);
    return d[0] * d[0] + d[1] * d[1];
  }
  let t = dot(sub(p, a), ab) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const closest: BNGPoint = add(a, scale(ab, t));
  const d = sub(p, closest);
  return d[0] * d[0] + d[1] * d[1];
}

const ON_EDGE_TOLERANCE_M = 1e-6;
const ON_EDGE_TOLERANCE_M_SQ = ON_EDGE_TOLERANCE_M * ON_EDGE_TOLERANCE_M;

/**
 * Standard ray-casting point-in-polygon test (boundary-inclusive, small
 * epsilon). This is the single hottest function in the engine (profiled:
 * ~30% of CPU time on a large multi-vertex fixture, called once per rect
 * corner per placement candidate) — the on-edge check below uses the
 * squared-distance form specifically to avoid a sqrt per polygon edge
 * per call; see distanceSquaredPointToSegment.
 */
export function pointInPolygon(point: BNGPoint, polygon: BNGPolygon): boolean {
  const [px, py] = point;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    // On-edge counts as inside, within a small tolerance.
    if (distanceSquaredPointToSegment(point, polygon[i], polygon[j]) < ON_EDGE_TOLERANCE_M_SQ) return true;
    const intersects =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function distancePointToSegment(p: BNGPoint, a: BNGPoint, b: BNGPoint): number {
  const ab = sub(b, a);
  const abLenSq = dot(ab, ab);
  if (abLenSq === 0) return length(sub(p, a));
  let t = dot(sub(p, a), ab) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const closest: BNGPoint = add(a, scale(ab, t));
  return length(sub(p, closest));
}

/**
 * Sign of the cross product (b-a) x (c-b) — "which way does the path
 * a->b->c turn." The collinearity tolerance scales with the magnitude of
 * the terms being subtracted, not a fixed absolute number: BNG
 * coordinates run ~1e5-1e6, and a rect that's been rotated into an
 * engine-local frame then rotated back (every plot vs. an eroded
 * boundary, which is what this function is mostly used for via
 * properCrossing) accumulates floating-point noise on the order of
 * 1e-9-1e-8 in absolute coordinate terms — comfortably BELOW a scale-
 * aware tolerance here, but a bare `1e-9` absolute threshold sits right
 * in the middle of that noise band and flips sign unpredictably. Found
 * via scripts/fuzz-shapes.ts: a plot snug against (genuinely touching,
 * not crossing) the eroded boundary was flagged as "outside" on ~11% of
 * 300 random shapes, because properCrossing's four orientation() calls
 * landed just past the old fixed threshold (e.g. 7.5e-9) on what was
 * really a collinear touch, not a real crossing — never at a magnitude
 * that corresponds to an actual geometric error of more than a few
 * nanometres.
 */
function orientation(a: BNGPoint, b: BNGPoint, c: BNGPoint): number {
  const t1 = (b[1] - a[1]) * (c[0] - b[0]);
  const t2 = (b[0] - a[0]) * (c[1] - b[1]);
  const val = t1 - t2;
  const scale = Math.abs(t1) + Math.abs(t2);
  if (Math.abs(val) < 1e-9 * Math.max(scale, 1)) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(a: BNGPoint, b: BNGPoint, p: BNGPoint): boolean {
  return (
    p[0] <= Math.max(a[0], b[0]) + 1e-9 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-9 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-9 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-9
  );
}

/** True if segments p1-p2 and p3-p4 intersect (including touching). */
export function segmentsIntersect(p1: BNGPoint, p2: BNGPoint, p3: BNGPoint, p4: BNGPoint): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, p3)) return true;
  if (o2 === 0 && onSegment(p1, p2, p4)) return true;
  if (o3 === 0 && onSegment(p3, p4, p1)) return true;
  if (o4 === 0 && onSegment(p3, p4, p2)) return true;
  return false;
}

/** Intersection point of the infinite lines through (p1,p2) and (p3,p4), or null if parallel. */
export function lineIntersection(p1: BNGPoint, p2: BNGPoint, p3: BNGPoint, p4: BNGPoint): BNGPoint | null {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const [x4, y4] = p4;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

/**
 * Inward offset of a simple polygon by `distance` metres, via the
 * shift-each-edge-and-intersect-with-neighbours method.
 *
 * Exact for rectilinear (axis-aligned, 90°/270° corner) polygons, which is
 * what every v0 test fixture is. For a general simple polygon it can
 * self-intersect when `distance` exceeds half the width of a narrow
 * feature (e.g. a tight neck) — callers must sanity-check the result
 * (see `isValidOffsetResult`) rather than trust it blindly. A known v0
 * limitation, not hidden: true polygon offsetting (e.g. a straight-skeleton
 * approach) would handle arbitrary concave boundaries robustly; this
 * doesn't yet.
 */
export function offsetPolygonInward(polygon: BNGPolygon, distance: number): BNGPolygon {
  const ccw = ensureCCW(polygon);
  const n = ccw.length;
  if (n < 3 || distance === 0) return ccw;

  // For a CCW polygon, walking a->b has the interior on your left, so the
  // inward normal is the edge direction rotated +90° (CCW): (-dy, dx).
  const offsetLines: { a: BNGPoint; b: BNGPoint }[] = [];
  for (let i = 0; i < n; i++) {
    const a = ccw[i];
    const b = ccw[(i + 1) % n];
    const dir = normalize(sub(b, a));
    const inwardNormal: BNGPoint = [-dir[1], dir[0]];
    const shift = scale(inwardNormal, distance);
    offsetLines.push({ a: add(a, shift), b: add(b, shift) });
  }

  const result: BNGPoint[] = [];
  for (let i = 0; i < n; i++) {
    const prev = offsetLines[(i - 1 + n) % n];
    const curr = offsetLines[i];
    const pt = lineIntersection(prev.a, prev.b, curr.a, curr.b);
    result.push(pt ?? curr.a);
  }
  return result;
}

/** Sanity check for offsetPolygonInward's output — see its docstring. */
export function isValidOffsetResult(original: BNGPolygon, offset: BNGPolygon): boolean {
  const originalArea = area(original);
  const offsetArea = area(offset);
  if (!Number.isFinite(offsetArea) || offsetArea <= 0) return false;
  if (offsetArea >= originalArea) return false;
  return true;
}

/**
 * True if no two NON-ADJACENT edges of `polygon` cross — i.e. the
 * polygon doesn't self-intersect (a "bowtie"). O(n²) in edge count,
 * only meant for the handful of times per generateLayout() call this
 * actually needs checking (not the hot per-candidate placement loop).
 *
 * Exists specifically because offsetPolygonInward's own doc comment
 * already states it can self-intersect past a narrow feature — and
 * isValidOffsetResult's area-only check does NOT reliably catch that: a
 * self-intersecting ("bowtie") result can still shoelace-compute to a
 * plausible-looking smaller positive area, passing the area check while
 * being geometrically invalid. Confirmed directly: generateLayout.ts's
 * non-housing-reserve erosion (a much larger offset than the fixed
 * BOUNDARY_OFFSET_M everywhere else uses) produced exactly this on two
 * fuzz-harness rectangles, each one tripping a real
 * plots-inside-boundary invariant failure despite isValidOffsetResult
 * reporting "valid." Used as an EXTRA gate alongside isValidOffsetResult
 * wherever an offset distance isn't known in advance to be safely small
 * (i.e. the reserve's bisection search, not the small fixed
 * BOUNDARY_OFFSET_M offset everywhere else, which stays on
 * isValidOffsetResult alone as before — unnecessary to re-verify
 * something already extensively fuzz-tested at that scale).
 */
export function isSimplePolygon(polygon: BNGPolygon): boolean {
  const n = polygon.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a1 = polygon[i];
    const a2 = polygon[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i || j === (i + 1) % n || (j + 1) % n === i;
      if (adjacent) continue;
      const b1 = polygon[j];
      const b2 = polygon[(j + 1) % n];
      if (properCrossing(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

/**
 * True if segments p1-p2 and p3-p4 cross transversally — each segment's
 * endpoints strictly straddle the other's line. Unlike segmentsIntersect,
 * this is false for touching endpoints or a collinear overlap, so a rect
 * edge that lies exactly along (or touches) a polygon edge doesn't count
 * as "crossing" it.
 */
function properCrossing(p1: BNGPoint, p2: BNGPoint, p3: BNGPoint, p4: BNGPoint): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);
  return o1 !== 0 && o2 !== 0 && o1 !== o2 && o3 !== 0 && o4 !== 0 && o3 !== o4;
}

interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// `convexPolygonFullyInside` is called many thousands of times per
// generateLayout() run with the SAME `polygon` argument (the eroded
// buildable boundary doesn't change during a single run — only `rect`,
// the candidate plot, does). Caching that polygon's bounding box against
// its own array reference lets every call after the first skip
// recomputing it, and lets a huge fraction of candidates that are
// nowhere near the boundary (e.g. probing past the far end of a long
// site, or a type that's simply too deep for this site at all) be
// rejected with 4 comparisons instead of running the full point-in-
// polygon + edge-crossing test. This is a performance cache only — it
// never changes the answer, since a rect whose bbox isn't fully inside
// the polygon's bbox genuinely cannot be fully inside the polygon.
const polygonBBoxCache = new WeakMap<BNGPolygon, BBox>();

function polygonBBox(polygon: BNGPolygon): BBox {
  const cached = polygonBBoxCache.get(polygon);
  if (cached) return cached;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const bbox = { minX, maxX, minY, maxY };
  polygonBBoxCache.set(polygon, bbox);
  return bbox;
}

/**
 * True if `rect` (a convex polygon, typically a rectangle) is fully
 * contained within `polygon`: every corner inside, and no edge of
 * `polygon` properly crosses an edge of `rect` (catches a concave notch
 * poking into the rectangle without putting any rect corner outside it).
 * A rect edge that merely touches or runs collinear with a polygon edge —
 * the normal case for a plot sitting right at the edge of the buildable
 * area — does not count as a violation.
 */
export function convexPolygonFullyInside(rect: BNGPolygon, polygon: BNGPolygon): boolean {
  const box = polygonBBox(polygon);
  // BBOX_EPSILON_M: a cheap, fast-path pre-filter — exact equality here
  // is too strict at BNG coordinate scale (~1e5-1e6). A vertex computed
  // via one path (e.g. rotated into the engine's local frame and back)
  // and the SAME true position computed independently (e.g. this
  // function's own `polygon` argument, built a different way) can land
  // a few tens of nanometres apart — genuinely the same point, not a
  // real boundary violation. Found via scripts/fuzz-shapes.ts: a plot
  // vertex sitting exactly ON the eroded boundary's bbox edge was
  // rejected here, below bbox.minX by ~6e-8m, well before
  // properCrossing's own (already-fixed) tolerance ever got a chance to
  // run. 1e-4m (0.1mm) is nanometre-noise-sized relative to any real
  // geometric violation this check needs to catch.
  const BBOX_EPSILON_M = 1e-4;
  for (const [x, y] of rect) {
    if (x < box.minX - BBOX_EPSILON_M || x > box.maxX + BBOX_EPSILON_M || y < box.minY - BBOX_EPSILON_M || y > box.maxY + BBOX_EPSILON_M) {
      return false;
    }
  }
  for (const corner of rect) {
    if (!pointInPolygon(corner, polygon)) return false;
  }
  const n = polygon.length;
  const m = rect.length;
  for (let i = 0; i < n; i++) {
    const pa = polygon[i];
    const pb = polygon[(i + 1) % n];
    for (let j = 0; j < m; j++) {
      const ra = rect[j];
      const rb = rect[(j + 1) % m];
      if (properCrossing(pa, pb, ra, rb)) return false;
    }
  }
  return true;
}

/** SAT overlap test for two convex polygons. True if they overlap (touching edges do not count as overlap). */
export function convexPolygonsOverlap(a: BNGPolygon, b: BNGPolygon): boolean {
  for (const poly of [a, b]) {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];
      const edge = sub(p2, p1);
      const axis: BNGPoint = normalize([edge[1], -edge[0]]);

      let minA = Infinity;
      let maxA = -Infinity;
      for (const pt of a) {
        const proj = dot(pt, axis);
        minA = Math.min(minA, proj);
        maxA = Math.max(maxA, proj);
      }
      let minB = Infinity;
      let maxB = -Infinity;
      for (const pt of b) {
        const proj = dot(pt, axis);
        minB = Math.min(minB, proj);
        maxB = Math.max(maxB, proj);
      }
      const eps = 1e-6;
      if (maxA <= minB + eps || maxB <= minA + eps) return false; // separating axis found
    }
  }
  return true;
}

/** Minimum distance between two polygons (0 if they touch or overlap). Checks every vertex of each against every edge of the other. */
export function minDistanceBetweenPolygons(a: BNGPolygon, b: BNGPolygon): number {
  let min = Infinity;
  const an = a.length;
  const bn = b.length;
  for (const v of a) {
    for (let i = 0; i < bn; i++) {
      min = Math.min(min, distancePointToSegment(v, b[i], b[(i + 1) % bn]));
    }
  }
  for (const v of b) {
    for (let i = 0; i < an; i++) {
      min = Math.min(min, distancePointToSegment(v, a[i], a[(i + 1) % an]));
    }
  }
  return min;
}

/**
 * Find the boundary edge that the entrance point lies on (within
 * tolerance) and return its inward-pointing unit normal plus the edge's
 * unit tangent. Throws if the entrance isn't on any edge — the engine
 * should treat that as an invalid input, not guess.
 */
export function entranceEdgeFrame(
  boundary: BNGPolygon,
  entrance: BNGPoint,
  toleranceM = 0.5
): { normal: BNGPoint; tangent: BNGPoint } {
  const ccw = ensureCCW(boundary);
  const n = ccw.length;
  for (let i = 0; i < n; i++) {
    const a = ccw[i];
    const b = ccw[(i + 1) % n];
    if (distancePointToSegment(entrance, a, b) <= toleranceM) {
      const tangent = normalize(sub(b, a));
      // For a CCW polygon, walking a->b has the interior on your left, so
      // rotating the edge direction +90° CCW, (-dy, dx), points inward.
      const normal: BNGPoint = [-tangent[1], tangent[0]];
      return { normal, tangent };
    }
  }
  throw new Error(
    `entranceEdgeFrame: entrance point [${entrance}] is not within ${toleranceM}m of any boundary edge`
  );
}
