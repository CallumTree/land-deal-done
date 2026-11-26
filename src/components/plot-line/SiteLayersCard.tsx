"use client";

// "About this site": one card, plain English, colour carries meaning.
// Slope and flood from Site Layers (see /api/site-layers), with source
// and date, plus a "No homes here" switch per flood zone found on the
// site. Never blank: loading and unavailable states both say something
// calm in one line.

import type { SiteLayersState } from "@/hooks/useSiteLayers";
import type { FloodZoneId, FloodZoneLayer } from "@/lib/siteLayers/types";
import { floodZoneLabel, isNoHomes, openZoneWarning, type FloodOverrides } from "@/lib/siteLayers/floodPolicy";

type Dot = "green" | "amber" | "red" | "none";
const DOT_CLASS: Record<Dot, string> = {
  green: "bg-grid-green",
  amber: "bg-grid-amber",
  red: "bg-[#ff3b5c]",
  none: "bg-grid-border",
};

function pct(p: number): string {
  if (p <= 0) return "0%";
  if (p < 1) return "under 1%";
  return `${Math.round(p)}%`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Slope dot: how much of the site will need real earthworks/retaining to build on. Bands are this app's own reading, not a standard — 1:15 is a common upper limit for a comfortable estate road or path. */
function slopeDot(steeperThan1in15Pct: number): Dot {
  if (steeperThan1in15Pct < 10) return "green";
  if (steeperThan1in15Pct < 40) return "amber";
  return "red";
}

/** Flood dot: red if any river/sea Zone 3 (TAN 15 §10.22 — no new homes on greenfield), amber for any other zone, green for none. */
function floodDot(zones: FloodZoneLayer[]): Dot {
  if (zones.length === 0) return "green";
  if (zones.some((z) => z.zone === 3 && z.source !== "surface")) return "red";
  return "amber";
}

export function SiteLayersCard({
  state,
  overrides,
  onToggleZone,
}: {
  state: SiteLayersState;
  overrides: FloodOverrides;
  onToggleZone: (id: FloodZoneId, noHomes: boolean) => void;
}) {
  if (state.status === "idle") return null;

  const shell = "mt-3 rounded-xl border border-grid-border bg-panel/40 px-3 py-2.5 text-[11px] leading-snug";

  if (state.status === "loading") {
    return (
      <div className={shell} aria-live="polite">
        <div className="mb-1 font-semibold text-grid-text">About this site</div>
        <div className="flex items-center gap-2 text-grid-muted">
          <span className={`h-2 w-2 shrink-0 animate-pulse rounded-full ${DOT_CLASS.none}`} aria-hidden />
          Checking slope and flood for this site…
        </div>
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className={shell} aria-live="polite">
        <div className="mb-1 font-semibold text-grid-text">About this site</div>
        <div className="flex items-center gap-2 text-grid-muted">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS.none}`} aria-hidden />
          {state.reason === "too-large"
            ? "Slope and flood layers aren't available for a site this big yet."
            : "Slope and flood layers aren't available for this area yet."}
        </div>
      </div>
    );
  }

  const { slope, elevation, flood, sources } = state;
  const slopePart = `${capitalise(pct(slope.steeperThan1in15Pct))} of this site is steeper than 1:15`;
  const floodPart = flood.anyPct <= 0 ? "none of it is in a flood zone" : `${pct(flood.anyPct)} is in a flood zone`;

  return (
    <div className={shell} aria-live="polite">
      <div className="mb-1 font-semibold text-grid-text">About this site</div>
      <p className="text-[12px] text-grid-text">
        {slopePart}, {floodPart}.
      </p>

      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2 text-grid-muted">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[slopeDot(slope.steeperThan1in15Pct)]}`} aria-hidden />
          <span>
            Slope: {pct(slope.steeperThan1in10Pct)} steeper than 1:10. Ground {Math.round(elevation.minM)}–{Math.round(elevation.maxM)}m above sea
            level.
          </span>
        </div>
        <div className="flex items-center gap-2 text-grid-muted">
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[floodDot(flood.zones)]}`} aria-hidden />
          <span>Flood: {flood.zones.length === 0 ? "no flood zones on this site." : `${flood.zones.length} zone${flood.zones.length === 1 ? "" : "s"} on this site, hatched on the map.`}</span>
        </div>
      </div>

      {flood.zones.length > 0 && (
        <ul className="mt-2 space-y-2">
          {flood.zones.map((z) => {
            const noHomes = isNoHomes(z, overrides);
            return (
              <li key={z.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-grid-text">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm border border-[#3d8bff]"
                      style={{
                        backgroundImage: `repeating-linear-gradient(45deg, rgba(61,139,255,${z.zone === 3 ? 0.9 : 0.55}) 0 1.5px, transparent 1.5px ${z.zone === 3 ? 4 : 6}px)`,
                      }}
                      aria-hidden
                    />
                    <span className="truncate">
                      {floodZoneLabel(z)} <span className="text-grid-muted">· {pct(z.percent)}</span>
                    </span>
                  </span>
                  <label className="flex shrink-0 items-center gap-1.5 text-grid-muted">
                    <span>No homes here</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={noHomes}
                      aria-label={`No homes here: ${floodZoneLabel(z)}`}
                      onClick={() => onToggleZone(z.id, !noHomes)}
                      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
                        noHomes ? "border-[#3d8bff] bg-[#3d8bff]/80" : "border-grid-border bg-panel"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-0.5 h-3.5 w-3.5 rounded-full bg-grid-text transition-transform ${noHomes ? "translate-x-4" : "translate-x-0.5"}`}
                      />
                    </button>
                  </label>
                </div>
                {!noHomes && <p className="ml-5 mt-0.5 text-[10.5px] text-grid-amber">{openZoneWarning(z)}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-[10px] text-grid-muted/80">
        Sources: {sources.lidar.name}
        {sources.lidar.date && `, ${sources.lidar.date}`}. {sources.flood.name}
        {sources.flood.date && `, updated ${sources.flood.date}`}.
      </p>
    </div>
  );
}
