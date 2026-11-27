// Slope and elevation for a site, read straight from the Welsh
// Government's Wales-wide LiDAR DTM Cloud Optimised GeoTIFF (32-bit
// float, 1m pixels, EPSG:27700 — the same grid the engine works in, so
// no reprojection). geotiff.js reads only the byte ranges covering the
// site's own bounding box, not the 48GB file.
//
// Server-only: the blob host doesn't send CORS headers for this app's
// origin, so the browser can't read it directly.

import { fromUrl } from "geotiff";
import type { BNGPolygon } from "@/engine/types";

export const LIDAR_COG_URL = "https://dmwproductionblob.blob.core.windows.net/cogs/lidar/wales_dtm_32bit_cog.tif";
export const LIDAR_SOURCE_NAME = "Welsh Government LiDAR, 1m terrain model (DataMapWales)";

/** Largest site bounding-box side we'll read (m). 1.5km x 1.5km = 2.25M float pixels, ~9MB. */
export const MAX_SIDE_M = 1500;

/** A site must have LiDAR for at least this share of its pixels, else we say "not available" rather than guess. Pixels outside Wales are nodata in this COG, so this is also the "is it in Wales?" test. */
const MIN_VALID_FRACTION = 0.9;

const GRADIENT_1_IN_15 = 1 / 15;
const GRADIENT_1_IN_10 = 1 / 10;
/** Smoothing kernel radius in pixels (1m each) — see the comment where it's used. */
const SMOOTH_R = 2;

interface OpenCog {
  image: Awaited<ReturnType<Awaited<ReturnType<typeof fromUrl>>["getImage"]>>;
  originX: number;
  originY: number;
  width: number;
  height: number;
  nodata: number | null;
  lastModified: string;
}

// Reused across requests on a warm function instance: opening the COG
// costs a header round-trip or two, the per-site read is the rest.
let cogPromise: Promise<OpenCog> | null = null;

async function openCog(): Promise<OpenCog> {
  if (!cogPromise) {
    cogPromise = (async () => {
      const tiff = await fromUrl(LIDAR_COG_URL, { allowFullFile: false });
      const image = await tiff.getImage(0);
      const [originX, originY] = image.getOrigin();
      const [resX, resY] = image.getResolution();
      if (Math.abs(resX - 1) > 1e-6 || Math.abs(resY + 1) > 1e-6) throw new Error(`Unexpected LiDAR resolution ${resX},${resY}`);
      // The COG's own Last-Modified, read once, is the honest "date" for
      // this source — the file itself states no survey date.
      let lastModified = "";
      try {
        const head = await fetch(LIDAR_COG_URL, { method: "HEAD", signal: AbortSignal.timeout(8000) });
        lastModified = head.headers.get("last-modified") ?? "";
      } catch {
        // Date is nice-to-have; the numbers don't depend on it.
      }
      return { image, originX, originY, width: image.getWidth(), height: image.getHeight(), nodata: image.getGDALNoData(), lastModified };
    })();
    cogPromise.catch(() => {
      cogPromise = null; // don't cache a failure
    });
  }
  return cogPromise;
}

export type TerrainResult =
  | {
      ok: true;
      minM: number;
      maxM: number;
      steeperThan1in15Pct: number;
      steeperThan1in10Pct: number;
      sourceDate: string;
    }
  | { ok: false; reason: "outside-coverage" | "too-large" };

/**
 * For each pixel row, the x-intervals (in pixel-centre column indices)
 * that fall inside `boundary` — an even-odd scanline fill, far cheaper
 * than a point-in-polygon test per pixel.
 */
