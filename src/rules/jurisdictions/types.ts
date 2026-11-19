// Shared types for the layered jurisdiction rules system.
//
// Two layers: a National baseline pack (src/rules/jurisdictions/national.ts)
// and Local packs (one file per council, e.g. pembrokeshire.ts) that
// override it. A site resolves to national ⊕ (local pack for its council,
// if one exists). Adding a new council is one new file implementing
// LocalPlanningRules + LocalAppraisalDefaults — no changes to this file,
// to national.ts, or to the engine.

import type { HouseTypeId } from "../../engine/types";
import type { SizeTier } from "../../engine/sizeTiers";

/** A value plus where it came from. `source` is literally the string "unsourced default" for anything invented rather than read off a document — the UI can key off that exact string. */
export interface Sourced<T> {
  value: T;
  source: string;
}

export const UNSOURCED = "unsourced default";

export function isUnsourced<T>(s: Sourced<T>): boolean {
  return s.source === UNSOURCED;
}

/** Three-way provenance classification the UI shows for every appraisal figure: "sourced" (a real document citation), "approximated" (a stated modelling stand-in for a figure that couldn't be sourced, e.g. ACG≈OMV), or "unsourced" (UNSOURCED — nothing to cite at all). */
export type SourceClassification = "sourced" | "approximated" | "unsourced";

export function classifySource(source: string): SourceClassification {
  if (source === UNSOURCED) return "unsourced";
  if (/approximat/i.test(source)) return "approximated";
  return "sourced";
}

/** Scheme-size bands used throughout the appraisal evidence (matches the Pembrokeshire viability report's own typology rows). Single-plot schemes use "1". */
export const SCHEME_SIZE_BANDS = ["1", "2-5", "6-9", "10-19", "20-32", "33-49", "50-99", "100+"] as const;
export type SchemeSizeBand = (typeof SCHEME_SIZE_BANDS)[number];

export function schemeSizeBandForUnits(units: number): SchemeSizeBand {
  if (units <= 1) return "1";
  if (units <= 5) return "2-5";
  if (units <= 9) return "6-9";
  if (units <= 19) return "10-19";
  if (units <= 32) return "20-32";
  if (units <= 49) return "33-49";
  if (units <= 99) return "50-99";
  return "100+";
}

/** Market value band, 1 (lowest) to 4 (highest) — a local council's own geographic value bands, not a national concept. */
export type MarketBand = 1 | 2 | 3 | 4;

/** Per-scheme-size appraisal evidence: varies with scheme size, not with market band. */
export interface SchemeSizeAppraisalRow {
  buildCostPerSqm: Sourced<number>;
  designFeesPercent: Sourced<number>;
  financeRatePercentPA: Sourced<number>;
  developerProfitPercentGDV: Sourced<number>;
  externalWorksPerDwelling: Sourced<number>;
  s106PerDwelling: Sourced<number>;
  /** Typology evidence — a yield sense-check, not a target. Net dwellings/ha. */
  netDph: Sourced<number>;
  /** Typology evidence — a yield sense-check, not a target. Net developable area ÷ gross site area. */
  netToGrossRatio: Sourced<number>;
}

/** Per-market-band evidence: varies with band, not with scheme size. */
export interface MarketBandRow {
  salesPricePerSqm: Sourced<number>;
  landValuePerNetAcre: Sourced<number>;
}

/** Affordable housing % on-site, keyed by [band][sizeBand]. Varies with BOTH. `null` means "not tested" in the source evidence, not zero. */
export type AffordableHousingTable = Record<MarketBand, Partial<Record<SchemeSizeBand, Sourced<number> | null>>>;

export interface LocalPlanningRules {
  /** council name as it appears in the source documents */
  councilName: string;
  /**
   * The LIVE minimum GROSS site density, dwellings/hectare, by settlement
   * tier — the engine's density-minimum compliance check (generateLayout.ts)
   * reads this one, never `emergingMinGrossDensityDphByTier`. Must come
   * from the currently-ADOPTED local plan, not a deposit/emerging one —
   * see each pack's own sourcing comment for which document and
   * adoption date this was read from.
   */
  minGrossDensityDphByTier: Record<string, Sourced<number>>;
  /**
   * Optional: the same figures from a newer, NOT YET ADOPTED local plan
   * (e.g. a Deposit Plan out for consultation) — kept for reference and
   * shown in the sourcing/provenance view only, clearly labelled as
   * emerging. NEVER consulted by generateLayout.ts's compliance check;
   * swap it into `minGrossDensityDphByTier` (and update this field with
   * whatever superseded it) once the plan is actually adopted.
   */
  emergingMinGrossDensityDphByTier?: Record<string, Sourced<number>>;
  /** site size threshold above which the density minimum applies */
  densityAppliesAboveHectares: Sourced<number>;
  /** % of new-build sites of N+ units that must be Lifetime Homes standard (market homes) */
  lifetimeHomesPercent: Sourced<number>;
  lifetimeHomesAppliesAboveUnits: Sourced<number>;
  /** whether/how NDSS is used locally (adopted outright, used as evidence basis, not used) */
  ndssStatus: Sourced<string>;
  planStatus: Sourced<string>;
}

