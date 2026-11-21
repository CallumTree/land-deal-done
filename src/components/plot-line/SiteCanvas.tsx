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
import { GRID_AMBER, GRID_CYAN, GRID_GREEN, GRID_KEEPCLEAR, HOUSE_TYPE_COLOR, ROAD_GREY_BLUE } from "./gridColors";
import { bufferStraightRoad } from "./bufferRoad";
import type { BNGPoint, BNGPolygon, LayoutResult } from "@/engine/types";

export type DrawMode = "boundary" | "entrance" | "restriction" | "done";

/**
 * A repeating diagonal-stripe CanvasPattern for "keep clear" zone fills —
 * land set aside, not an error (see gridColors.ts's GRID_KEEPCLEAR), so a
 * hatch rather than a solid block reads as "excluded area," not "red
 * alert." Built once lazily (needs `document`, so only on the client)
 * and cached — every zone on the map reuses the same pattern instance.
 */
let keepClearHatchCache: CanvasPattern | null | undefined;
function getKeepClearHatch(): CanvasPattern | null {
  if (keepClearHatchCache !== undefined) return keepClearHatchCache;
  if (typeof document === "undefined") return null;
  const size = 10;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    keepClearHatchCache = null;
    return null;
  }
  ctx.strokeStyle = "rgba(111,168,184,0.8)"; // GRID_KEEPCLEAR
  ctx.lineWidth = 1.5;
  // Three parallel diagonals (one through the tile, two half-offset at
  // the edges) so the 45-degree stripe tiles seamlessly with no visible seam.
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-size / 2, size / 2);
  ctx.lineTo(size / 2, -size / 2);
  ctx.moveTo(size / 2, size * 1.5);
  ctx.lineTo(size * 1.5, size / 2);
  ctx.stroke();
  keepClearHatchCache = ctx.createPattern(canvas, "repeat");
  return keepClearHatchCache;
}

type OlMap = import("ol/Map").default;
type OlVectorSource = import("ol/source/Vector").default;
type OlVectorLayer = import("ol/layer/Vector").default;

// "Grid Runner" map palette — see ./gridColors.ts, shared with the 3D
// scene so colours never drift between the two views. A plot in
// `tightPlotIds` (a per-plot hard-rule check the engine actually failed
// — see ComplianceCheck.affectedPlotIds) gets an amber outline instead
// of the normal one, regardless of its fill colour.

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
  /** Completed "keep clear" zones (always hard+choice when drawn here — see page.tsx) — rendered with a diagonal-hatch fill regardless of mode. */
  restrictions?: BNGPolygon[];
  /** Points placed so far for the zone currently being drawn (mode "restriction" only) — rendered like the boundary's own in-progress draft, in GRID_KEEPCLEAR instead of cyan. */
  draftRestriction?: BNGPolygon;
  /** Called on each click while mode is "restriction", appending a point to the in-progress zone — same click-to-add interaction as onAddBoundaryPoint. */
  onAddRestrictionPoint?: (p: BNGPoint) => void;
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
  /**
   * Set this (e.g. from a postcode search result) to animate the map to
   * a new BNG location/resolution. `key` must change on every request
   * — including a repeat search of the same postcode — since this is
   * read via a plain prop-change effect, not a queue; an unchanged `key`
   * with an identical center would not re-trigger the animation.
   */
  flyTo?: { center: BNGPoint; resolution?: number; key: number };
  /** Plot ids a per-plot hard-rule check actually failed (ComplianceCheck.affectedPlotIds, unioned across checks) — drawn with an amber outline instead of the normal one. */
  tightPlotIds?: ReadonlySet<string>;
  /** true: fill the parent container exactly (for a full-bleed layout) instead of the default square card with its own rounded border — the parent decides sizing/chrome in that case. */
  fill?: boolean;
  /** Mirrors the Dark/Light map toggle — forwarded straight to OsMapBasemap's own `dark` prop (see mapFilter.ts). Defaults to true (dark) to match this app's default. */
  dark?: boolean;
  /** Called on every map tap/click, before any mode-specific handling (adding a boundary point, setting the entrance, or nothing in "done" mode) — lets the parent collapse an overlapping bottom sheet back to peek so the map stays reachable. */
  onMapInteraction?: () => void;
}

const EMPTY_TIGHT_IDS: ReadonlySet<string> = new Set();
const EMPTY_RESTRICTIONS: BNGPolygon[] = [];
const EMPTY_DRAFT_RESTRICTION: BNGPolygon = [];

