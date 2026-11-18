// Plain-English label dictionary — the single source of truth translating
// the engine's own technical ids/labels into copy a non-planner can read
// at a glance. Per CLAUDE.md: "Compliance is shown as colour, not
// paragraphs of text" and "Default view dead simple." The engine's own
// ComplianceCheck.label/detail and MixCandidate.label stay exactly as
// they are — they're the audit trail, correct and necessary for the pro
// view — this file is purely an ADDITIONAL simplified layer for the
// default view, never a replacement in the engine or a rewording that
// changes what a check actually means.
//
// Pure data/logic, no React/DOM — importable from any UI component.

import type { ComplianceCheck } from "@/engine/types";
import { SIZE_TIERS, SIZE_TIER_DEFINITIONS, BUNGALOW_TIER, type SizeTier } from "@/engine/sizeTiers";

/**
 * Plain-English label for each size tier — "Small/Medium/Large/XL" on its
 * own is already simple, but pairing it with the bedroom count it maps to
 * (sizeTiers.ts's own definitional mapping, not a separate guess) makes it
 * concrete without the user needing to know the tier names are arbitrary.
 */
export const SIZE_TIER_LABEL: Record<SizeTier, string> = Object.fromEntries(
  SIZE_TIERS.map((t) => [t, `${SIZE_TIER_DEFINITIONS[t].bedrooms}-bed (${t})`])
) as Record<SizeTier, string>;

export interface ComplianceCopyEntry {
  /** Short plain-English name for the default view, replacing ComplianceCheck.label. */
  title: string;
  /** One-line plain-English sentence per status, replacing ComplianceCheck.detail in the default view. The engine's own `detail` string (with exact figures) stays visible in the pro view. */
  copy: Partial<Record<ComplianceCheck["status"], string>>;
}

/**
 * Keyed by ComplianceCheck.id exactly as generateLayout.ts emits it — see
 * that file's `compliance.push({ id: "...", ... })` calls for the full,
 * authoritative set. Every id this engine can ever emit must appear here;
 * getComplianceCopy() below falls back to the raw check rather than
 * silently dropping copy for an id this dictionary hasn't caught up with.
 */
export const COMPLIANCE_COPY: Record<string, ComplianceCopyEntry> = {
  "boundary-offset": {
    title: "Boundary & no-build zones",
    copy: {
      pass: "Buildings sit clear of the boundary and any no-build areas.",
      fail: "The site is too narrow or oddly shaped to keep any buildings clear of the boundary.",
    },
  },
  topology: {
    title: "Road layout",
    copy: {
      pass: "Homes are arranged along an access road from the entrance.",
      fail: "No road-and-homes layout fits on this site with the current inputs.",
    },
  },
  "turning-head": {
    title: "Turning space at road end",
    copy: {
      pass: "There's room for a vehicle to turn around at the end of the road.",
      fail: "There isn't enough room for a vehicle turning head at the end of the road.",
      warn: "No homes were placed, so there's no road to check.",
    },
  },
  "road-width": {
    title: "Road width",
    copy: { pass: "The access road is wide enough for two-way traffic." },
  },
  "road-connects-entrance": {
    title: "Road reaches the entrance",
    copy: {
      pass: "The access road connects to the entrance point you set.",
      fail: "The access road doesn't reach the entrance point.",
    },
  },
  "plot-frontage": {
    title: "Every home fronts the road",
    copy: {
      pass: "Every home has its own frontage onto the access road.",
      fail: "At least one home doesn't front the access road.",
      warn: "No homes have been placed yet.",
    },
  },
  "plots-inside-boundary": {
    title: "Homes stay inside the boundary",
    copy: {
      pass: "Every home sits inside the site boundary, clear of the setback.",
      fail: "At least one home falls outside the boundary or its clearance zone.",
    },
  },
  "no-overlaps": {
    title: "No overlapping buildings",
    copy: {
      pass: "No homes, roads or parking overlap each other.",
      fail: "Something overlaps that shouldn't — this points to an engine bug, not a site problem.",
    },
  },
  "block-length": {
    title: "Terrace/semi row lengths",
    copy: {
      pass: "Every row of attached homes is within the allowed length.",
      fail: "At least one row of attached homes is longer than allowed.",
      warn: "No homes have been placed yet.",
    },
  },
  "attached-share-wall": {
    title: "Attached homes genuinely join",
    copy: {
      pass: "Semi-detached and terrace homes are properly joined, not just placed close together.",
      fail: "At least one pair of 'attached' homes has a gap between them instead of a shared wall.",
      warn: "No homes have been placed yet.",
    },
  },
  "no-wasted-gaps": {
    title: "No wasted space",
    copy: {
      pass: "No gap along the road is big enough to have fit another home.",
      fail: "There's a gap big enough for another home that was left empty.",
      warn: "No homes have been placed yet.",
    },
  },
  "ndss-gia": {
    title: "Minimum home size (NDSS)",
    copy: {
      pass: "Every home meets the government's minimum floor area for its size.",
      fail: "At least one home is below the minimum floor area for its size.",
    },
  },
  "garden-depth": {
    title: "Garden depth",
    copy: {
      pass: "Every garden meets the minimum depth.",
      fail: "At least one garden is shallower than the minimum depth.",
      warn: "No homes have been placed yet.",
    },
  },
  "back-to-back": {
    title: "Privacy between facing homes",
    copy: {
      pass: "No two homes face each other closer than the minimum privacy distance.",
      fail: "Two homes face each other closer than the minimum privacy distance.",
      warn: "No homes have been placed yet.",
    },
  },
  parking: {
    title: "Parking",
    copy: {
      pass: "Every home has space for its required parking.",
      fail: "At least one home doesn't have space for its required parking.",
      warn: "No homes have been placed yet.",
    },
  },
  "fire-access": {
    title: "Fire engine & bin lorry access",
    copy: { pass: "Every home is directly reachable from the road." },
  },
  "appraisal-sourcing": {
    title: "Cost & value figures",
    copy: {
      pass: "£ figures are sourced from this council's own published data.",
      warn: "No council-specific figures found for this site — using unsourced national placeholders. Treat the £ numbers as rough.",
    },
  },
  "acg-approximation": {
    title: "Affordable housing value",
    copy: {
      pass: "Uses a published affordable-housing transfer rate, not an approximation.",
      warn: "Affordable-housing value is approximated and likely overstated — treat the £ figures with caution.",
    },
  },
};