export interface LocalAppraisalDefaults {
  councilName: string;
  bySchemeSize: Record<SchemeSizeBand, SchemeSizeAppraisalRow>;
  byMarketBand: Record<MarketBand, MarketBandRow>;
  affordableHousingPercent: AffordableHousingTable;
  contingencyPercent: Sourced<number>;
  marketingPercentUnder20Units: Sourced<number>;
  marketingPercent20PlusUnits: Sourced<number>;
  legalCostPerDwelling: Sourced<number>;
  sudsPerDwelling: Sourced<number>;
  landAcquisitionFeesPercent: Sourced<number>;
  /** +% on sales price for bungalow-dominated schemes vs 2-storey, same band */
  bungalowSalesPremiumPercent: Sourced<number>;
  /** +% on sales price for sites of ≤10 dwellings, reflecting "individual" plot character */
  smallSitePremiumPercent: Sourced<number>;
  /** social-rented transfer value, as a % of ACG (Acceptable Cost Guidance, a Welsh Government mechanism including land) */
  socialRentTransferValuePercentOfAcg: Sourced<number>;
  intermediateTransferValuePercentOfOmv: Sourced<number>;
  tenureSplitSocialRentPercent: Sourced<number>;
  tenureSplitIntermediatePercent: Sourced<number>;
  defaultMarketBand: MarketBand;
  /**
   * "Auto" size-tier mix default when the user hasn't specified a mix at
   * all — the engine's own evidence-based starting point, not an
   * arbitrary equal split. Sourced from the council's own dwelling-type/
   * tenure mix evidence (see pembrokeshire.ts). XL (5-bed) commonly has
   * no evidence at all in this kind of table (it predates most councils'
   * mix evidence, which stops at 4-bed) — 0% in that case is honest
   * about the evidence, not a claim that 5-beds shouldn't be built.
   */
  defaultAutoSizeMixPercent: Record<SizeTier, Sourced<number>>;
  /**
   * true when no published ACG-including-land rate table could be
   * sourced, so ACG is approximated as equal to the market band's OMV
   * sales price in the social-rent transfer-value calculation. This
   * substantially OVERSTATES the social-rent transfer value (real ACG
   * rates are a fraction of OMV) and therefore overstates every metric
   * derived from it (affordable-housing revenue, GDV, residual land
   * value). The engine surfaces this as Metrics.affordableValueOverstated
   * and a compliance warning whenever affordableUnits > 0 and this is
   * true — never silently.
   */
  acgApproximatedAsOmv: boolean;
  acgApproximationNote: Sourced<string>;
}

export interface NationalPlanningBaseline {
  ndssMinGiaM2: Record<HouseTypeId, Sourced<number>>;
  backToBackM: Sourced<number>;
  minGardenDepthM: Sourced<number>;
  roadWidthM: Sourced<number>;
  turningHeadDiameterM: Sourced<number>;
  maxFireAccessDistanceM: Sourced<number>;
  parkingSpacesPerUnit: Sourced<number>;
  parkingSpaceWidthM: Sourced<number>;
  parkingSpaceDepthM: Sourced<number>;
}

export interface NationalAppraisalBaseline {
  contingencyPercent: Sourced<number>;
  legalCostPerDwelling: Sourced<number>;
  landAcquisitionFeesPercent: Sourced<number>;
  /** No genuine national £/m² figure exists for any of these three — always `UNSOURCED` here, real values only ever come from a local pack. */
  salesPricePerSqmPlaceholder: Sourced<number>;
  buildCostPerSqmPlaceholder: Sourced<number>;
  landValuePerNetAcrePlaceholder: Sourced<number>;
}
