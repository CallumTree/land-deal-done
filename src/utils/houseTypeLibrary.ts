// Standard UK developer house-type catalogue used by the smart layout engine.
//
// Two things this file makes explicit, because they're easy to get wrong:
//
// 1. `gia` is Gross Internal Area TOTAL across every storey. A 2-storey
//    house's build cost is GIA × £/m², and GIA already sums both floors —
//    so the "doubling" for a two-storey build happens automatically via a
//    bigger GIA figure, not via any separate storey multiplier. What DOES
//    differ by storey count is the ground-floor footprint (the shape we
//    actually draw on the site plan), which is roughly GIA / storeys. That
//    footprint is derived below rather than hand-typed, so it can't drift
//    out of sync with the GIA figure.
//
// 2. Sales and build rates are region-specific (see REGION_PRESETS in
//    types/locationPresets.ts) rather than flat national numbers, so a
//    Pembrokeshire scheme isn't priced like a London one. `getUnitEconomics`
//    is the single place that resolves a house type's £/m² for a given
//    region + build spec.

import { PROPERTY_DEFAULTS } from "@/types/calculator";
import { REGION_PRESETS } from "@/types/locationPresets";

export type FormFactor = "Bungalow" | "Semi" | "Detached";
export type BuildSpec = "low" | "medium" | "high";

export interface HouseTypeDefinition {
  id: string;
  /** Which REGION_PRESETS.salesPerSqm key to price this type from. */
  baseType: string;
  bedrooms: number;
  formFactor: FormFactor;
  storeys: 1 | 2;
  hasGarage: boolean;
  plotVariant: "standard" | "premium";
  /** Gross Internal Area, m², TOTAL across all storeys. */
  gia: number;
  /** Multiplier vs the baseType's regional £/m² sales rate. */
  salesRateAdjust: number;
  /** Extra % added to sale value for having a garage (market values it, but it isn't built at house £/m² rate). */
  garagePremiumPercent?: number;
  /** Extra front setback/driveway apron depth for a bigger-drive plot. */
  driveBonusM?: number;
  /** Extra rear garden depth for a bigger-garden plot. */
  gardenBonusM?: number;
}

// External footprint (what we draw) vs internal GIA (what's costed) — walls,
// stairwells and other non-habitable area not counted in GIA push the actual
// building footprint above a naive GIA/storeys.
const FOOTPRINT_OVERHEAD = 1.15;

const ASPECT_RATIO: Record<FormFactor, number> = {
  Bungalow: 1.25, // wider than deep — single storey spreads out
  Semi: 1.15,
  Detached: 1.05, // closer to square
};

const GARAGE_WIDTH_M: Record<"single" | "double", number> = {
  single: 3.0,
  double: 5.5,
};

export const HOUSE_TYPE_LIBRARY: HouseTypeDefinition[] = [
  // --- Bungalows (1 storey) ---
  { id: "1-Bed Bungalow", baseType: "2-Bed Bungalow", bedrooms: 1, formFactor: "Bungalow", storeys: 1, hasGarage: false, plotVariant: "standard", gia: 50, salesRateAdjust: 1.05 },
  { id: "2-Bed Bungalow", baseType: "2-Bed Bungalow", bedrooms: 2, formFactor: "Bungalow", storeys: 1, hasGarage: false, plotVariant: "standard", gia: 84.5, salesRateAdjust: 1 },
  { id: "2-Bed Bungalow with Garage", baseType: "2-Bed Bungalow", bedrooms: 2, formFactor: "Bungalow", storeys: 1, hasGarage: true, plotVariant: "premium", gia: 72, salesRateAdjust: 1, garagePremiumPercent: 4, driveBonusM: 2, gardenBonusM: 2 },
  { id: "3-Bed Bungalow", baseType: "3-Bed Bungalow", bedrooms: 3, formFactor: "Bungalow", storeys: 1, hasGarage: false, plotVariant: "standard", gia: 109, salesRateAdjust: 1 },
  { id: "3-Bed Bungalow with Garage", baseType: "3-Bed Bungalow", bedrooms: 3, formFactor: "Bungalow", storeys: 1, hasGarage: true, plotVariant: "premium", gia: 94, salesRateAdjust: 1, garagePremiumPercent: 4, driveBonusM: 2, gardenBonusM: 3 },

  // --- Semis (2 storey) ---
  { id: "2-Bed Semi", baseType: "2-Bed Semi", bedrooms: 2, formFactor: "Semi", storeys: 2, hasGarage: false, plotVariant: "standard", gia: 75, salesRateAdjust: 1 },
  { id: "2-Bed Semi with Garage", baseType: "2-Bed Semi", bedrooms: 2, formFactor: "Semi", storeys: 2, hasGarage: true, plotVariant: "premium", gia: 68, salesRateAdjust: 1, garagePremiumPercent: 5, driveBonusM: 1.5 },
  { id: "3-Bed Semi", baseType: "3-Bed Semi", bedrooms: 3, formFactor: "Semi", storeys: 2, hasGarage: false, plotVariant: "standard", gia: 90, salesRateAdjust: 1 },
  { id: "3-Bed Semi with Garage", baseType: "3-Bed Semi", bedrooms: 3, formFactor: "Semi", storeys: 2, hasGarage: true, plotVariant: "premium", gia: 88, salesRateAdjust: 1, garagePremiumPercent: 5, driveBonusM: 1.5 },

  // --- Detached (2 storey, garage standard on the base types already priced-in) ---
  { id: "3-Bed Detached", baseType: "3-Bed Detached", bedrooms: 3, formFactor: "Detached", storeys: 2, hasGarage: true, plotVariant: "standard", gia: 92.5, salesRateAdjust: 1 },
  { id: "4-Bed Detached", baseType: "4-Bed Detached", bedrooms: 4, formFactor: "Detached", storeys: 2, hasGarage: true, plotVariant: "standard", gia: 120, salesRateAdjust: 1 },
  { id: "4-Bed Detached Executive", baseType: "4-Bed Detached", bedrooms: 4, formFactor: "Detached", storeys: 2, hasGarage: true, plotVariant: "premium", gia: 145, salesRateAdjust: 1.08, driveBonusM: 3, gardenBonusM: 4 },
];

