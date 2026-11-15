// National baseline pack — applies everywhere in the relevant country
// unless a local pack overrides it. Two sections, kept separate per the
// brief: PLANNING RULES (hard constraints an engine must enforce) and
// APPRAISAL DEFAULTS (viability-appraisal inputs, which are inherently
// local/regional — see that section's header for why almost everything
// in it is marked "unsourced default" at national level).
//
// England vs Wales split: most of the figures below are UK-wide design
// conventions (back-to-back, garden depth, road width, fire access,
// parking) with no distinct England/Wales legal split — they're long-
// standing local-design-guide conventions (e.g. Essex Design Guide,
// Manual for Streets, Approved Document B) adopted on both sides of the
// border. Where the LEGAL REGIME genuinely differs — space standards,
// building regulations, affordable housing delivery — that's called out
// explicitly below rather than papered over.

import type { HouseTypeId } from "../../engine/types";
import { UNSOURCED, type NationalAppraisalBaseline, type NationalPlanningBaseline, type Sourced } from "./types";

function s<T>(value: T, source: string): Sourced<T> {
  return { value, source };
}

// =====================================================================
// PLANNING RULES
// =====================================================================

/**
 * Nationally Described Space Standard (NDSS) minimum Gross Internal
 * Area, m². Source: DCLG, "Technical housing standards – nationally
 * described space standard", March 2015, Table 1.
 *
 * Legal status differs by country — this is an England document:
 * - England: NDSS can be mandated by an LPA's own planning policy
 *   (it is not automatically binding everywhere) but is the standard
 *   national reference when an LPA chooses to set space standards.
 * - Wales: NDSS has NO formal status. Wales' own standard — the Welsh
 *   Development Quality Requirements (WDQR) 2021 — sets minimum GIA,
 *   but only for AFFORDABLE homes delivered by/transferred to a
 *   Registered Social Landlord, not market homes (see
 *   NationalPlanningBaseline comment on affordable housing delivery,
 *   and WALES_BUILDING_REGS below). A Welsh LPA may still choose to use
 *   NDSS as an evidence basis for testing market-home viability — that
 *   is a LOCAL choice, not a Wales-wide rule (Pembrokeshire does
 *   exactly this; see pembrokeshire.ts).
 *
 * Bed-space convention: NDSS varies by bedroom AND bed-space count, not
 * bedrooms alone (e.g. a 2-bed home can be 3- or 4-person). This engine
 * assumes the common volume-housebuilder bed-space variant per type:
 * 2-bed = 2b4p, 3-bed = 3b5p, 4-bed = 4b6p (all 2-storey), bungalow =
 * 3b5p single-storey.
 */
export const NDSS_MIN_GIA_M2: Record<HouseTypeId, Sourced<number>> = {
  "2-bed-terrace": s(79, "DCLG, NDSS, March 2015, Table 1 — 2 bed, 4 person, 2 storey"),
  "3-bed-semi": s(93, "DCLG, NDSS, March 2015, Table 1 — 3 bed, 5 person, 2 storey"),
  "4-bed-detached": s(106, "DCLG, NDSS, March 2015, Table 1 — 4 bed, 6 person, 2 storey"),
  "3-bed-bungalow": s(86, "DCLG, NDSS, March 2015, Table 1 — 3 bed, 5 person, single storey"),
};

/**
 * Minimum distance between facing habitable-room windows on opposing
 * plots. Long-standing UK design-guide convention traced to the Essex
 * Design Guide (1973), widely adopted since in both England and Wales —
 * not a statutory national figure in either country, but ubiquitous
 * enough to use as the national baseline rather than mark unsourced.
 */
export const BACK_TO_BACK_M = s(21, "Essex Design Guide (1973) convention, widely adopted UK-wide — not a statutory figure");

/** Minimum private garden (rear amenity space) depth. Same status as BACK_TO_BACK_M — a widespread UK local-design-guide convention, not a statutory national figure. */
export const MIN_GARDEN_DEPTH_M = s(10, "Common UK local design-guide minimum for private amenity space — not a statutory national figure");