function insideSpans(boundary: BNGPolygon, rowCentreY: number, colToX: (c: number) => number, cols: number): Array<[number, number]> {
  const xs: number[] = [];
  for (let i = 0; i < boundary.length; i++) {
    const [x1, y1] = boundary[i];
    const [x2, y2] = boundary[(i + 1) % boundary.length];
    if ((y1 <= rowCentreY && y2 > rowCentreY) || (y2 <= rowCentreY && y1 > rowCentreY)) {
      xs.push(x1 + ((rowCentreY - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  xs.sort((a, b) => a - b);
  const spans: Array<[number, number]> = [];
  const x0 = colToX(0);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const c0 = Math.max(0, Math.ceil(xs[k] - x0));
    const c1 = Math.min(cols - 1, Math.floor(xs[k + 1] - x0));
    if (c1 >= c0) spans.push([c0, c1]);
  }
  return spans;
}

export async function analyseTerrain(boundary: BNGPolygon): Promise<TerrainResult> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of boundary) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (maxX - minX > MAX_SIDE_M || maxY - minY > MAX_SIDE_M) return { ok: false, reason: "too-large" };

  const cog = await openCog();

  // Pixel window: the bbox plus an apron so the smoothing kernel and the
  // 3x3 gradient both have real neighbours at the site's own edge.
  const PAD = SMOOTH_R + 1;
  const c0 = Math.floor(minX - cog.originX) - PAD;
  const c1 = Math.ceil(maxX - cog.originX) + PAD;
  const r0 = Math.floor(cog.originY - maxY) - PAD;
  const r1 = Math.ceil(cog.originY - minY) + PAD;
  if (c0 < 0 || r0 < 0 || c1 > cog.width || r1 > cog.height) return { ok: false, reason: "outside-coverage" };

  const cols = c1 - c0;
  const rows = r1 - r0;
  const rasters = await cog.image.readRasters({ window: [c0, r0, c1, r1], interleave: false });
  const z = (rasters as unknown as ArrayLike<number>[])[0];
  const nodata = cog.nodata ?? -9999;
  const valid = (v: number) => Number.isFinite(v) && v !== nodata && v > -1000;

  // 5x5 mean smoothing first: 1m LiDAR picks up hedge banks, ditches,
  // garden walls and kerbs, which read as "steep" over a metre or two but
  // don't change what a plot or road can be built on. The gradient is
  // then taken over the smoothed surface (Horn's method), so the slope
  // reported is over roughly a 5-7m baseline — about one plot frontage.
  const k = 2 * SMOOTH_R + 1;
  const smooth = new Float32Array(cols * rows).fill(NaN);
  for (let r = SMOOTH_R; r < rows - SMOOTH_R; r++) {
    for (let c = SMOOTH_R; c < cols - SMOOTH_R; c++) {
      let sum = 0;
      let n = 0;
      for (let dr = -SMOOTH_R; dr <= SMOOTH_R; dr++) {
        for (let dc = -SMOOTH_R; dc <= SMOOTH_R; dc++) {
          const v = z[(r + dr) * cols + (c + dc)];
          if (valid(v)) { sum += v; n++; }
        }
      }
      if (n === k * k) smooth[r * cols + c] = sum / n;
    }
  }

  let inside = 0, validInside = 0, slopeCounted = 0, steep15 = 0, steep10 = 0;
  let zMin = Infinity, zMax = -Infinity;
  const colToX = (c: number) => cog.originX + c0 + c + 0.5;
  for (let r = PAD; r < rows - PAD; r++) {
    const y = cog.originY - (r0 + r + 0.5);
    for (const [s0, s1] of insideSpans(boundary, y, colToX, cols)) {
      for (let c = Math.max(s0, PAD); c <= Math.min(s1, cols - 1 - PAD); c++) {
        inside++;
        const v = z[r * cols + c];
        if (!valid(v)) continue;
        validInside++;
        if (v < zMin) zMin = v;
        if (v > zMax) zMax = v;
        const a = smooth[(r - 1) * cols + c - 1], b = smooth[(r - 1) * cols + c], cc = smooth[(r - 1) * cols + c + 1];
        const d = smooth[r * cols + c - 1], f = smooth[r * cols + c + 1];
        const g = smooth[(r + 1) * cols + c - 1], h = smooth[(r + 1) * cols + c], i = smooth[(r + 1) * cols + c + 1];
        if ([a, b, cc, d, f, g, h, i].some(Number.isNaN)) continue;
        const dzdx = (cc + 2 * f + i - (a + 2 * d + g)) / 8;
        const dzdy = (g + 2 * h + i - (a + 2 * b + cc)) / 8;
        const grad = Math.hypot(dzdx, dzdy);
        slopeCounted++;
        if (grad > GRADIENT_1_IN_15) steep15++;
        if (grad > GRADIENT_1_IN_10) steep10++;
      }
    }
  }

  if (inside === 0 || validInside / inside < MIN_VALID_FRACTION || slopeCounted === 0) return { ok: false, reason: "outside-coverage" };

  return {
    ok: true,
    minM: zMin,
    maxM: zMax,
    steeperThan1in15Pct: (steep15 / slopeCounted) * 100,
    steeperThan1in10Pct: (steep10 / slopeCounted) * 100,
    sourceDate: cog.lastModified,
  };
}
