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
