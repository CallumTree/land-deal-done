// User-facing house "size" tiers — Small/Medium/Large/XL — and which real
// HouseTypeIds the engine may place for each. The user only ever picks a
// size; which of terrace/semi/detached actually gets built at any given
// position is the engine's own decision, made by generateLayout.ts's
// existing placement search (try the preferred form, fall back through
// the others that fit) — this module only defines the candidate forms per
// tier and documents the mapping, it contains no placement logic itself.

import type { HouseTypeId } from "./types";

export type SizeTier = "Small" | "Medium" | "Large" | "XL";
export const SIZE_TIERS: SizeTier[] = ["Small", "Medium", "Large", "XL"];

export interface SizeTierDefinition {
  tier: SizeTier;
  bedrooms: number;
  /** Real HouseTypeIds the engine may place for this tier (excluding the bungalow toggle — see BUNGALOW_TIER below). */
  forms: HouseTypeId[];
  /** Why this bedroom count maps to this tier, and why these forms (and not others) are offered. */
  note: string;
}

/**
 * Bedroom counts are a direct, definitional mapping (Small=2-bed ...
 * XL=5-bed) — there's nothing to "source" about the mapping itself, only
 * about which FORMS exist for each. NDSS itself doesn't vary GIA by
 * attachment form (terrace/semi/detached), only by bedroom count,
 * bed-space count and storeys (DCLG NDSS, March 2015, Table 1) — so every
 * form within a tier shares the exact same sourced NDSS minimum as the
 * tier's bedroom count (see rules.ts/national.ts NDSS_MIN_GIA_M2).
 *
 * XL (5-bed) offers detached only: 5-bed terrace/semi homes are a
 * realism judgment call this engine declines to make up data for — in UK
 * volume housebuilding a 5-bed home is practically always built detached;
 * fabricating 5-bed-terrace/5-bed-semi NDSS/footprint entries with no
 * real scheme or published convention behind them would be exactly the
 * kind of invented figure this project's brief rules out. If a real
 * 5-bed terrace/semi scheme turns up as evidence later, add the type
 * then, sourced to that scheme.
 */
export const SIZE_TIER_DEFINITIONS: Record<SizeTier, SizeTierDefinition> = {
  Small: {
    tier: "Small",
    bedrooms: 2,
    forms: ["2-bed-terrace", "2-bed-semi", "2-bed-detached"],
    note: "2-bed homes are commonly built in all three attached forms in UK estates — all three offered.",
  },
  Medium: {
    tier: "Medium",
    bedrooms: 3,
    forms: ["3-bed-terrace", "3-bed-semi", "3-bed-detached"],
    note: "3-bed homes are commonly built in all three attached forms — all three offered. The bungalow variant (3-bed-bungalow) is a separate on/off toggle, not one of these three forms — see BUNGALOW_TIER.",
  },
  Large: {
    tier: "Large",
    bedrooms: 4,
    forms: ["4-bed-terrace", "4-bed-semi", "4-bed-detached"],
    note: "4-bed terraces (townhouses) are less common than semi/detached but genuinely built — all three offered.",
  },
  XL: {
    tier: "XL",
    bedrooms: 5,
    forms: ["5-bed-detached"],
    note: "Detached only — see this file's header comment for why terrace/semi 5-bed variants aren't modelled.",
  },
};

/**
 * The ONLY size tier with a real, sourced bungalow house type is Medium
 * (3-bed-bungalow, sourced from the fern-rise-neyland fixture — a real
 * approved scheme of 3-bed bungalows). Pembrokeshire's own dwelling-mix
 * evidence (FVR §4.19) does have a bungalow row, but it's a 2-BED
 * bungalow — a bedroom count this engine has no bungalow NDSS data for
 * at all. Rather than invent a 2-bed-bungalow NDSS figure with no real
 * source, the "Include bungalows" toggle applies to the Medium tier,
 * where real sourced data exists, not to Small, where the only evidence
 * is for a bedroom count the engine doesn't model as a bungalow.
 */
export const BUNGALOW_TIER: SizeTier = "Medium";
export const BUNGALOW_HOUSE_TYPE: HouseTypeId = "3-bed-bungalow";

/**
 * Expands a user-facing size-tier mix (+ the bungalow toggle) into the
 * engine's real per-HouseTypeId relative weights. Each tier's weight is
 * split EQUALLY across its candidate forms (terrace/semi/detached[/
 * bungalow for Medium when included]) — this is only a starting
 * preference order fed into generateLayout's existing placement search,
 * which already falls back through whichever type actually fits at each
 * position; it is not a guarantee that forms end up in exactly equal
 * counts in the finished layout. There is no sourced "real" split between
 * forms within a tier (no document gives e.g. "60% semi, 40% detached"),
 * so equal weighting is this engine's own explicit modelling choice, not
 * a citation.
 */
export function expandSizeMixToHouseMix(
  sizeMix: Partial<Record<SizeTier, number>>,
  includeBungalows: boolean
): Partial<Record<HouseTypeId, number>> {
  const result: Partial<Record<HouseTypeId, number>> = {};
  for (const tier of SIZE_TIERS) {
    const weight = Math.max(0, sizeMix[tier] ?? 0);
    if (weight <= 0) continue;
    const forms = [...SIZE_TIER_DEFINITIONS[tier].forms];
    if (includeBungalows && tier === BUNGALOW_TIER) forms.push(BUNGALOW_HOUSE_TYPE);
    const perForm = weight / forms.length;
    for (const f of forms) {
      result[f] = (result[f] ?? 0) + perForm;
    }
  }
  return result;
}

/** Sums a full HouseTypeId→count mix back up to tier totals, for the simplified ("Small/Medium/Large/XL") view — the "pro view" is the untouched per-HouseTypeId mix itself, one level deeper. */
export function summarizeMixByTier(mix: Partial<Record<HouseTypeId, number>>): Record<SizeTier, number> {
  const totals: Record<SizeTier, number> = { Small: 0, Medium: 0, Large: 0, XL: 0 };
  for (const tier of SIZE_TIERS) {
    const forms = SIZE_TIER_DEFINITIONS[tier].forms;
    const bungalow = tier === BUNGALOW_TIER ? [BUNGALOW_HOUSE_TYPE] : [];
    for (const f of [...forms, ...bungalow]) {
      totals[tier] += mix[f] ?? 0;
    }
  }
  return totals;
}