export const HOUSE_TYPE_MAP: Record<string, HouseTypeDefinition> = Object.fromEntries(
  HOUSE_TYPE_LIBRARY.map((def) => [def.id, def])
);

export interface FootprintDims {
  frontageM: number;
  depthM: number;
}

/** Ground-floor footprint dimensions, derived from GIA and storey count so they can't drift out of sync. */
export function deriveFootprint(def: HouseTypeDefinition): FootprintDims {
  const footprintAreaM2 = (def.gia / def.storeys) * FOOTPRINT_OVERHEAD;
  const aspect = ASPECT_RATIO[def.formFactor];
  const depthM = Math.sqrt(footprintAreaM2 / aspect);
  const frontageM = footprintAreaM2 / depthM;
  return {
    frontageM: Math.round(frontageM * 10) / 10,
    depthM: Math.round(depthM * 10) / 10,
  };
}

/** Additional plot frontage taken up by an attached garage (single, unless the plot is a premium/executive one). */
export function garageWidthFor(def: HouseTypeDefinition): number {
  if (!def.hasGarage) return 0;
  return def.plotVariant === "premium" && def.formFactor === "Detached" ? GARAGE_WIDTH_M.double : GARAGE_WIDTH_M.single;
}

export interface UnitEconomics {
  gia: number;
  salesValue: number;
  buildCost: number;
  salesRatePerM2: number;
  buildRatePerM2: number;
}

/**
 * Resolve a house type's sale value and build cost for a given region and
 * build spec. Falls back to the flat national defaults in PROPERTY_DEFAULTS
 * when the type or region isn't recognised (legacy rows, no region detected).
 */
export function getUnitEconomics(typeId: string, region?: string, buildSpec: BuildSpec = "medium"): UnitEconomics {
  const def = HOUSE_TYPE_MAP[typeId];
  const regionPreset = region ? REGION_PRESETS[region] : undefined;

  if (!def) {
    const fallback = PROPERTY_DEFAULTS[typeId];
    const gia = fallback?.giaPerUnit ?? 0;
    const salesRatePerM2 = regionPreset && gia > 0 && regionPreset.salesPerSqm[typeId as keyof typeof regionPreset.salesPerSqm]
      ? regionPreset.salesPerSqm[typeId as keyof typeof regionPreset.salesPerSqm]
      : gia > 0 ? (fallback?.salesValue ?? 0) / gia : 0;
    const buildRatePerM2 = regionPreset ? regionPreset.buildPerSqm[buildSpec] : fallback?.buildPerSqm ?? 0;
    return {
      gia,
      salesValue: salesRatePerM2 * gia,
      buildCost: buildRatePerM2 * gia,
      salesRatePerM2,
      buildRatePerM2,
    };
  }

  const baseFallback = PROPERTY_DEFAULTS[def.baseType];
  const baseSalesRatePerM2 = regionPreset
    ? regionPreset.salesPerSqm[def.baseType as keyof typeof regionPreset.salesPerSqm]
    : baseFallback && baseFallback.giaPerUnit
      ? (baseFallback.salesValue ?? 0) / baseFallback.giaPerUnit
      : 0;
  const buildRatePerM2 = regionPreset ? regionPreset.buildPerSqm[buildSpec] : baseFallback?.buildPerSqm ?? 0;

  const salesRatePerM2 = baseSalesRatePerM2 * def.salesRateAdjust;
  const garagePremium = def.hasGarage ? (def.garagePremiumPercent ?? 0) / 100 : 0;
  const salesValue = salesRatePerM2 * def.gia * (1 + garagePremium);

  // Garages are simpler structures than habitable floor area — cost roughly
  // half the house's £/m² rate over a typical single/double garage area.
  const garageAreaM2 = def.hasGarage ? (def.plotVariant === "premium" && def.formFactor === "Detached" ? 28 : 15) : 0;
  const buildCost = buildRatePerM2 * def.gia + buildRatePerM2 * garageAreaM2 * 0.55;

  return { gia: def.gia, salesValue, buildCost, salesRatePerM2, buildRatePerM2 };
}