/** Minimum carriageway width for a short access road serving housing. Source: Manual for Streets (DfT, 2007) — applies in England and Wales (DfT guidance, not devolved). */
export const ROAD_WIDTH_M = s(5.5, "Manual for Streets (DfT, 2007) — commonly used minimum for a two-way residential access road");

/** Turning head diameter for a dead-end road, sized for a refuse/fire appliance to turn without reversing. Source: Manual for Streets (DfT, 2007). */
export const TURNING_HEAD_DIAMETER_M = s(16, "Manual for Streets (DfT, 2007) — commonly cited minimum turning circle");

/** Maximum distance from a fire appliance's pumping position to a dwelling entrance. Source: Approved Document B / common UK fire & rescue access convention. */
export const MAX_FIRE_ACCESS_DISTANCE_M = s(45, "Approved Document B (fire safety) / common UK fire & rescue 45m hose-run convention");

/** Off-street parking spaces required per dwelling. No national mandate in either country — set by individual LPA parking SPDs. 2/dwelling for houses is a common default seen across many English and Welsh SPDs; genuinely local in practice. */
export const PARKING_SPACES_PER_UNIT = s(2, "Common default across many UK local parking SPDs — not a national standard, always check the local pack");

/** Plan dimensions of a single on-plot parking space. Typical UK bay: 2.4-2.5m x 4.8-5m. */
export const PARKING_SPACE_WIDTH_M = s(2.5, "Typical UK residential parking bay width convention");
export const PARKING_SPACE_DEPTH_M = s(5, "Typical UK residential parking bay depth convention");

export const NATIONAL_PLANNING_BASELINE: NationalPlanningBaseline = {
  ndssMinGiaM2: NDSS_MIN_GIA_M2,
  backToBackM: BACK_TO_BACK_M,
  minGardenDepthM: MIN_GARDEN_DEPTH_M,
  roadWidthM: ROAD_WIDTH_M,
  turningHeadDiameterM: TURNING_HEAD_DIAMETER_M,
  maxFireAccessDistanceM: MAX_FIRE_ACCESS_DISTANCE_M,
  parkingSpacesPerUnit: PARKING_SPACES_PER_UNIT,
  parkingSpaceWidthM: PARKING_SPACE_WIDTH_M,
  parkingSpaceDepthM: PARKING_SPACE_DEPTH_M,
};

/**
 * Density: deliberately NOT given a national figure. England and Wales
 * both leave minimum/maximum residential density to local plan policy;
 * the only country-scale figure found in the evidence reviewed for this
 * pack is Wales' Future Wales: The National Plan 2040, which SUGGESTS
 * (not mandates) at least 50 dwellings/hectare net in urban areas —
 * sourced to Pembrokeshire Deposit LDP2 §3.13, p.35, which cites Future
 * Wales directly. This is a Wales-level planning aspiration, not an
 * England equivalent, and not a hard minimum anywhere — a local pack's
 * own gross-density minimum (e.g. Pembrokeshire's 23/30 dph) is what
 * actually governs a given site. No density value is exported here
 * precisely because inventing a cross-country national minimum would
 * be the "unsourced default" the brief says not to fabricate.
 */
export const WALES_FUTURE_WALES_SUGGESTED_URBAN_NET_DPH = s(
  50,
  "Future Wales: The National Plan 2040, cited in Pembrokeshire Deposit LDP2 §3.13 (p.35) — a strategic aspiration for urban areas, not a mandated minimum, and net (not gross) density"
);

/**
 * Affordable housing delivery mechanism differs by country:
 * - England: s.106 obligations and the Community Infrastructure Levy
 *   (CIL), under the NPPF.
 * - Wales: s.106 obligations under Planning Policy Wales / TAN 2, with
 *   no CIL regime. Transfer values for s.106 affordable homes going to
 *   a Registered Social Landlord are commonly set using Welsh
 *   Government's Acceptable Cost Guidance (ACG) — a Wales-wide
 *   mechanism. The Pembrokeshire viability report itself states that
 *   "most other planning authorities in Wales... will typically use
 *   42% of ACG" for social-rented transfer value (§5.11, p.15) — so 42%
 *   is used here as the national-Wales baseline; Pembrokeshire's own
 *   local pack overrides it to 55% (its own documented, higher, choice).
 */
