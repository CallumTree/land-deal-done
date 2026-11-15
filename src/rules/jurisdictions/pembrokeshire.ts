// Local pack: Pembrokeshire County Council (excluding Pembrokeshire Coast
// National Park, which has its own separate LDP).
//
// Sources, both saved unmodified at /docs/evidence/pembrokeshire/:
//   [LDP2]  Pembrokeshire County Council Deposit Local Development Plan
//           2017-2033 ("LDP2"), 13-page extract. STATUS: this is a
//           DEPOSIT plan — out for public consultation, NOT YET ADOPTED.
//           Every planning-rules figure below is Deposit-stage evidence,
//           not a confirmed adopted policy; see the README flag.
//   [FVR]   Burrows-Hutchinson Ltd, "Pembrokeshire (excluding National
//           Park): Financial Viability Report for Deposit LDP-2", July
//           2024 ("the Viability Report"). Every £-figure below was read
//           directly from this document's Section 5 and Appendices
//           A-F, not taken from any summary.
//
// Every value below was independently verified against the PDFs, not
// trusted from any prior description of their contents.

import type { HouseTypeId } from "../../engine/types";
import type {
  AffordableHousingTable,
  LocalAppraisalDefaults,
  LocalPlanningRules,
  MarketBand,
  MarketBandRow,
  SchemeSizeAppraisalRow,
  SchemeSizeBand,
  Sourced,
} from "./types";

function s<T>(value: T, source: string): Sourced<T> {
  return { value, source };
}

// =====================================================================
// PLANNING RULES
// =====================================================================

export const PEMBROKESHIRE_PLANNING_RULES: LocalPlanningRules = {
  councilName: "Pembrokeshire County Council (excluding Pembrokeshire Coast National Park)",

  /**
   * Policy GN13 Residential Development: "New homes on allocated sites
   * in Service Centres and Service Villages and otherwise on sites of
   * 0.10 hectares and above will be built at a density of at least 23
   * dwellings per hectare, rising to at least 30 dwellings per hectare
   * for sites in Towns." Reaffirmed at §5.88 (p.118): "a minimum density
   * of 23 dwellings per hectare in Service Centres and Service Villages
   * ... and 30 dwellings per hectare in Towns ... based on gross site
   * area: net densities will accordingly be higher."
   */
  minGrossDensityDphByTier: {
    town: s(30, "LDP2, Policy GN13 (p.117) and §5.88 (p.118)"),
    "service centre": s(23, "LDP2, Policy GN13 (p.117) and §5.88 (p.118)"),
    "service village": s(23, "LDP2, Policy GN13 (p.117) and §5.88 (p.118)"),
  },
  densityAppliesAboveHectares: s(0.1, "LDP2, Policy GN13 (p.117): 'otherwise on sites of 0.10 hectares and above'"),

  /**
   * Policy GN15 Housing Mix, Second Homes and Short-term Holiday Lets,
   * Space Standards and Requirements for Lifetime Homes Standards,
   * criterion D: "All new build residential development on sites of 5
   * or more units must provide a minimum of 20% of properties built to
   * Lifetime Homes Standards" (p.121). §5.99 (p.122) confirms this
   * applies to MARKET homes specifically ("Where market properties are
   * proposed on a site, the percentage requirement will apply to the
   * market properties") and traces the requirement to the Welsh
   * Development Quality Requirements 2021 and the 2022 Local Housing
   * Market Assessment's disability/ageing-population projections.
   */
  lifetimeHomesPercent: s(20, "LDP2, Policy GN15 criterion D (p.121) and §5.99 (p.122)"),
  lifetimeHomesAppliesAboveUnits: s(5, "LDP2, Policy GN15 criterion D (p.121): 'sites of 5 or more units'"),

  /**
   * §5.101 (p.123): "The Council has used the English nationally
   * prescribed space standards as a basis to inform the testing of
   * viability on housing sites ... These space standards and
   * requirements form the basis of the PCC space standards which will
   * be set out in the Residential Design SPG." I.e. NDSS is used here
   * as EVIDENCE for viability testing and as the basis for a forthcoming
   * local SPG — it is not itself directly adopted as a binding Welsh
   * standard (Wales has no NDSS equivalent for market homes; see
   * national.ts).
   */
  ndssStatus: s(
    "used as viability-testing evidence basis and as the basis for a forthcoming Residential Design SPG; not itself a directly adopted Welsh standard",
    "LDP2 §5.101 (p.123)"
  ),

  planStatus: s(
    "Deposit Plan (2017-2033) — out for public consultation, NOT YET ADOPTED as of this document",
    "LDP2 document header/title on every page; confirmed by the Glossary's own definition of 'Deposit Plan'"
  ),
};

