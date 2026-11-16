"use client";

// The site drawing/layout canvas — a real OS Maps API basemap
// (OsMapBasemap) with a vector overlay drawn in the SAME OpenLayers map
// instance (one map, tiles underneath, boundary/layout vectors on top),
// rather than a second hand-synced coordinate system. See OsMapBasemap's
// own header comment for the tile source / projection sourcing notes.
//
// Known v0 gap, stated plainly rather than hidden: there's no address
// search or site lookup yet. The map opens at a fixed placeholder
// location and the user pans/zooms the real map by hand to find their
// actual site before drawing a boundary over it.

import { useCallback, useEffect, useRef, useState } from "react";
import { OsMapBasemap } from "./OsMapBasemap";
import type { BNGPoint, BNGPolygon, HouseTypeId, LayoutResult } from "@/engine/types";

export type DrawMode = "boundary" | "entrance" | "done";

type OlMap = import("ol/Map").default;
type OlVectorSource = import("ol/source/Vector").default;
type OlVectorLayer = import("ol/layer/Vector").default;

// Placeholder dev-canvas palette — grouped by bedroom-count tier (shades
// of one hue per tier) so the pro-view breakdown stays visually
// distinguishable. Not a brand/style decision; style-a/style-b may
// override this per their own visual identity.
const HOUSE_TYPE_COLOR: Record<HouseTypeId, string> = {
  "2-bed-terrace": "#38bdf8",
  "2-bed-semi": "#0ea5e9",
  "2-bed-detached": "#0284c7",
  "3-bed-terrace": "#c4b5fd",
  "3-bed-semi": "#a78bfa",
  "3-bed-detached": "#8b5cf6",
  "3-bed-bungalow": "#14b8a6",
  "4-bed-terrace": "#fcd34d",
  "4-bed-semi": "#fbbf24",
  "4-bed-detached": "#f59e0b",
  "5-bed-detached": "#f43f5e",
};

// Placeholder default view: Pond Bridge, Johnston, Pembrokeshire (a real,
// sourced location — see test-sites/pond-bridge-johnston.json) — picked
// only so the map opens somewhere real in this engine's one implemented
// jurisdiction, not tied to any specific user's site.
const DEFAULT_CENTER_BNG: [number, number] = [193540, 210950];
const DEFAULT_RESOLUTION_M_PER_PX = 20;

/** Nearest point to `click` on any edge of `boundary`, for snapping the entrance onto the boundary the user actually drew. */
function nearestPointOnPolygon(click: BNGPoint, boundary: BNGPolygon): BNGPoint {
  let best: BNGPoint = boundary[0];
  let bestDist = Infinity;
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const lenSq = abx * abx + aby * aby;
    let t = lenSq > 0 ? ((click[0] - a[0]) * abx + (click[1] - a[1]) * aby) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * abx;
    const py = a[1] + t * aby;
    const d = (click[0] - px) ** 2 + (click[1] - py) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = [px, py];
    }
  }
  return best;
}

interface SiteCanvasProps {
  boundary: BNGPolygon;
  entrance: BNGPoint | null;
  layout: LayoutResult | null;
  mode: DrawMode;
  onAddBoundaryPoint: (p: BNGPoint) => void;
  onSetEntrance: (p: BNGPoint) => void;
  /**
   * Called with the full updated point list whenever the user drags an
   * EXISTING boundary corner (mode "done" only — dragging edits an
   * already-drawn site, it's not part of the initial click-to-draw flow).
   */
  onBoundaryChange?: (boundary: BNGPolygon) => void;
  /** Called with the new entrance position (already snapped onto the boundary edge) whenever the user drags the entrance marker, mode "done" only. */
  onEntranceChange?: (entrance: BNGPoint) => void;
  /** true for the whole span of a drag gesture (vertex pointerdown through pointerup/release) — lets the parent run the engine at draft quality while dragging and one final full-quality pass on release. */
  onDragStateChange?: (dragging: boolean) => void;
  /** true: fill the parent container exactly (for a full-bleed layout) instead of the default square card with its own rounded border — the parent decides sizing/chrome in that case. */
  fill?: boolean;
}

