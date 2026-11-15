"use client";

import { useState } from "react";
import { OsMapBasemap } from "@/components/plot-line/OsMapBasemap";

// Dedicated test route for the OS Data Hub basemap — deliberately
// separate from the main app page (which still waits on a visual style
// decision before any further UI wiring). This exists to answer one
// question concretely: does the OS Maps API basemap actually load real
// tiles, at every zoom level down to building-level, using the key set
// in Vercel's environment (NEXT_PUBLIC_OS_API_KEY)? Once that's
// confirmed, wiring this basemap into the real Site Capture flow is a
// separate, later UI-integration step.
//
// Centered on pond-bridge-johnston's real, sourced BNG anchor
// (E193540, N210950 — confirmed in that fixture's own application
// form, not a guess) so "building-level zoom on a site" is testing an
// actual UK location, not an arbitrary point.
const SITE_CENTER_BNG: [number, number] = [193540, 210950];

// Resolution = BNG metres per screen pixel in the EPSG:27700 view.
// Smaller = more zoomed in. ~0.5-1 m/px is roughly building-level
// (individual houses/plots become distinguishable); ~50-100 is
// street/neighbourhood scale; ~1000+ is regional.
const ZOOM_PRESETS: { label: string; resolution: number }[] = [
  { label: "Regional (1000 m/px)", resolution: 1000 },
  { label: "Town (100 m/px)", resolution: 100 },
  { label: "Street (20 m/px)", resolution: 20 },
  { label: "Building (2 m/px)", resolution: 2 },
  { label: "Building, max (0.5 m/px)", resolution: 0.5 },
];

export default function OsMapTestPage() {
  const [resolution, setResolution] = useState(ZOOM_PRESETS[3].resolution);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white p-2">
        <span className="text-xs font-medium text-zinc-500">OS Maps API basemap test —</span>
        {ZOOM_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            data-testid={`zoom-preset-${preset.resolution}`}
            onClick={() => setResolution(preset.resolution)}
            className={`rounded-md border px-2 py-1 text-xs ${
              resolution === preset.resolution
                ? "border-sky-500 bg-sky-50 text-sky-700"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <span data-testid="current-resolution" className="ml-auto text-xs text-zinc-400">
          {resolution} m/px
        </span>
      </div>
      <OsMapBasemap centerBng={SITE_CENTER_BNG} resolution={resolution} className="relative flex-1" />
    </div>
  );
}