// =====================================================================
// APPRAISAL DEFAULTS
// =====================================================================

/**
 * Appendix D's "N° of Units" typology rows map directly onto
 * SchemeSizeBand, with two exceptions:
 *  - "1": Appendix D tests two single-plot typologies (5-bed and 3-bed
 *    single), not one. This pack uses the 3-bed single row throughout
 *    (closer to this engine's house-type catalogue), noting the 5-bed
 *    alternative in each field's comment.
 *  - "2-5": Appendix D's typology is tested at N=4 units specifically.
 */

const BAND1_SOURCE = "FVR, Appendix D, '1' row (3-bed single typology; 5-bed single alternative noted per-field)";
const BAND_2_5_SOURCE = "FVR, Appendix D, N=4 ('2-5 units') row";
const BAND_6_9_SOURCE = "FVR, Appendix D, N=8 ('6-9 units') row";
const BAND_10_19_SOURCE = "FVR, Appendix D, N=16 ('10-19 units') row";
const BAND_20_32_SOURCE = "FVR, Appendix D, N=26 ('20-32 units') row";
const BAND_33_49_SOURCE = "FVR, Appendix D, N=40 ('33-49 units') row";
const BAND_50_99_SOURCE = "FVR, Appendix D, N=75 ('50-99 units') row";
const BAND_100_PLUS_SOURCE = "FVR, Appendix D, N=120 ('100+ units') row";

/**
 * s.106-per-dwelling: Appendix D's main numeric table gives a combined
 * "s.106 & SuDS / dwelling" figure per row. SuDS is stated elsewhere
 * (§5.30a, Appendix D footer) as a flat £1,500/dwelling. Subtracting
 * that flat SuDS figure from the combined column implies an s.106-alone
 * figure for each row — which matches the explicit "2024 allowance"
 * s.106 breakout table at the bottom-left of Appendix D for every band
 * EXCEPT "6-9 units": the main table's combined £1,500 implies £0 s.106
 * for that band, while the breakout table explicitly states £2,500/
 * dwelling as the 2024 s.106 allowance for 6-9-unit sites. This is a
 * genuine, unresolved inconsistency in the source document (reported
 * to the user, not silently resolved). This pack uses the breakout
 * table's explicit figure (£2,500) for "6-9", since it is the more
 * specific, explicitly-labelled source — but the main table's implied
 * £0 is flagged here for anyone cross-checking against Appendix D directly.
 */
const S106_BREAKOUT_SOURCE = "FVR, Appendix D, bottom-left 's.106 contributions' breakout table, '2024 allowance' column";

