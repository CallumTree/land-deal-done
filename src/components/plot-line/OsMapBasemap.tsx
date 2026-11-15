"use client";

import { useEffect, useRef, useState } from "react";

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
const OS_LAYER = "Light_3857";
const OS_TILE_SOURCE_EPSG = "EPSG:3857";

// Standard EPSG:27700 (OSGB36 British National Grid) proj4 definition —
// a fixed, decades-old, publicly published transform (not something
// specific to OS's API that needed verifying this session).
const EPSG_27700_PROJ4 =
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";

export interface OsMapBasemapProps {
  /** BNG [easting, northing] to center the map on. */
  centerBng: [number, number];
  /** OpenLayers EPSG:27700 view resolution, metres/pixel — smaller = more zoomed in. ~1 is roughly "building-level". */
  resolution?: number;
  className?: string;
}

type MapStatus = "loading" | "ready" | "error";

export function OsMapBasemap({ centerBng, resolution = 2, className }: OsMapBasemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [tileErrorCount, setTileErrorCount] = useState(0);

  useEffect(() => {
    let destroyed = false;
    let map: import("ol/Map").default | undefined;

    (async () => {
      const [{ default: Map }, { default: View }, { default: TileLayer }, { default: XYZ }, proj4Module, { register }] =
        await Promise.all([
          import("ol/Map"),
          import("ol/View"),
          import("ol/layer/Tile"),
          import("ol/source/XYZ"),
          import("proj4"),
          import("ol/proj/proj4"),
        ]);
      const { get: getProjection } = await import("ol/proj");
      if (destroyed) return;

      const proj4lib = proj4Module.default;
      if (!getProjection("EPSG:27700")) {
        proj4lib.defs("EPSG:27700", EPSG_27700_PROJ4);
        register(proj4lib);
      }

      const apiKey = process.env.NEXT_PUBLIC_OS_API_KEY;
      if (!apiKey) {
        setStatus("error");
        return;
      }

      const tileSource = new XYZ({
        url: `https://api.os.uk/maps/raster/v1/zxy/${OS_LAYER}/{z}/{x}/{y}.png?key=${apiKey}`,
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
        layers: [new TileLayer({ source: tileSource })],
        view: new View({
          projection: "EPSG:27700",
          center: centerBng,
          resolution,
        }),
      });
    })();

    return () => {
      destroyed = true;
      map?.setTarget(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerBng[0], centerBng[1], resolution]);

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full" />
      {status === "error" && (
        <p className="p-2 text-xs text-red-600">
          NEXT_PUBLIC_OS_API_KEY is not set in this environment — the OS basemap can&apos;t load.
        </p>
      )}
      {tileErrorCount > 0 && (
        <p className="p-2 text-xs text-amber-600">
          {tileErrorCount} OS tile request{tileErrorCount === 1 ? "" : "s"} failed to load at the current view.
        </p>
      )}
    </div>
  );
}