/** Looks up the plain-English copy for a check, falling back to the engine's own label/detail if this dictionary hasn't caught up with a new id — never silently blank. */
export function getComplianceCopy(check: ComplianceCheck): { title: string; detail: string } {
  const entry = COMPLIANCE_COPY[check.id];
  return {
    title: entry?.title ?? check.label,
    detail: entry?.copy[check.status] ?? check.detail,
  };
}

/**
 * Plain-English one-liner describing a size-tier mix, for the optimiser's
 * three ranked cards. Deliberately does NOT surface MixCandidate.label
 * (e.g. "Skewed 3/2/1/0 (S/M/L/XL)" or "Random seed-1337 #17") — those are
 * internal search-bookkeeping names for ~70 of the 71 candidates tried,
 * never meant to be user-facing. This instead describes the mix's actual
 * composition, which is meaningful regardless of which internal candidate
 * produced it.
 */
export function describeSizeMix(sizeMix: Partial<Record<SizeTier, number>>, includeBungalows: boolean): string {
  const entries = SIZE_TIERS.map((t) => [t, sizeMix[t] ?? 0] as const).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return "No homes";

  const bungalowSuffix = includeBungalows ? " (bungalows included where this engine has data for them)" : "";

  if (entries.length === 1) {
    const [tier] = entries[0];
    return `All ${SIZE_TIER_LABEL[tier]} homes${bungalowSuffix}`;
  }

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const parts = sorted.map(([tier, w]) => `${Math.round((w / total) * 100)}% ${SIZE_TIER_LABEL[tier]}`);
  return `${parts.join(", ")}${bungalowSuffix}`;
}

/** Plain-English title + one-line explanation for the optimiser's single result card. */
export const MIX_CARD_COPY = {
  best: { title: "Best mix within council policy", explain: "The compliant mix, close to the council's own evidence-based dwelling mix, with the highest residual land value." },
};

/** Bungalow tier note, for wherever the "Include bungalows" toggle is shown — explains in one line why it only ever affects the Medium (3-bed) tier. */
export const BUNGALOW_TOGGLE_HELP = `Only applies to ${SIZE_TIER_LABEL[BUNGALOW_TIER]} homes — the only size this engine has real, sourced bungalow data for.`;