const bySchemeSize: Record<SchemeSizeBand, SchemeSizeAppraisalRow> = {
  "1": {
    buildCostPerSqm: s(1560, `${BAND1_SOURCE} — 3-bed single £1,560/sqm (5-bed single alternative: £1,610/sqm)`),
    designFeesPercent: s(12, BAND1_SOURCE),
    financeRatePercentPA: s(8.0, BAND1_SOURCE),
    developerProfitPercentGDV: s(10.0, `${BAND1_SOURCE} — "10% on GDV ... for single dwelling sites" per §5.46 (p.21)`),
    externalWorksPerDwelling: s(18750, `${BAND1_SOURCE} — 3-bed single £18,750 (5-bed single alternative: £24,000); general multi-unit rate is £18,000, per §5.26 (p.18)`),
    s106PerDwelling: s(0, "FVR, Appendix D breakout-table note: single-plot s.106 'relates solely to the provision of off-site affordable units' — not modelled as a flat per-dwelling fee in this band"),
    netDph: s(25, `${BAND1_SOURCE} — 3-bed single 25 dph (5-bed single alternative: 15 dph) — yield sense-check only, not a target`),
    netToGrossRatio: s(1.0, `${BAND1_SOURCE} — yield sense-check only, not a target`),
  },
  "2-5": {
    buildCostPerSqm: s(1540, BAND_2_5_SOURCE),
    designFeesPercent: s(9, BAND_2_5_SOURCE),
    financeRatePercentPA: s(8.0, BAND_2_5_SOURCE),
    developerProfitPercentGDV: s(15.0, `${BAND_2_5_SOURCE} — matches §5.46 (p.21): "15% on GDV for sites of between 2-5 dwellings"`),
    externalWorksPerDwelling: s(18000, "FVR §5.26 (p.18): general £18,000/dwelling rate"),
    s106PerDwelling: s(0, "FVR, Appendix D breakout-table note: 2-5-unit s.106 'relates solely to the provision of off-site affordable units' — not modelled as a flat per-dwelling fee in this band"),
    netDph: s(27, `${BAND_2_5_SOURCE} — yield sense-check only, not a target`),
    netToGrossRatio: s(0.9, `${BAND_2_5_SOURCE} — yield sense-check only, not a target`),
  },
  "6-9": {
    buildCostPerSqm: s(1490, BAND_6_9_SOURCE),
    designFeesPercent: s(8, BAND_6_9_SOURCE),
    financeRatePercentPA: s(8.0, BAND_6_9_SOURCE),
    developerProfitPercentGDV: s(16.0, BAND_6_9_SOURCE),
    externalWorksPerDwelling: s(18000, "FVR §5.26 (p.18): general £18,000/dwelling rate"),
    s106PerDwelling: s(2500, `${S106_BREAKOUT_SOURCE} — NOTE: Appendix D's main numeric table implies £0 s.106-alone for this band (its combined "s.106 & SuDS/dwelling" figure, £1,500, equals the flat SuDS rate alone). This is an unresolved internal inconsistency in the source document; the explicit breakout-table figure is used here. Flagged, not silently resolved.`),
    netDph: s(27, `${BAND_6_9_SOURCE} — yield sense-check only, not a target`),
    netToGrossRatio: s(0.9, `${BAND_6_9_SOURCE} — yield sense-check only, not a target`),
  },
  "10-19": {
    buildCostPerSqm: s(1430, BAND_10_19_SOURCE),
    designFeesPercent: s(7.5, BAND_10_19_SOURCE),
    financeRatePercentPA: s(7.5, BAND_10_19_SOURCE),
    developerProfitPercentGDV: s(17.0, BAND_10_19_SOURCE),
    externalWorksPerDwelling: s(18000, "FVR §5.26 (p.18): general £18,000/dwelling rate"),
    s106PerDwelling: s(2900, S106_BREAKOUT_SOURCE),
    netDph: s(28, `${BAND_10_19_SOURCE} — yield sense-check only, not a target`),
    netToGrossRatio: s(0.85, `${BAND_10_19_SOURCE} — yield sense-check only, not a target`),
  },
  "20-32": {
    buildCostPerSqm: s(1400, BAND_20_32_SOURCE),
    designFeesPercent: s(7.0, BAND_20_32_SOURCE),
    financeRatePercentPA: s(7.0, BAND_20_32_SOURCE),
    developerProfitPercentGDV: s(17.5, BAND_20_32_SOURCE),
    externalWorksPerDwelling: s(18000, "FVR §5.26 (p.18): general £18,000/dwelling rate"),
    s106PerDwelling: s(2900, S106_BREAKOUT_SOURCE),
    netDph: s(30, `${BAND_20_32_SOURCE} — yield sense-check only, not a target`),
    netToGrossRatio: s(0.8, `${BAND_20_32_SOURCE} — yield sense-check only, not a target`),
  },
  "33-49": {
    buildCostPerSqm: s(1350, BAND_33_49_SOURCE),
    designFeesPercent: s(7.0, BAND_33_49_SOURCE),
    financeRatePercentPA: s(7.0, BAND_33_49_SOURCE),
    developerProfitPercentGDV: s(18.0, `${BAND_33_49_SOURCE} — matches §5.46 (p.21): "18% on GDV for sites of between 33-49 units"`),
    externalWorksPerDwelling: s(18000, "FVR §5.26 (p.18): general £18,000/dwelling rate"),
    s106PerDwelling: s(2900, S106_BREAKOUT_SOURCE),
    netDph: s(30, `${BAND_33_49_SOURCE} — yield sense-check only, not a target`),
    netToGrossRatio: s(0.8, `${BAND_33_49_SOURCE} — yield sense-check only, not a target`),
  },
  "50-99": {
    buildCostPerSqm: s(1250, BAND_50_99_SOURCE),
    designFeesPercent: s(5, BAND_50_99_SOURCE),
    financeRatePercentPA: s(6.0, BAND_50_99_SOURCE),
    developerProfitPercentGDV: s(20.0, `${BAND_50_99_SOURCE} — matches §5.46 (p.21): "20% on GDV for sites of over 50 units"`),
    externalWorksPerDwelling: s(18000, "FVR §5.26 (p.18): general £18,000/dwelling rate"),
    s106PerDwelling: s(4350, S106_BREAKOUT_SOURCE),
    netDph: s(32, `${BAND_50_99_SOURCE} — yield sense-check only, not a target`),
    netToGrossRatio: s(0.75, `${BAND_50_99_SOURCE} — yield sense-check only, not a target`),
  },
  "100+": {
    buildCostPerSqm: s(1150, BAND_100_PLUS_SOURCE),
    designFeesPercent: s(5, BAND_100_PLUS_SOURCE),
    financeRatePercentPA: s(6.0, BAND_100_PLUS_SOURCE),
    developerProfitPercentGDV: s(20.0, BAND_100_PLUS_SOURCE),
    externalWorksPerDwelling: s(18000, "FVR §5.26 (p.18): general £18,000/dwelling rate"),
    s106PerDwelling: s(6000, S106_BREAKOUT_SOURCE),
    netDph: s(34, `${BAND_100_PLUS_SOURCE} — yield sense-check only, not a target`),
    netToGrossRatio: s(0.7, `${BAND_100_PLUS_SOURCE} — yield sense-check only, not a target`),
  },
};

