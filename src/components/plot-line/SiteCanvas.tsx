"use client";

import { useRef } from "react";
import type { BNGPoint, BNGPolygon, HouseTypeId, LayoutResult } from "@/engine/types";

export type DrawMode = "boundary" | "entrance" | "done";

// Placeholder dev-canvas palette only — grouped by bedroom-count tier
// (shades of one hue per tier) so the pro-view breakdown stays visually
// distinguishable. Not a brand/style decision; revisit once a visual
// style is picked (see "UI wiring waits until I pick a style").
const HOUSE_TYPE_COLOR: Record<HouseTypeId, string> = {
  "2-bed-terrace": "#38bdf8", // sky-400
  "2-bed-semi": "#0ea5e9", // sky-500
  "2-bed-detached": "#0284c7", // sky-600
  "3-bed-terrace": "#c4b5fd", // violet-300
  "3-bed-semi": "#a78bfa", // violet-400
  "3-bed-detached": "#8b5cf6", // violet-500
  "3-bed-bungalow": "#14b8a6", // teal-500
  "4-bed-terrace": "#fcd34d", // amber-300
  "4-bed-semi": "#fbbf24", // amber-400
  "4-bed-detached": "#f59e0b", // amber-500
  "5-bed-detached": "#f43f5e", // rose-500
};

const VIEW_SIZE_M = 400;

function polyToPath(poly: BNGPolygon): string {
  if (poly.length === 0) return "";
  return poly.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
}

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

export function SiteCanvas({
  boundary,
  entrance,
  layout,
  mode,
  onAddBoundaryPoint,
  onSetEntrance,
}: {
  boundary: BNGPolygon;
  entrance: BNGPoint | null;
  layout: LayoutResult | null;
  mode: DrawMode;
  onAddBoundaryPoint: (p: BNGPoint) => void;
  onSetEntrance: (p: BNGPoint) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  const toSvgPoint = (clientX: number, clientY: number): BNGPoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return [local.x, local.y];
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    if (mode === "boundary") {
      onAddBoundaryPoint(p);
    } else if (mode === "entrance" && boundary.length >= 3) {
      onSetEntrance(nearestPointOnPolygon(p, boundary));
    }
  };

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_SIZE_M} ${VIEW_SIZE_M}`}
        className="h-full w-full cursor-crosshair touch-none select-none"
        onClick={handleClick}
      >
        {/* grid, every 20m, purely visual scale reference */}
        {Array.from({ length: VIEW_SIZE_M / 20 + 1 }, (_, i) => i * 20).map((v) => (
          <g key={`g${v}`} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth={0.3}>
            <line x1={v} y1={0} x2={v} y2={VIEW_SIZE_M} />
            <line x1={0} y1={v} x2={VIEW_SIZE_M} y2={v} />
          </g>
        ))}

        {boundary.length > 0 && (
          <path
            d={boundary.length >= 3 ? polyToPath(boundary) : boundary.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ")}
            fill={boundary.length >= 3 ? "rgba(56,189,248,0.08)" : "none"}
            stroke="#0ea5e9"
            strokeWidth={1.2}
          />
        )}
        {boundary.map((p, i) => (
          <circle key={`bp${i}`} cx={p[0]} cy={p[1]} r={2} fill="#0ea5e9" />
        ))}

        {layout?.roads.map((r) => (
          <polyline
            key={r.id}
            points={r.centerlineBng.map((p) => `${p[0]},${p[1]}`).join(" ")}
            fill="none"
            stroke="#71717a"
            strokeWidth={r.widthM}
            strokeLinecap="round"
          />
        ))}

        {layout?.plots.map((plot) => (
          <g key={plot.id}>
            <path d={polyToPath(plot.plotBng)} fill="none" stroke="#a1a1aa" strokeDasharray="1.5,1.5" strokeWidth={0.4} />
            {plot.gardenBng && <path d={polyToPath(plot.gardenBng)} fill="#86efac" fillOpacity={0.35} stroke="none" />}
            <path d={polyToPath(plot.footprintBng)} fill={HOUSE_TYPE_COLOR[plot.houseType]} stroke="#18181b" strokeWidth={0.3} />
          </g>
        ))}

        {layout?.parkingSpacesBng.map((p, i) => (
          <circle key={`pk${i}`} cx={p[0]} cy={p[1]} r={0.8} fill="#3f3f46" />
        ))}

        {entrance && (
          <g>
            <circle cx={entrance[0]} cy={entrance[1]} r={4} fill="none" stroke="#ef4444" strokeWidth={1.5} />
            <circle cx={entrance[0]} cy={entrance[1]} r={1.5} fill="#ef4444" />
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs text-zinc-600 shadow-sm dark:bg-zinc-900/90 dark:text-zinc-300">
        {mode === "boundary" && "Click to place boundary points (3+), then tap “Finish boundary”"}
        {mode === "entrance" && "Click near the boundary to place the site entrance"}
        {mode === "done" && "Layout live — edit inputs on the right"}
      </div>
    </div>
  );
}