export function SiteCanvas({
  boundary,
  entrance,
  layout,
  mode,
  onAddBoundaryPoint,
  onSetEntrance,
  restrictions = EMPTY_RESTRICTIONS,
  draftRestriction = EMPTY_DRAFT_RESTRICTION,
  onAddRestrictionPoint,
  onBoundaryChange,
  onEntranceChange,
  onDragStateChange,
  flyTo,
  tightPlotIds = EMPTY_TIGHT_IDS,
  fill = false,
  dark = true,
  onMapInteraction,
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
    tightPlotIds,
    restrictions,
    draftRestriction,
    onAddBoundaryPoint,
    onSetEntrance,
    onAddRestrictionPoint,
    onBoundaryChange,
    onEntranceChange,
    onDragStateChange,
    onMapInteraction,
  });
  useEffect(() => {
    propsRef.current = {
      boundary,
      entrance,
      layout,
      mode,
      tightPlotIds,
      restrictions,
      draftRestriction,
      onAddBoundaryPoint,
      onSetEntrance,
      onAddRestrictionPoint,
      onBoundaryChange,
      onEntranceChange,
      onDragStateChange,
      onMapInteraction,
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

      function redraw() {
        source.clear();
        const { boundary: b, entrance: e, layout: l, mode: m, tightPlotIds: tight, restrictions: zones, draftRestriction: draftZone } = propsRef.current;

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
          f.setStyle(new Style({ fill: new Fill({ color: ROAD_GREY_BLUE }) }));
          source.addFeature(f);
        }

        for (const plot of l?.plots ?? []) {
          if (plot.gardenBng) {
            const f = new Feature(new Polygon([plot.gardenBng]));
            f.setStyle(new Style({ fill: new Fill({ color: "rgba(39,255,138,0.10)" }) }));
            source.addFeature(f);
          }
          const isTight = tight.has(plot.id);
          const outline = new Feature(new Polygon([plot.plotBng]));
          outline.setStyle(
            new Style({ stroke: new Stroke({ color: "rgba(166,176,200,0.45)", width: 1, lineDash: [3, 3] }) })
          );
          source.addFeature(outline);

          const footprint = new Feature(new Polygon([plot.footprintBng]));
          footprint.setStyle(
            new Style({
              fill: new Fill({ color: HOUSE_TYPE_COLOR[plot.houseType] }),
              stroke: new Stroke({ color: isTight ? GRID_AMBER : "rgba(232,236,255,0.3)", width: isTight ? 2 : 0.5 }),
            })
          );
          source.addFeature(footprint);
        }

        for (const p of l?.parkingSpacesBng ?? []) {
          const f = new Feature(new Point(p));
          f.setStyle(new Style({ image: new CircleStyle({ radius: 2, fill: new Fill({ color: "rgba(166,176,200,0.6)" }) }) }));
          source.addFeature(f);
        }

        // "Keep clear" zones — land set aside, not an error, so a
        // diagonal hatch (not a solid red/amber block) plus a calm
        // outline. Rendered regardless of mode, so a drawn zone stays
        // visible once the user moves on to "done".
        const hatch = getKeepClearHatch();
        for (const zone of zones) {
          if (zone.length < 3) continue;
          const f = new Feature(new Polygon([[...zone, zone[0]]]));
          f.setStyle(
            new Style({
              fill: new Fill({ color: hatch ?? "rgba(111,168,184,0.18)" }), // plain tint fallback if canvas pattern creation ever fails
              stroke: new Stroke({ color: GRID_KEEPCLEAR, width: 1.5, lineDash: [5, 4] }),
            })
          );
          source.addFeature(f);
        }

        // In-progress zone draft (mode "restriction" only) — same corner-
        // dot/dashed-outline language as the boundary's own draft below,
        // in GRID_KEEPCLEAR instead of cyan so it reads as a different
        // kind of thing being drawn, not a second site boundary.
        if (m === "restriction" && draftZone.length > 0) {
          if (draftZone.length >= 3) {
            const closed = new Feature(new Polygon([[...draftZone, draftZone[0]]]));
            closed.setStyle([
              new Style({ stroke: new Stroke({ color: "rgba(111,168,184,0.35)", width: 8 }) }),
              new Style({
                fill: new Fill({ color: hatch ?? "rgba(111,168,184,0.18)" }),
                stroke: new Stroke({ color: GRID_KEEPCLEAR, width: 2, lineDash: [6, 5] }),
              }),
            ]);
            source.addFeature(closed);
          }
          for (const p of draftZone) {
            const f = new Feature(new Point(p));
            f.setStyle([
              new Style({ image: new CircleStyle({ radius: 9, fill: new Fill({ color: "rgba(111,168,184,0.35)" }) }) }),
              new Style({ image: new CircleStyle({ radius: 4.5, fill: new Fill({ color: GRID_KEEPCLEAR }) }) }),
            ]);
            source.addFeature(f);
          }
        }

        if (b.length > 0) {
          if (b.length >= 3) {
            // Simulated glow: a wider, low-opacity stroke underneath the
            // crisp dashed line — OL's canvas renderer has no CSS-filter-
            // style blur per feature, so this stacks two strokes on the
            // same geometry instead.
            const closed = new Feature(new Polygon([[...b, b[0]]]));
            closed.setStyle([
              new Style({ stroke: new Stroke({ color: "rgba(25,246,255,0.35)", width: 8 }) }),
              new Style({
                fill: new Fill({ color: "rgba(25,246,255,0.07)" }),
                stroke: new Stroke({ color: GRID_CYAN, width: 2, lineDash: [6, 5] }),
              }),
            ]);
            source.addFeature(closed);
          }
          for (const p of b) {
            const f = new Feature(new Point(p));
            f.setStyle([
              new Style({ image: new CircleStyle({ radius: 9, fill: new Fill({ color: "rgba(25,246,255,0.3)" }) }) }),
              new Style({ image: new CircleStyle({ radius: 4.5, fill: new Fill({ color: GRID_CYAN }) }) }),
            ]);
            source.addFeature(f);
          }
        }

        if (e) {
          const f = new Feature(new Point(e));
          f.setStyle([
            new Style({ image: new CircleStyle({ radius: 11, fill: new Fill({ color: "rgba(39,255,138,0.3)" }) }) }),
            new Style({
              image: new CircleStyle({ radius: 5, fill: new Fill({ color: GRID_GREEN }), stroke: new Stroke({ color: "#05060d", width: 1.5 }) }),
            }),
          ]);
          source.addFeature(f);
        }
      }
      redrawRef.current = redraw;
      redraw();

      clickKey = map.on("singleclick", (evt) => {
        const [x, y] = evt.coordinate;
        const {
          mode: m,
          boundary: b,
          onAddBoundaryPoint: add,
          onSetEntrance: setEnt,
          onAddRestrictionPoint: addRestriction,
          onMapInteraction,
        } = propsRef.current;
        onMapInteraction?.();
        if (m === "boundary") {
          add([x, y]);
        } else if (m === "entrance" && b.length >= 3) {
          setEnt(nearestPointOnPolygon([x, y], b));
        } else if (m === "restriction") {
          addRestriction?.([x, y]);
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
  }, [boundary, entrance, layout, mode, restrictions, draftRestriction]);

  // Animate to a new location (e.g. from a postcode search) whenever
  // `flyTo` changes. Guarded on `map` existing; `flyTo.key` (not just
  // `flyTo.center`) is in the deps so a repeat search of the same
  // postcode still re-triggers the animation.
  useEffect(() => {
    if (!map || !flyTo) return;
    const view = map.getView();
    view.animate({
      center: flyTo.center,
      resolution: flyTo.resolution ?? view.getResolution(),
      duration: 600,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, flyTo?.key]);

  const canFinishHint = mode === "boundary" && boundary.length >= 3;

  return (
    <div
      className={
        fill
          ? "relative h-full w-full overflow-hidden"
          : "relative aspect-square w-full overflow-hidden rounded-xl border border-grid-border"
      }
    >
      <OsMapBasemap
        centerBng={DEFAULT_CENTER_BNG}
        resolution={DEFAULT_RESOLUTION_M_PER_PX}
        className="h-full w-full"
        dark={dark}
        onMapChange={handleMapChange}
      />

      <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-grid-border bg-sheet px-2 py-1 text-xs text-grid-muted shadow-sm">
        {mode === "boundary" &&
          (canFinishHint
            ? "Click to add more boundary points, or tap “Finish boundary”"
            : "Pan/zoom to your site, then click to place boundary points (3+)")}
        {mode === "entrance" && "Click near the boundary to place the site entrance"}
        {mode === "restriction" &&
          (draftRestriction.length >= 3
            ? "Click to add more points, or tap “Finish zone”"
            : "Click to mark land to keep clear — sewer, trees, buffers (3+ points)")}
        {mode === "done" && "Layout live — drag a corner or the entrance to adjust, or edit inputs on the right"}
      </div>
    </div>
  );
}