/** §5.9 (p.15) / Appendix B median £psm per band; land value £/net acre per band from §5.39 (p.20) table and Appendix D (same figures, confirmed consistent throughout the document — the figure is a fixed £/acre rate per band applied uniformly to every typology, not an independent per-typology estimate, despite appearing identical across different-sized typology rows in Appendix D). */
const byMarketBand: Record<MarketBand, MarketBandRow> = {
  1: { salesPricePerSqm: s(2300, "FVR §5.9 (p.15) / Appendix B"), landValuePerNetAcre: s(150000, "FVR §5.39 (p.20) table / Appendix D") },
  2: { salesPricePerSqm: s(2600, "FVR §5.9 (p.15) / Appendix B"), landValuePerNetAcre: s(200000, "FVR §5.39 (p.20) table / Appendix D") },
  3: { salesPricePerSqm: s(2900, "FVR §5.9 (p.15) / Appendix B"), landValuePerNetAcre: s(250000, "FVR §5.39 (p.20) table / Appendix D") },
  4: { salesPricePerSqm: s(3200, "FVR §5.9 (p.15) / Appendix B"), landValuePerNetAcre: s(300000, "FVR §5.39 (p.20) table / Appendix D") },
};

/**
 * On-site affordable housing % by band × scheme size, transcribed
 * exactly from FVR §7.1 (p.23) / §4.20 (p.13) — the same table appears
 * twice in the document, identically, and is the table Policies GN16
 * and GN20 of the Deposit Plan are directly derived from (per §7.1's
 * own text). "1" and "2-5" bands are `null` throughout: per §1.6, §4.21
 * and §7.3, sites of fewer than 10 dwellings are expected to make an
 * OFF-SITE financial contribution instead of delivering an on-site %
 * (except the Band-4 6-9 cell below, which the source explicitly carves
 * out as viable on-site) — `null` here means "off-site contribution
 * expected instead", not "zero and untested".
 */
