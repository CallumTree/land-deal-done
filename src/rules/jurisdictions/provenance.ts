// Flattens a resolved jurisdiction's appraisal figures (for a given scheme-
// size band and market band) into a UI-friendly list: label, value, unit,
// provenance classification (sourced/approximated/unsourced) and the
// source citation to reveal on click. Pure data — no React/DOM — so it's
// safe to import from either a server or client component.

import { classifySource, type SchemeSizeBand, type MarketBand } from "./types";
import type { ResolvedJurisdiction } from "./index";

export interface ProvenanceEntry {
  id: string;
  label: string;
  valueDisplay: string;
  classification: ReturnType<typeof classifySource>;
  source: string;
}

export function appraisalProvenance(
  jurisdiction: ResolvedJurisdiction,
  schemeSizeBand: SchemeSizeBand,
  marketBand: MarketBand
): ProvenanceEntry[] {
  const local = jurisdiction.localAppraisal;
  const national = jurisdiction.nationalAppraisal;
  const entries: ProvenanceEntry[] = [];

  const push = (id: string, label: string, valueDisplay: string, source: string) => {
    entries.push({ id, label, valueDisplay, classification: classifySource(source), source });
  };

  if (local) {
    const sizeRow = local.bySchemeSize[schemeSizeBand];
    const bandRow = local.byMarketBand[marketBand];
    push("sales-price", "Open-market sales price", `£${bandRow.salesPricePerSqm.value.toLocaleString()}/m²`, bandRow.salesPricePerSqm.source);
    push("land-value", "Benchmark land value", `£${bandRow.landValuePerNetAcre.value.toLocaleString()}/net acre`, bandRow.landValuePerNetAcre.source);
    push("build-cost", "Build cost", `£${sizeRow.buildCostPerSqm.value.toLocaleString()}/m²`, sizeRow.buildCostPerSqm.source);
    push("design-fees", "Design fees", `${sizeRow.designFeesPercent.value}% of build cost`, sizeRow.designFeesPercent.source);
    push("finance-rate", "Finance rate", `${sizeRow.financeRatePercentPA.value}% p.a.`, sizeRow.financeRatePercentPA.source);
    push("profit", "Developer profit target", `${sizeRow.developerProfitPercentGDV.value}% of GDV`, sizeRow.developerProfitPercentGDV.source);
    push("external-works", "External works", `£${sizeRow.externalWorksPerDwelling.value.toLocaleString()}/dwelling`, sizeRow.externalWorksPerDwelling.source);
    push("s106", "s.106 contribution", `£${sizeRow.s106PerDwelling.value.toLocaleString()}/dwelling`, sizeRow.s106PerDwelling.source);
    push("suds", "SuDS allowance", `£${local.sudsPerDwelling.value.toLocaleString()}/dwelling`, local.sudsPerDwelling.source);
    push("contingency", "Contingency", `${local.contingencyPercent.value}%`, local.contingencyPercent.source);
    push("legal", "Legal costs", `£${local.legalCostPerDwelling.value.toLocaleString()}/dwelling`, local.legalCostPerDwelling.source);
    push(
      "marketing",
      "Marketing & sale costs",
      `${local.marketingPercentUnder20Units.value}% (<20 units) / ${local.marketingPercent20PlusUnits.value}% (20+ units)`,
      local.marketingPercentUnder20Units.source
    );
    push("land-fees", "Land acquisition fees", `${local.landAcquisitionFeesPercent.value}% + LTT`, local.landAcquisitionFeesPercent.source);
    push("bungalow-premium", "Bungalow sales premium", `+${local.bungalowSalesPremiumPercent.value}%`, local.bungalowSalesPremiumPercent.source);
    push("small-site-premium", "Small-site sales premium (≤10 units)", `+${local.smallSitePremiumPercent.value}%`, local.smallSitePremiumPercent.source);
    push(
      "social-rent-transfer",
      "Social-rent transfer value",
      `${local.socialRentTransferValuePercentOfAcg.value}% of ACG${local.acgApproximatedAsOmv ? " (ACG approximated as OMV — see flag)" : ""}`,
      // The 55% split itself is sourced (FVR §5.11), but what "ACG" MEANS
      // here is approximated (ACG≈OMV) — surface the approximation text
      // so classifySource's "approximat" check actually fires, and so
      // clicking this row explains the flag rather than just citing §5.11.
      local.acgApproximatedAsOmv
        ? `${local.socialRentTransferValuePercentOfAcg.source}. ${local.acgApproximationNote.value}`
        : local.socialRentTransferValuePercentOfAcg.source
    );
    push("intermediate-transfer", "Intermediate transfer value", `${local.intermediateTransferValuePercentOfOmv.value}% of OMV`, local.intermediateTransferValuePercentOfOmv.source);
    push(
      "tenure-split",
      "Tenure split (social rent / intermediate)",
      `${local.tenureSplitSocialRentPercent.value}% / ${local.tenureSplitIntermediatePercent.value}%`,
      local.tenureSplitSocialRentPercent.source
    );
    const affordableEntry = local.affordableHousingPercent[marketBand]?.[schemeSizeBand];
    push(
      "affordable-percent",
      "Affordable housing % on-site",
      affordableEntry ? `${affordableEntry.value}%` : "0% (off-site contribution expected instead — see README)",
      affordableEntry?.source ?? "FVR §1.6/§4.21/§7.3 — sites under 10 dwellings generally make an off-site contribution instead of an on-site %"
    );
  } else {
    push("sales-price", "Open-market sales price", `£${national.salesPricePerSqmPlaceholder.value.toLocaleString()}/m²`, national.salesPricePerSqmPlaceholder.source);
    push("build-cost", "Build cost", `£${national.buildCostPerSqmPlaceholder.value.toLocaleString()}/m²`, national.buildCostPerSqmPlaceholder.source);
    push("land-value", "Benchmark land value", `£${national.landValuePerNetAcrePlaceholder.value.toLocaleString()}/net acre`, national.landValuePerNetAcrePlaceholder.source);
    push("contingency", "Contingency", `${national.contingencyPercent.value}%`, national.contingencyPercent.source);
    push("legal", "Legal costs", `£${national.legalCostPerDwelling.value.toLocaleString()}/dwelling`, national.legalCostPerDwelling.source);
    push("land-fees", "Land acquisition fees", `${national.landAcquisitionFeesPercent.value}% + LTT`, national.landAcquisitionFeesPercent.source);
  }

  return entries;
}

