"use client";

// User-facing mix state: Auto (the resolved jurisdiction's own sourced
// default size-tier mix — no sizeMix sent, the engine fills it in) vs
// Manual (user-set Small/Medium/Large/XL relative weights), plus the
// bungalow on/off toggle, which applies in both modes. This is the
// "pick a size, not a house type" layer described in sizeTiers.ts — the
// per-HouseTypeId "pro view" breakdown lives in the engine output
// (Metrics.mix / summarizeMixByTier), not here.

import { useCallback, useState } from "react";
import { SIZE_TIERS, type SizeTier } from "@/engine/sizeTiers";
import type { MixCandidate } from "@/engine/optimizer";

export type MixMode = "auto" | "manual";

export interface UseMixStateResult {
  mode: MixMode;
  setMode(mode: MixMode): void;
  sizeMix: Partial<Record<SizeTier, number>>;
  setTierWeight(tier: SizeTier, weight: number): void;
  includeBungalows: boolean;
  setIncludeBungalows(value: boolean): void;
  /** Adopts an optimizer candidate (one of the three ranked cards) as the active Manual mix — switches mode to "manual" so the sliders reflect and can refine the pick. */
  applyMixCandidate(candidate: MixCandidate): void;
  /** Ready to spread into EngineInputs. Auto mode omits sizeMix entirely (see resolveEffectiveHouseMix's Auto fallback in generateLayout.ts) rather than sending an equal-weight guess. */
  engineMixFields: { sizeMix?: Partial<Record<SizeTier, number>>; includeBungalows: boolean };
}

const DEFAULT_MANUAL_SIZE_MIX: Record<SizeTier, number> = { Small: 1, Medium: 1, Large: 1, XL: 1 };

export function useMixState(): UseMixStateResult {
  const [mode, setMode] = useState<MixMode>("auto");
  const [sizeMix, setSizeMix] = useState<Partial<Record<SizeTier, number>>>(DEFAULT_MANUAL_SIZE_MIX);
  const [includeBungalows, setIncludeBungalows] = useState(false);

  const setTierWeight = useCallback((tier: SizeTier, weight: number) => {
    setSizeMix((m) => ({ ...m, [tier]: Math.max(0, weight) }));
  }, []);

  const applyMixCandidate = useCallback((candidate: MixCandidate) => {
    setMode("manual");
    const next: Partial<Record<SizeTier, number>> = {};
    for (const tier of SIZE_TIERS) next[tier] = candidate.sizeMix[tier] ?? 0;
    setSizeMix(next);
    setIncludeBungalows(candidate.includeBungalows);
  }, []);

  const engineMixFields =
    mode === "auto" ? { sizeMix: undefined, includeBungalows } : { sizeMix, includeBungalows };

  return { mode, setMode, sizeMix, setTierWeight, includeBungalows, setIncludeBungalows, applyMixCandidate, engineMixFields };
}
