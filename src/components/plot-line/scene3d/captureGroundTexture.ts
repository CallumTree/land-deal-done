"use client";

// Ground texture for the 3D floor: real OS raster tiles draped flat over
// the site extent, per the brief's "reuse the existing key and tile
// URL". Rather than re-implement Web Mercator tile math / stitching
// from scratch, this spins up a second, throwaway, OFF-SCREEN OpenLayers
// map using the exact same tile source config as the 2D basemap
// (./osTiles.ts) and captures its rendered canvas — reusing OL's
// already-proven tile fetching/reprojection instead of a second,
// parallel implementation. The user's real 2D map is never touched by
// this (no shared state, no pan/zoom side effects on it).
//
// Never logs or prints anything containing the API key — only numeric
// extent/error-count results leave this module.

import type { BNGPolygon } from "@/engine/types";
import { buildOsTileUrlTemplate, ensureBngProjectionRegistered, OS_TILE_SOURCE_EPSG } from "../osTiles";
import { bakeFilterToCanvas, MAP_DARK_FILTER } from "../mapFilter";
import { polygonExtent } from "./coords";

export interface GroundTextureResult {
  /** The rendered tile canvas — null if no API key is configured, or if every tile request failed (e.g. this session's local dummy key, which OS's CORS error path doesn't send Access-Control-Allow-Origin for — a tainted/unusable canvas would throw inside WebGL's texture upload, so it's never handed back as one). */
  canvas: HTMLCanvasElement | null;
  /** How many tile requests failed — purely informational. */
  tileErrorCount: number;
  /** The exact BNG extent the canvas covers, relative to `origin` (scene [x,z] half-extents) — sizes the ground plane so the texture lines up with the homes/roads/boundary built from the same origin. */
  halfWidth: number;
  halfHeight: number;
}

const CANVAS_PX = 512; // Texture resolution — one flat ground plane, no per-frame cost, so this is a one-off fetch/draw, not a perf concern. 512 is plenty for a texture viewed from a 45°+ orbit camera.
const PADDING_FACTOR = 1.15; // 15% margin beyond the boundary's own bounding box, so the ground doesn't end exactly at the site edge.
const MIN_SPAN_M = 40; // Floor for a degenerate/tiny test boundary, so the resolution calc below never divides by ~0.
const RENDER_TIMEOUT_MS = 6000; // If tiles never finish loading (bad network/key), resolve anyway rather than hang the 3D view open forever.

/**
 * `boundary` is used to compute both the OL view's centre/resolution AND
 * (by the caller, Scene3D.tsx) the scene origin — both via the same
 * bounding-box-centre math (coords.ts's polygonExtent/extentCenter), so
 * the returned canvas's real-world centre always coincides with scene
 * (0,0,0). That equivalence is relied on rather than re-derived here.
 */
export async function captureGroundTexture(boundary: BNGPolygon, dark: boolean): Promise<GroundTextureResult | null> {
  const tileUrlTemplate = buildOsTileUrlTemplate();
  if (!tileUrlTemplate || boundary.length < 3) return null;

  const extent = polygonExtent(boundary);
  const spanX = (extent.maxX - extent.minX) * PADDING_FACTOR;
  const spanY = (extent.maxY - extent.minY) * PADDING_FACTOR;
  const span = Math.max(spanX, spanY, MIN_SPAN_M);
  const resolution = span / CANVAS_PX;
  const centerBng: [number, number] = [(extent.minX + extent.maxX) / 2, (extent.minY + extent.maxY) / 2];

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${CANVAS_PX}px`;
  container.style.height = `${CANVAS_PX}px`;
  document.body.appendChild(container);

  try {
    const [{ default: Map }, { default: View }, { default: TileLayer }, { default: XYZ }] = await Promise.all([
      import("ol/Map"),
      import("ol/View"),
      import("ol/layer/Tile"),
      import("ol/source/XYZ"),
    ]);
    await ensureBngProjectionRegistered();

    const tileSource = new XYZ({ url: tileUrlTemplate, projection: OS_TILE_SOURCE_EPSG, crossOrigin: "anonymous" });
    let tileErrorCount = 0;
    let tileSuccessCount = 0;
    tileSource.on("tileloaderror", () => {
      tileErrorCount++;
    });
    tileSource.on("tileloadend", () => {
      tileSuccessCount++;
    });

    const map = new Map({
      target: container,
      layers: [new TileLayer({ source: tileSource })],
      view: new View({ projection: "EPSG:27700", center: centerBng, resolution }),
      controls: [],
      interactions: [],
    });

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, RENDER_TIMEOUT_MS);
      map.once("rendercomplete", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    const halfWidth = span / 2;
    const halfHeight = span / 2;

    // Only hand back a canvas when every tile genuinely loaded — a
    // canvas with any failed tile (e.g. this session's local dummy key,
    // which OS's error response doesn't send CORS headers for) would
    // either show visible gaps or throw a SecurityError when WebGL
    // tries to upload it as a texture (a tainted canvas). Scene3D.tsx
    // falls back to a flat tinted ground plane when canvas is null.
    const rawCanvas = map.getViewport()?.querySelector("canvas");
    let usableCanvas = rawCanvas && tileSuccessCount > 0 && tileErrorCount === 0 ? rawCanvas : null;

    // Bake the exact same filter the 2D basemap applies live — a WebGL
    // texture has no CSS box to filter, so the equivalent has to be
    // rendered into the pixels themselves (see mapFilter.ts). Done here,
    // on the throwaway capture canvas, before the real `<canvas>` is torn
    // down — never touches the live map.
    if (usableCanvas && dark) {
      usableCanvas = bakeFilterToCanvas(usableCanvas, MAP_DARK_FILTER);
    }

    map.setTarget(undefined);
    document.body.removeChild(container);

    return { canvas: usableCanvas, tileErrorCount, halfWidth, halfHeight };
  } catch {
    if (container.parentNode) document.body.removeChild(container);
    return null;
  }
}
