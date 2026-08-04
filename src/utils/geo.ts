// Shared local-plane geometry helpers.
//
// Coordinates are converted from WGS84 lng/lat into a local metres-based
// equirectangular plane (centred on a chosen origin) before any distance,
// rotation, or containment math — rotating or measuring raw degrees would
// distort shapes away from the equator. Everything converts back to
// GeoJSON (WGS84) once geometry work is done.

export type XY = [number, number];

const M_PER_DEG_LAT = 110540;

export function toLocalXY([lng, lat]: XY, origin: XY): XY {
  const latRad = (origin[1] * Math.PI) / 180;
  const mPerDegLng = 111320 * Math.cos(latRad);
  return [(lng - origin[0]) * mPerDegLng, (lat - origin[1]) * M_PER_DEG_LAT];
}

export function toLngLat([x, y]: XY, origin: XY): XY {
  const latRad = (origin[1] * Math.PI) / 180;
  const mPerDegLng = 111320 * Math.cos(latRad);
  return [origin[0] + x / mPerDegLng, origin[1] + y / M_PER_DEG_LAT];
}

export function rotatePoint([x, y]: XY, angleRad: number): XY {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return [x * cos - y * sin, x * sin + y * cos];
}

export function pointInPolygon([x, y]: XY, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Shortest distance from point p to the segment a-b, in the same units as the input coordinates. */
export function distancePointToSegment(p: XY, a: XY, b: XY): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSq : 0;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

/**
 * X-interval(s) a polygon ring covers at a given Y, using the same even-odd
 * crossing rule as pointInPolygon (kept consistent with it deliberately) so
 * a row's usable width can be read directly from the boundary's real shape
 * instead of its bounding box.
 */
export function polygonXIntervalsAtY(ring: XY[], y: number): Array<[number, number]> {
  const xs: number[] = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y) {
      xs.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
    }
  }
  xs.sort((a, b) => a - b);
  const intervals: Array<[number, number]> = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    intervals.push([xs[i], xs[i + 1]]);
  }
  return intervals;
}

/** Intersect two sets of sorted, non-overlapping [lo, hi] intervals. */
export function intersectIntervals(
  a: Array<[number, number]>,
  b: Array<[number, number]>
): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]);
    const hi = Math.min(a[i][1], b[j][1]);
    if (lo < hi) result.push([lo, hi]);
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return result;
}

/** Remove a [keepoutLo, keepoutHi] gap from a set of intervals (splitting or trimming as needed). */
export function subtractKeepout(
  intervals: Array<[number, number]>,
  keepoutLo: number,
  keepoutHi: number
): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (const [lo, hi] of intervals) {
    if (keepoutHi <= lo || keepoutLo >= hi) {
      result.push([lo, hi]);
      continue;
    }
    if (keepoutLo > lo) result.push([lo, keepoutLo]);
    if (keepoutHi < hi) result.push([keepoutHi, hi]);
  }
  return result;
}