export function SiteCanvas({
  boundary,
  entrance,
  layout,
  mode,
  onAddBoundaryPoint,
  onSetEntrance,
  onBoundaryChange,
  onEntranceChange,
  onDragStateChange,
  fill = false,
}: SiteCanvasProps) {
  const [map, setMap] = useState<OlMap | null>(null);
  const redrawRef = useRef<(() => void) | null>(null);
  // True for the whole span of a drag gesture — guards the props->edit-
  // feature sync in redraw() so an external re-render mid-drag (e.g. the
  // draft-quality layout coming back) never overwrites the vertex the
  // user is actively holding with a stale prop position.
  const isDraggingRef = useRef(false);

  // Click handling and redraws both need the LATEST props without
  // re-registering the map click listener or rebuilding the vector layer
  // on every boundary/entrance/layout change — store them in a ref the
  // stable callbacks read from at call time.
  const propsRef = useRef({
    boundary,
    entrance,
    layout,
    mode,
    onAddBoundaryPoint,
    onSetEntrance,
    onBoundaryChange,
    onEntranceChange,
    onDragStateChange,
  });
  useEffect(() => {
    propsRef.current = {
      boundary,
      entrance,
      layout,
      mode,
      onAddBoundaryPoint,
      onSetEntrance,
      onBoundaryChange,
      onEntranceChange,
      onDragStateChange,
    };
  });

  const handleMapChange = useCallback((m: OlMap | null) => setMap(m), []);

  // Set up the vector overlay layer + click handler once, when the map
  // instance first exists. Dynamic imports mirror OsMapBasemap's own
  // pattern (these modules touch the DOM at evaluation time, so they
  // must not load during Next.js's server render pass).
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let layer: OlVectorLayer | undefined;
    let boundaryEditLayer: OlVectorLayer | undefined;
    let entranceEditLayer: OlVectorLayer | undefined;
    let clickKey: import("ol/events").EventsKey | undefined;
    let modify: import("ol/interaction/Modify").default | undefined;
    let translate: import("ol/interaction/Translate").default | undefined;
    let boundaryFeatureChangeKey: import("ol/events").EventsKey | undefined;

    (async () => {
      const [
        { default: VectorSource },
        { default: VectorLayer },
        { default: Feature },
        { default: Polygon },
        { default: Point },
        { default: Style },
        { default: Fill },
        { default: Stroke },
        { default: CircleStyle },
        { default: Modify },
        { default: Translate },
        { default: Collection },
      ] = await Promise.all([
        import("ol/source/Vector"),
        import("ol/layer/Vector"),
        import("ol/Feature"),
        import("ol/geom/Polygon"),
        import("ol/geom/Point"),
        import("ol/style/Style"),
        import("ol/style/Fill"),
        import("ol/style/Stroke"),
        import("ol/style/Circle"),
        import("ol/interaction/Modify"),
        import("ol/interaction/Translate"),
        import("ol/Collection"),
      ]);
      if (cancelled) return;

      const source: OlVectorSource = new VectorSource();
      layer = new VectorLayer({ source, zIndex: 10 });
      map.addLayer(layer);

      // --- Draggable boundary corners + entrance (vertex editing) ---
      // Separate, normally-invisible features/sources from the display
      // layer above — Modify/Translate need a STABLE feature identity to
      // track across an entire drag gesture, which the display layer's
      // own source.clear()-and-rebuild-every-render pattern would break
      // mid-drag. Styled invisible because the display layer already
      // draws the visible boundary outline/vertex dots/entrance marker
      // at the exact same coordinates (kept in sync below) — these exist
      // purely to provide drag behaviour at those same positions, not a
      // second visible layer.
      const invisibleStyle = new Style({});
      const boundaryEditSource = new VectorSource();
      const boundaryEditFeature = new Feature();
      boundaryEditFeature.setStyle(invisibleStyle);
      boundaryEditSource.addFeature(boundaryEditFeature);

      const entranceEditSource = new VectorSource();
      const entranceEditFeature = new Feature();
      entranceEditFeature.setStyle(invisibleStyle);
      entranceEditSource.addFeature(entranceEditFeature);
      entranceEditLayer = new VectorLayer({ source: entranceEditSource, zIndex: 11 });
      map.addLayer(entranceEditLayer);
      boundaryEditLayer = new VectorLayer({ source: boundaryEditSource, zIndex: 11 });
      map.addLayer(boundaryEditLayer);

      modify = new Modify({
        source: boundaryEditSource,
        style: invisibleStyle,
        insertVertexCondition: () => false, // only drag EXISTING corners — no inserting new ones mid-edge
      });
      translate = new Translate({ features: new Collection([entranceEditFeature]) });
      modify.setActive(false);
      translate.setActive(false);
      map.addInteraction(modify);
      map.addInteraction(translate);

      // rAF-coalesced live updates while dragging — OL fires a geometry
      // change on every pointermove, which is far more often than a
      // React state update (and a worker request) needs to run.
      let rafId: number | null = null;
      function scheduleBoundaryChange() {
        // Feedback-loop guard: redraw() below sets this SAME feature's
        // geometry to sync it FROM props whenever boundary/entrance/
        // layout/mode change — and Feature#setGeometry itself fires a
        // 'change' event, which is what this listener is attached to.
        // Without this guard, that prop-sync write would itself trigger
        // this handler, which calls onBoundaryChange, which updates
        // React state, which re-triggers redraw()'s sync, forever. Only
        // forward changes outward while an actual user drag is the
        // source of them.
        if (!isDraggingRef.current) return;
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const ring = (boundaryEditFeature.getGeometry() as InstanceType<typeof Polygon> | undefined)?.getCoordinates()[0];
          if (!ring) return;
          // Drop the closing duplicate vertex Polygon geometries carry.
          const pts: BNGPolygon = ring.slice(0, -1) as BNGPolygon;
          propsRef.current.onBoundaryChange?.(pts);
        });
      }

      modify.on("modifystart", () => {
        isDraggingRef.current = true;
        propsRef.current.onDragStateChange?.(true);
      });
      boundaryFeatureChangeKey = boundaryEditFeature.on("change", scheduleBoundaryChange);
      modify.on("modifyend", () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        const ring = (boundaryEditFeature.getGeometry() as InstanceType<typeof Polygon> | undefined)?.getCoordinates()[0];
        if (ring) propsRef.current.onBoundaryChange?.(ring.slice(0, -1) as BNGPolygon);
        isDraggingRef.current = false;
        propsRef.current.onDragStateChange?.(false);
      });

      let entranceRafId: number | null = null;
      function snapEntranceToBoundary() {
        const geom = entranceEditFeature.getGeometry() as InstanceType<typeof Point> | undefined;
        if (!geom) return;
        const raw = geom.getCoordinates() as BNGPoint;
        const b = propsRef.current.boundary;
        if (b.length < 3) return;
        const snapped = nearestPointOnPolygon(raw, b);
        // Pull the marker back onto the boundary edge as the user drags
        // away from it, rather than letting it float freely.
        geom.setCoordinates(snapped);
        return snapped;
      }
      translate.on("translatestart", () => {
        isDraggingRef.current = true;
        propsRef.current.onDragStateChange?.(true);
      });
      translate.on("translating", () => {
        if (entranceRafId !== null) return;
        entranceRafId = requestAnimationFrame(() => {
          entranceRafId = null;
          const snapped = snapEntranceToBoundary();
          if (snapped) propsRef.current.onEntranceChange?.(snapped);
        });
      });
      translate.on("translateend", () => {
        if (entranceRafId !== null) {
          cancelAnimationFrame(entranceRafId);
          entranceRafId = null;
        }
        const snapped = snapEntranceToBoundary();
        if (snapped) propsRef.current.onEntranceChange?.(snapped);
        isDraggingRef.current = false;
        propsRef.current.onDragStateChange?.(false);
      });

      /** Buffers a straight 2-point road centerline into a rectangle polygon, widthM wide — v0's engine only ever emits a single straight segment per road (see generateLayout.ts), so that's the only case handled. */
      function bufferStraightRoad(centerline: BNGPoint[], widthM: number): BNGPolygon | null {
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

      function redraw() {
        source.clear();
        const { boundary: b, entrance: e, layout: l, mode: m } = propsRef.current;

        // Draggable corners/entrance only make sense once a boundary and
        // entrance already exist. Skip syncing their geometry while a
        // drag is actively in progress — the interaction itself is the
        // source of truth for that span, and overwriting it with a
        // (momentarily stale) prop position would yank the vertex out
        // from under the user's cursor.
        modify?.setActive(m === "done");
        translate?.setActive(m === "done");
        if (m === "done" && !isDraggingRef.current) {
          boundaryEditFeature.setGeometry(b.length >= 3 ? new Polygon([[...b, b[0]]]) : undefined);
          entranceEditFeature.setGeometry(e ? new Point(e) : undefined);
        }

        for (const road of l?.roads ?? []) {
          const rect = bufferStraightRoad(road.centerlineBng, road.widthM);
          if (!rect) continue;
          const f = new Feature(new Polygon([rect]));
          f.setStyle(new Style({ fill: new Fill({ color: "#71717a" }) }));
          source.addFeature(f);
        }

        for (const plot of l?.plots ?? []) {
          if (plot.gardenBng) {
            const f = new Feature(new Polygon([plot.gardenBng]));
            f.setStyle(new Style({ fill: new Fill({ color: "rgba(134,239,172,0.35)" }) }));
            source.addFeature(f);
          }
          const outline = new Feature(new Polygon([plot.plotBng]));
          outline.setStyle(new Style({ stroke: new Stroke({ color: "#a1a1aa", width: 1, lineDash: [3, 3] }) }));
          source.addFeature(outline);

          const footprint = new Feature(new Polygon([plot.footprintBng]));
          footprint.setStyle(
            new Style({
              fill: new Fill({ color: HOUSE_TYPE_COLOR[plot.houseType] }),
              stroke: new Stroke({ color: "#18181b", width: 0.5 }),
            })
          );
          source.addFeature(footprint);
        }

        for (const p of l?.parkingSpacesBng ?? []) {
          const f = new Feature(new Point(p));
          f.setStyle(new Style({ image: new CircleStyle({ radius: 2, fill: new Fill({ color: "#3f3f46" }) }) }));
          source.addFeature(f);
        }

        if (b.length > 0) {
          if (b.length >= 3) {
            const closed = new Feature(new Polygon([[...b, b[0]]]));
            closed.setStyle(
              new Style({ fill: new Fill({ color: "rgba(56,189,248,0.1)" }), stroke: new Stroke({ color: "#0ea5e9", width: 2 }) })
            );
            source.addFeature(closed);
          }
          for (const p of b) {
            const f = new Feature(new Point(p));
            f.setStyle(new Style({ image: new CircleStyle({ radius: 5, fill: new Fill({ color: "#0ea5e9" }) }) }));
            source.addFeature(f);
          }
        }

        if (e) {
          const f = new Feature(new Point(e));
          f.setStyle(
            new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({ color: "rgba(239,68,68,0.25)" }),
                stroke: new Stroke({ color: "#ef4444", width: 2 }),
              }),
            })
          );
          source.addFeature(f);
        }
      }
      redrawRef.current = redraw;
      redraw();

      clickKey = map.on("singleclick", (evt) => {
        const [x, y] = evt.coordinate;
        const { mode: m, boundary: b, onAddBoundaryPoint: add, onSetEntrance: setEnt } = propsRef.current;
        if (m === "boundary") {
          add([x, y]);
        } else if (m === "entrance" && b.length >= 3) {
          setEnt(nearestPointOnPolygon([x, y], b));
        }
      });
    })();

    return () => {
      cancelled = true;
      if (clickKey || boundaryFeatureChangeKey) {
        import("ol/Observable").then(({ unByKey }) => {
          if (clickKey) unByKey(clickKey!);
          if (boundaryFeatureChangeKey) unByKey(boundaryFeatureChangeKey!);
        });
      }
      if (layer) map.removeLayer(layer);
      if (boundaryEditLayer) map.removeLayer(boundaryEditLayer);
      if (entranceEditLayer) map.removeLayer(entranceEditLayer);
      if (modify) map.removeInteraction(modify);
      if (translate) map.removeInteraction(translate);
      redrawRef.current = null;
    };
  }, [map]);

  // Disable double-click-zoom while actively drawing, so a quick second
  // click to place a nearby boundary point doesn't trigger a map zoom.
  useEffect(() => {
    if (!map) return;
    const dblClickZoom = map
      .getInteractions()
      .getArray()
      .find((i) => i.constructor.name === "DoubleClickZoom");
    dblClickZoom?.setActive(mode === "done");
  }, [map, mode]);

  // Redraw the vector overlay whenever the actual data changes (also
  // toggles the drag interactions' active state — see redraw()).
  useEffect(() => {
    redrawRef.current?.();
  }, [boundary, entrance, layout, mode]);

  const canFinishHint = mode === "boundary" && boundary.length >= 3;

  return (
    <div
      className={
        fill
          ? "relative h-full w-full overflow-hidden"
          : "relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
      }
    >
      <OsMapBasemap
        centerBng={DEFAULT_CENTER_BNG}
        resolution={DEFAULT_RESOLUTION_M_PER_PX}
        className="h-full w-full"
        onMapChange={handleMapChange}
      />

      <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs text-zinc-600 shadow-sm dark:bg-zinc-900/90 dark:text-zinc-300">
        {mode === "boundary" &&
          (canFinishHint
            ? "Click to add more boundary points, or tap “Finish boundary”"
            : "Pan/zoom to your site, then click to place boundary points (3+)")}
        {mode === "entrance" && "Click near the boundary to place the site entrance"}
        {mode === "done" && "Layout live — drag a corner or the entrance to adjust, or edit inputs on the right"}
      </div>
    </div>
  );
}