export const WALES_TYPICAL_SOCIAL_RENT_TRANSFER_VALUE_PERCENT_OF_ACG = s(
  42,
  "Pembrokeshire Financial Viability Report, July 2024, §5.11 (p.15) — described there as what 'most other planning authorities in Wales' typically use; Pembrokeshire itself overrides this to 55%"
);

/**
 * Building Regulations are devolved: Wales has operated its own set
 * since 2012, diverging further from England's over time (e.g. Part L
 * energy-efficiency timelines). Not modelled numerically here — this
 * pack's cost allowances for Building Regulations changes (sprinklers,
 * ULEV points, Part L) are Pembrokeshire-specific figures from its own
 * viability evidence (see pembrokeshire.ts), not a national cost table,
 * because no such UK-wide costed table was found in the documents
 * reviewed for this pack.
 */
export const DEVOLVED_BUILDING_REGULATIONS_NOTE =
  "Wales has its own Building Regulations (devolved since 2012); England's and Wales' Part L/energy-efficiency timelines and requirements have diverged. No UK-wide national cost figure for compliance was found in the documents reviewed for this pack — see pembrokeshire.ts for Pembrokeshire's own sourced allowance.";

// =====================================================================
// APPRAISAL DEFAULTS
// =====================================================================
// Viability appraisal inputs are inherently local/regional — there is
// no such thing as a genuine "national" sales price, build cost or land
// value per m². Rather than invent one, every £-figure below is
// explicitly marked UNSOURCED; the engine must be given a local pack
// (e.g. pembrokeshire.ts) to get a real appraisal. The only things
// given real figures here are process conventions that several
// industry/RICS sources treat as broadly UK-wide rather than specific
// to one council's evidence base.

/** RICS Guidance Note GN94/2012 on Financial Viability in Planning recommends a contingency allowance as standard practice; it does not itself state a %. 5% is the figure this pack's one local source (Pembrokeshire) uses and that is widely seen in industry practice — included here as a reasonable UK-wide starting point, not a RICS-mandated number. */
export const CONTINGENCY_PERCENT = s(5, "Widely-used industry contingency allowance (RICS GN94/2012 recommends an allowance without fixing a %); 5% is this pack's only confirmed source (Pembrokeshire)");

export const LAND_ACQUISITION_FEES_PERCENT = s(1.5, "Common UK convention for legal/agency fees on a land purchase, plus Land Transaction Tax / Stamp Duty Land Tax at prevailing rates (not separately modelled here)");

export const SALES_PRICE_PER_SQM_PLACEHOLDER: Sourced<number> = { value: 2600, source: UNSOURCED };
export const BUILD_COST_PER_SQM_PLACEHOLDER: Sourced<number> = { value: 1500, source: UNSOURCED };
export const LAND_VALUE_PER_NET_ACRE_PLACEHOLDER: Sourced<number> = { value: 200000, source: UNSOURCED };
export const LEGAL_COST_PER_DWELLING_PLACEHOLDER: Sourced<number> = { value: 600, source: UNSOURCED };

export const NATIONAL_APPRAISAL_BASELINE: NationalAppraisalBaseline = {
  contingencyPercent: CONTINGENCY_PERCENT,
  legalCostPerDwelling: LEGAL_COST_PER_DWELLING_PLACEHOLDER,
  landAcquisitionFeesPercent: LAND_ACQUISITION_FEES_PERCENT,
  salesPricePerSqmPlaceholder: SALES_PRICE_PER_SQM_PLACEHOLDER,
  buildCostPerSqmPlaceholder: BUILD_COST_PER_SQM_PLACEHOLDER,
  landValuePerNetAcrePlaceholder: LAND_VALUE_PER_NET_ACRE_PLACEHOLDER,
};