const affordableHousingPercent: AffordableHousingTable = {
  1: { "6-9": s(0, "FVR §7.1/§4.20"), "10-19": s(0, "FVR §7.1/§4.20"), "20-32": s(0, "FVR §7.1/§4.20"), "33-49": s(0, "FVR §7.1/§4.20"), "50-99": s(0, "FVR §7.1/§4.20"), "100+": s(0, "FVR §7.1/§4.20") },
  2: { "6-9": s(0, "FVR §7.1/§4.20"), "10-19": s(0, "FVR §7.1/§4.20"), "20-32": s(0, "FVR §7.1/§4.20"), "33-49": s(0, "FVR §7.1/§4.20"), "50-99": s(5.0, "FVR §7.1/§4.20"), "100+": s(17.5, "FVR §7.1/§4.20") },
  3: { "6-9": s(0, "FVR §7.1/§4.20"), "10-19": s(12.5, "FVR §7.1/§4.20"), "20-32": s(15.0, "FVR §7.1/§4.20"), "33-49": s(20.0, "FVR §7.1/§4.20"), "50-99": s(25.0, "FVR §7.1/§4.20"), "100+": s(25.0, "FVR §7.1/§4.20") },
  4: {
    "6-9": s(25.0, "FVR §7.1/§4.20 and §4.21 (p.13): explicit Band-4 exception, viable on-site for 6-9-unit sites"),
    "10-19": s(25.0, "FVR §7.1/§4.20"),
    "20-32": s(30.0, "FVR §7.1/§4.20"),
    "33-49": s(35.0, "FVR §7.1/§4.20"),
    "50-99": s(40.0, "FVR §7.1/§4.20"),
    "100+": null, // "NOT TESTED" per Appendix D's own cell for this combination
  },
};

