import type { BNGPoint, BNGPolygon } from "@/engine/types";

/** Buffers a straight 2-point road centerline into a rectangle polygon, widthM wide — v0's engine only ever emits a single straight segment per road (see generateLayout.ts), so that's the only case handled. Shared by SiteCanvas (2D) and scene3d (3D) so the road footprint is identical in both views. */
export function bufferStraightRoad(centerline: BNGPoint[], widthM: number): BNGPolygon | null {
  if (centerline.length < 2) return null;
  const [a, b] = centerline;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const nx = (-dy / len) * (widthM / 2);
  const ny = (dx / len) * (widthM / 2);
  return [
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
    [a[0] - nx, a[1] - ny],
  ];
}