export function planningProvenance(jurisdiction: ResolvedJurisdiction): ProvenanceEntry[] {
  const entries: ProvenanceEntry[] = [];
  const push = (id: string, label: string, valueDisplay: string, source: string) => {
    entries.push({ id, label, valueDisplay, classification: classifySource(source), source });
  };

  const np = jurisdiction.nationalPlanning;
  push("back-to-back", "Back-to-back distance", `${np.backToBackM.value}m`, np.backToBackM.source);
  push("garden-depth", "Minimum garden depth", `${np.minGardenDepthM.value}m`, np.minGardenDepthM.source);
  push("road-width", "Road width", `${np.roadWidthM.value}m`, np.roadWidthM.source);
  push("turning-head", "Turning head diameter", `${np.turningHeadDiameterM.value}m`, np.turningHeadDiameterM.source);
  push("fire-access", "Fire/refuse access distance", `${np.maxFireAccessDistanceM.value}m`, np.maxFireAccessDistanceM.source);
  push("parking", "Parking spaces per unit", `${np.parkingSpacesPerUnit.value}`, np.parkingSpacesPerUnit.source);

  if (jurisdiction.localPlanning) {
    const lp = jurisdiction.localPlanning;
    for (const [tier, d] of Object.entries(lp.minGrossDensityDphByTier)) {
      push(`density-${tier}`, `Min gross density (${tier})`, `${d.value} dph`, d.source);
    }
    push("lifetime-homes", "Lifetime Homes %", `${lp.lifetimeHomesPercent.value}% on sites of ${lp.lifetimeHomesAppliesAboveUnits.value}+ units`, lp.lifetimeHomesPercent.source);
    push("ndss-status", "NDSS status locally", lp.ndssStatus.value, lp.ndssStatus.source);
    push("plan-status", "Local plan status", lp.planStatus.value, lp.planStatus.source);
  }

  return entries;
}
