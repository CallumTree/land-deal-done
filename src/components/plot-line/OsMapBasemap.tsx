"use client";

import { useEffect, useRef, useState } from "react";
import { buildOsTileUrlTemplate, ensureBngProjectionRegistered, OS_TILE_SOURCE_EPSG } from "./osTiles";
import { MAP_DARK_FILTER } from "./mapFilter";

const TILE_CANVAS_CLASS = "os-tile-canvas";

// OS Data Hub's "OS Maps API" ZXY raster tile basemap.
//
// Endpoint confirmed against OS's own docs.os.uk technical spec (via
// search-engine synthesis of that page, cross-checked against
// OrdnanceSurvey's own GitHub demo repo, which independently agrees on
// the path shape, key-as-query-param, and EPSG:27700/EPSG:3857 support —
// direct fetches of docs.os.uk were blocked by this session's own tool-
// permission classifier, twice, not by the network host allowlist,
// which does include docs.os.uk):
//   https://api.os.uk/maps/raster/v1/zxy/{layer}/{z}/{x}/{y}.png?key=...
// Layers include Road/Outdoor/Light/Night (both _27700 and _3857
// variants) and Leisure (_27700 only) — "Night" is only attested by the
// GitHub repo (archived 2021, so flagged as possibly stale) and not
// independently confirmed; this component uses "Light", attested by
// both sources.
//
// Projection choice, flagged explicitly: the MAP VIEW is EPSG:27700
// (British National Grid) — the same plane the engine and the rest of
// this app's boundary/layout data already use, so nothing needs
// reprojecting for the vector overlay. The TILE SOURCE uses the
// "_3857" (Web Mercator) layer variant, not "_27700" — getting
// EPSG:27700's exact tile-matrix definition (origin, per-zoom
// resolutions) wrong would silently misalign tiles, and that exact
// definition is normally read from OS's own WMTS GetCapabilities
// document, which this session couldn't fetch (same blocked-access
// issue as above). OpenLayers reprojects a _3857 XYZ source into a
// _27700 view automatically and correctly — a well-tested, standard
// capability — so this sidesteps needing those unverified BNG tile-grid
// numbers at all. Revisit with the _27700 layer + a fetched
// GetCapabilities document once docs.os.uk is reachable.
//
// The key/URL/layer values themselves now live in ./osTiles.ts, shared
// with the 3D ground-texture capture (scene3d/captureGroundTexture.ts)
// so both consumers are guaranteed to use the exact same key and tile
// source — never a second, drifted copy of this config.

export interface OsMapBasemapProps {
  /** BNG [easting, northing] to center the map on. Only used on first mount — the map's own pan/zoom interactions own the view after that, same as any normal interactive map. */
  centerBng: [number, number];
  /** OpenLayers EPSG:27700 view resolution, metres/pixel — smaller = more zoomed in. ~1 is roughly "building-level". Only used on first mount, see centerBng. */
  resolution?: number;
  className?: string;
  /**
   * Dark-mode tile treatment for the "Grid Runner" look. NOT an OS
   * vector-tile "night" style — this session has no way to test the
   * real OS Data Hub key locally (it exists only in Vercel's
   * environment), and "Night" is attested by exactly one archived,
   * unconfirmed secondary source (see the layer-sourcing comment
   * above); rather than ship an unverified raster layer name that might
   * 404 or might not even be this exact ZXY raster product, this
   * applies MAP_DARK_FILTER (see ./mapFilter.ts) directly to the
   * already-proven-working "Light" layer's own canvas, found via a
   * fixed marker class so it never touches the vector overlay's
   * separate canvas. Reactive to changes (the Dark/Light toggle), not
   * just read at mount — toggling never refetches tiles or recreates
   * the map, it only adds/removes the filter style.
   */
  dark?: boolean;
  /**
   * Called once the real `ol/Map` instance exists, so a parent (e.g.
   * SiteCanvas) can add its own vector layers and click handlers onto
   * the SAME map — one map, one set of tiles, drawing on top, rather
   * than a second map instance or a hand-synced overlay. Called again
   * with `null` just before the map is torn down.
   */
  onMapChange?: (map: import("ol/Map").default | null) => void;
}

type MapStatus = "loading" | "ready" | "error";

/** Finds the tile layer's own canvas (marked with TILE_CANVAS_CLASS, set once at layer creation) inside `container` and sets or clears its filter directly — a live DOM style, not a CSS class, so both this and the 3D ground texture's baked-pixel version can be driven off the exact same MAP_DARK_FILTER string. */
function applyFilter(container: HTMLDivElement, dark: boolean) {
  const canvas = container.querySelector<HTMLElement>(`.${TILE_CANVAS_CLASS} canvas, canvas.${TILE_CANVAS_CLASS}`);
  if (canvas) canvas.style.filter = dark ? MAP_DARK_FILTER : "";
}

