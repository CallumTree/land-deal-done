// The one dark-map filter string, shared by the 2D basemap
// (OsMapBasemap.tsx, applied as a live DOM style.filter) and the 3D
// ground texture (scene3d/captureGroundTexture.ts, baked into the
// captured canvas's pixels via Canvas2D's ctx.filter — a WebGL texture
// has no CSS box to apply a live filter to, so the equivalent transform
// has to be rendered into the pixels themselves). Never duplicated.
//
// Root cause of the original "far too dark" bug, found by simulating
// the exact W3C Filter Effects pixel math against representative OS
// Light colours rather than guessing from screenshots: a near-white
// basemap background inverts to near-BLACK (e.g. 242 -> 13), and
// `brightness()` is MULTIPLICATIVE — 13 * 1.8 is still only 23, still
// black. No post-invert brightness value fixes that; it's the wrong
// lever. MAP_DARK_FILTER instead opens with a brightness() BEFORE the
// invert, pre-darkening the source so the near-white background lands
// on a genuine mid-tone (242 * 0.88 ≈ 213) that inversion turns into a
// real dark slate (255-213 ≈ 42) instead of crushing to zero. The
// post-invert brightness/contrast/saturate then do the brief's own
// suggested job (clarifying roads/buildings/text) on that corrected
// base, instead of fighting a losing battle against near-black.
//
// Verified two ways (no real OS key is available in this session to
// test against the actual tiles — see captureGroundTexture.ts/
// OsMapBasemap.tsx's own sourcing notes):
// 1. Numerically, against representative OS-Light-style sample colours
//    (background/road/building/park/water/text), computing the exact
//    CSS Filter Effects spec matrices — background luminance moves from
//    0.000 (indistinguishable from pure black) to ~0.046 (a real, if
//    dark, slate tone), while road/building/text contrast against that
//    background stays comfortably above the WCAG non-text AA minimum
//    (3:1) and the Grid Runner neon overlay colours (cyan/magenta/
//    violet/green) all stay well above it too, so they keep popping.
// 2. Visually, against a hand-built synthetic "map-like" test pattern
//    (cream background, grey roads, tan buildings, green park, blue
//    water, dark text) in a real headless-browser screenshot.
export const MAP_DARK_FILTER = "brightness(0.88) invert(1) hue-rotate(180deg) brightness(1.6) contrast(1.2) saturate(0.85)";

export type MapTheme = "dark" | "light";

const STORAGE_KEY = "plotline.mapTheme";

/** Reads the remembered map theme preference (localStorage), defaulting to "dark". SSR-safe: returns the default when window isn't available. */
export function readStoredMapTheme(): MapTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function storeMapTheme(theme: MapTheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private-browsing/storage-blocked — the toggle still works for this
    // session, it just won't be remembered next time. Not worth surfacing.
  }
}

/**
 * Bakes MAP_DARK_FILTER into a canvas's actual pixels via Canvas2D's
 * `ctx.filter` (the same filter-function syntax as CSS, applied to
 * subsequent drawing operations) — used by the 3D ground texture, which
 * needs real transformed pixel data for WebGL, not a live DOM filter.
 * Returns a NEW canvas; the source is left untouched.
 */
export function bakeFilterToCanvas(source: HTMLCanvasElement, filter: string): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.filter = filter;
  ctx.drawImage(source, 0, 0);
  return out;
}
