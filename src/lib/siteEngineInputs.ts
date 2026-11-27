// The one place a site's saved/shared state becomes engine inputs. Used
// by the live page AND by scripts/share-link-test.ts, so the test checks
// the exact inputs a recipient's browser would build — not a copy that
// could drift from the page.

import type { EngineInputs, Restriction } from "@/engine/types";
import type { MarketBand } from "@/rules/jurisdictions/types";
import type { SiteState } from "@/components/plot-line/siteState";
import type { FloodZoneLayer } from "@/lib/siteLayers/types";
import { floodRestrictions } from "@/lib/siteLayers/floodPolicy";

/** See page.tsx's comment where the plot-spacing control was hidden — fixed at the one sourced tier. */
export const FIXED_SIDE_GAP_TIER = "tighter" as const;

export function siteEngineInputs(
  state: Pick<SiteState, "mixMode" | "sizeMix" | "includeBungalows" | "restrictions" | "floodOverrides">,
  floodZones: FloodZoneLayer[],
  marketBand: MarketBand
): Omit<EngineInputs, "quality"> & { restrictions: Restriction[] } {
  return {
    // Auto mode omits sizeMix entirely (see useMixState's engineMixFields).
    sizeMix: state.mixMode === "auto" ? undefined : state.sizeMix,
    includeBungalows: state.includeBungalows,
    localAuthority: "pembrokeshire",
    marketBand,
    sideGapTier: FIXED_SIDE_GAP_TIER,
    restrictions: [...state.restrictions, ...floodRestrictions(floodZones, state.floodOverrides)],
  };
}