export const PEMBROKESHIRE_APPRAISAL_DEFAULTS: LocalAppraisalDefaults = {
  councilName: "Pembrokeshire County Council (excluding Pembrokeshire Coast National Park)",
  bySchemeSize,
  byMarketBand,
  affordableHousingPercent,
  contingencyPercent: s(5, "FVR §5.32 (p.19): '5% on total construction costs' flat allowance"),
  marketingPercentUnder20Units: s(2, "FVR §5.33(a) (p.19): '2% on all site typologies of less than 20 dwellings'"),
  marketingPercent20PlusUnits: s(2.5, "FVR §5.33(b) (p.19): '2.5% on all site typologies of 20 dwellings or more'"),
  legalCostPerDwelling: s(
    600,
    "FVR §5.33(c) (p.19): 'a further allowance for legal costs, calculated at £600 per dwelling on both open market and affordable homes'. NOTE: the worked example model printed at Appendix E uses £650/dwelling instead — a genuine, unresolved inconsistency between the narrative text and the live appraisal model, flagged rather than silently picked."
  ),
  sudsPerDwelling: s(1500, "FVR §5.30(a) (p.18) and Appendix D footer: flat £1,500/dwelling"),
  landAcquisitionFeesPercent: s(1.5, "FVR §5.42 (p.20): '1.5% on top of this land price ... for fees connected with the land purchase' (plus Land Transaction Tax at prevailing rates, not separately modelled)"),
  bungalowSalesPremiumPercent: s(20, "FVR §5.7 (p.15): 'bungalows will generally achieve a premium of c.20% over the price per sqm for 2-storey housing'"),
  smallSitePremiumPercent: s(10, "FVR §5.10 (p.15): sites of 10 dwellings or less 'will often reflect a premium of 10% or more, due to the \"individual\" character/quality of such developments'"),
  socialRentTransferValuePercentOfAcg: s(55, "FVR §5.11 (p.15): '55% of the Welsh Government's Acceptable Cost Guidance (ACG) for social rented tenure' — higher than the ~42% typical of most other Welsh authorities (see national.ts)"),
  intermediateTransferValuePercentOfOmv: s(70, "FVR §5.11 (p.15): '70% of market value for intermediate tenure'"),
  tenureSplitSocialRentPercent: s(75, "FVR §5.13 (p.15): assumes 75% of s.106 affordable homes are social rented tenure, based on the most recent LHMA"),
  tenureSplitIntermediatePercent: s(25, "FVR §5.13 (p.15): remaining 25% intermediate tenure"),
  defaultMarketBand: 2,
  acgApproximatedAsOmv: true,
  acgApproximationNote: s(
    "Actively researched, not just unchecked: Welsh Government's own current public ACG guidance (the 2023-07 'Costs included in Social Housing Grant' document) defines ACG as Works Cost/m² plus on-costs and explicitly EXCLUDES site acquisition/land cost — confirming the 'including land' 2021 series FVR §5.11 refers to was a separate, since-discontinued publication, not something WG still publishes. Three Welsh councils' own supplementary guidance (Blaenau Gwent, Bro Morgannwg, and an earlier Monmouthshire document) each derive their social-rent transfer values as a stated % of '2021 Band 1 ACG figures' (42%, 42%, 58% respectively) uplifted annually by the WG social-rent-cap inflation factor — none of them publish the underlying raw 2021 ACG-including-land table itself, only their own already-discounted result, and in a different council's own regional band at that. No FOI/ATISN route was pursued. Conclusion: the 2021 ACG-including-land table was circulated directly to local authorities/RSLs, not published, so there is nothing to cite for Pembrokeshire specifically — ACG is therefore approximated as equal to the market band's OMV sales price for the social-rent transfer-value calculation. Real ACG-including-land rates are materially below OMV, so this OVERSTATES social-rent transfer value and every metric derived from it (affordable-housing revenue, GDV, residual land value) whenever affordableUnits > 0. Flagged via Metrics.affordableValueOverstated — not silently assumed.",
    "Research conclusion (not a document citation): checked gov.wales's current ACG guidance (land excluded), and Blaenau Gwent/Bro Morgannwg/Monmouthshire councils' own derived-from-2021-ACG transfer-value documents, none of which publish the raw table — see README for the full trail"
  ),
};

/** Not a sourced figure — a judgment call, flagged as such. Band 2 (§5.9: £2,600 psm) covers a broad, central spread of settlements (per Appendix B: Central, Cleddau Estuary North & West, Pembroke Dock area, Teifi Estuary) and sits at the lower-middle of the County's 4 bands — a reasonable "typical site" default when a user hasn't specified one, not a claim that it's the most common or most representative band. */
export const PEMBROKESHIRE_DEFAULT_MARKET_BAND_NOTE =
  "defaultMarketBand=2 is a judgment call for a sensible UI default, not a figure read off any document";

export const PEMBROKESHIRE_HOUSE_TYPE_NOTE: Record<HouseTypeId, string> =
  {} as Record<HouseTypeId, string>; // reserved — no Pembrokeshire-specific NDSS overrides found; national NDSS figures apply unchanged locally.