export function OsMapBasemap({ centerBng, resolution = 2, className, dark = false, onMapChange }: OsMapBasemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [tileErrorCount, setTileErrorCount] = useState(0);
  // Read by the map's own 'rendercomplete' listener (registered once,
  // below) — NOT a one-off "apply now" value. OL creates the tile
  // layer's actual <canvas> asynchronously (on its own first render
  // pass, after `new Map()` returns), so a single apply-the-filter-now
  // call right after construction races OL and silently finds no
  // canvas yet. Hooking 'rendercomplete' instead means the filter gets
  // (re)applied every time OL actually finishes painting — self-
  // correcting regardless of that timing, and it's what makes toggling
  // instant without waiting for another tile fetch. Caught via a real
  // browser check: getComputedStyle on the tile canvas reported `none`
  // under the old one-off approach even though React's `dark` prop and
  // the toggle button's own label were both correctly "Dark".
  const darkRef = useRef(dark);
  useEffect(() => {
    darkRef.current = dark;
  });

  useEffect(() => {
    let destroyed = false;
    let map: import("ol/Map").default | undefined;
    // centerBng/resolution are read once, below, as the map's initial
    // view only — intentionally NOT in this effect's deps (see empty
    // array at the bottom). The map owns its own pan/zoom after that;
    // re-running this on every centerBng/resolution change would tear
    // down and recreate the whole map (and the parent's vector overlay
    // riding on it, via onMapChange) on every pan, which is both wrong
    // and visibly janky.
    const initialCenterBng = centerBng;
    const initialResolution = resolution;

    (async () => {
      const [{ default: Map }, { default: View }, { default: TileLayer }, { default: XYZ }] = await Promise.all([
        import("ol/Map"),
        import("ol/View"),
        import("ol/layer/Tile"),
        import("ol/source/XYZ"),
      ]);
      await ensureBngProjectionRegistered();
      if (destroyed) return;

      const tileUrlTemplate = buildOsTileUrlTemplate();
      if (!tileUrlTemplate) {
        setStatus("error");
        return;
      }

      const tileSource = new XYZ({
        url: tileUrlTemplate,
        projection: OS_TILE_SOURCE_EPSG,
        crossOrigin: "anonymous",
      });

      let firstTileSeen = false;
      tileSource.on("tileloadend", () => {
        if (destroyed) return;
        if (!firstTileSeen) {
          firstTileSeen = true;
          setStatus("ready");
        }
      });
      tileSource.on("tileloaderror", () => {
        if (destroyed) return;
        setTileErrorCount((c) => c + 1);
      });

      if (!containerRef.current) return;
      map = new Map({
        target: containerRef.current,
        layers: [new TileLayer({ source: tileSource, className: TILE_CANVAS_CLASS })],
        view: new View({
          projection: "EPSG:27700",
          center: initialCenterBng,
          resolution: initialResolution,
        }),
      });
      // The real fix for the mount-timing race (see darkRef's own
      // comment above): re-applies on every OL render, so it's correct
      // the first time the tile canvas genuinely exists, and stays
      // correct through any later redraw regardless of what triggered
      // it. The immediate call right after is just a harmless, non-
      // load-bearing best-effort first try.
      map.on("rendercomplete", () => {
        if (containerRef.current) applyFilter(containerRef.current, darkRef.current);
      });
      applyFilter(containerRef.current, dark);
      onMapChange?.(map);
    })();

    return () => {
      destroyed = true;
      onMapChange?.(null);
      map?.setTarget(undefined);
    };
    // Deliberately empty: this effect creates the map exactly once per
    // mount — see the comment above initialCenterBng/initialResolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive to the Dark/Light toggle, independent of the mount effect
  // above — flips the filter on the existing tile canvas directly,
  // never recreating the map or refetching tiles.
  useEffect(() => {
    if (containerRef.current) applyFilter(containerRef.current, dark);
  }, [dark]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />
      {/* Stacked below top-14 rather than flush against the container's
          own top edge — clears a parent's floating top chrome (e.g. the
          Grid Runner top pill), which this component has no knowledge
          of, without needing that parent to coordinate z-index/position. */}
      <div className="pointer-events-none absolute inset-x-2 top-14 z-10 flex flex-col gap-1 text-center text-xs font-medium text-black">
        {status === "error" && (
          <p className="rounded-md bg-grid-amber/90 p-2">
            NEXT_PUBLIC_OS_API_KEY is not set in this environment — the OS basemap can&apos;t load.
          </p>
        )}
        {tileErrorCount > 0 && (
          <p className="rounded-md bg-grid-amber/80 p-1.5 text-[11px]">
            {tileErrorCount} OS tile request{tileErrorCount === 1 ? "" : "s"} failed to load at the current view.
          </p>
        )}
      </div>
    </div>
  );
}
