// Plot Line layout engine — shared types.
//
// Pure TypeScript, no React/DOM/Supabase imports anywhere in src/engine.
// Must stay callable from a plain Node script (scripts/run-fixtures.ts)
// and later from a Web Worker, unchanged.

import type { MarketBand } from "../rules/jurisdictions/types";

/** A point in British National Grid (EPSG:27700) metres: [easting, northing]. */
export type BNGPoint = [number, number];

/** Closed or open ring of BNG points describing a polygon boundary. */
export type BNGPolygon = BNGPoint[];

export type HouseTypeId = "2-bed-terrace" | "3-bed-semi" | "4-bed-detached" | "3-bed-bungalow";

export interface EngineInputs {
  /** Relative weight per house type, e.g. { "2-bed-terrace": 1, "3-bed-semi": 1, "4-bed-detached": 1 }. Missing types default to 0. */
  mix?: Partial<Record<HouseTypeId, number>>;
  /** Off-street parking spaces required per unit. Overrides rules.ts default. */
  parkingRatioPerUnit?: number;
  /** Minimum private garden depth in metres. Overrides rules.ts default. */
  minGardenDepthM?: number;
  /** Minimum distance between facing habitable room windows. Overrides rules.ts default. */
  backToBackM?: number;
  /** Minimum NDSS GIA per house type, m². Overrides rules.ts defaults. */
  ndssMinGiaM2?: Partial<Record<HouseTypeId, number>>;
  /** Which council's local rules pack to resolve against (src/rules/jurisdictions). Defaults to "pembrokeshire" — the only pack implemented so far. Unknown/unset councils fall back to the national baseline alone. */
  localAuthority?: string;
  /** Local market value band (1=lowest..4=highest), a council-specific concept (see src/rules/jurisdictions/types.ts). Defaults to the resolved local pack's own defaultMarketBand. */
  marketBand?: MarketBand;
  /** £ per m² used to estimate open-market GDV, overriding the resolved jurisdiction's own sourced default for this market band. */
  gdvPerSqm?: number;
  /** £ per m² used to estimate build cost, overriding the resolved jurisdiction's own sourced default for this scheme-size band. */
  buildCostPerSqm?: number;
}

export interface PlacedPlot {
  id: string;
  houseType: HouseTypeId;
  /** Whole plot boundary (driveway/parking + house footprint + garden), BNG polygon. */
  plotBng: BNGPolygon;
  /** House footprint, BNG polygon. */
  footprintBng: BNGPolygon;
  /** Private garden area, BNG polygon, or null if none could be fitted. */
  gardenBng: BNGPolygon | null;
  /** Gross internal area, m². */
  giaM2: number;
  /** Id shared by every unit placed in the same attached block (terrace run, semi pair, or a lone detached unit). */
  blockId: string;
  /** This plot's position within its block, 0-indexed from the block's first unit. */
  blockPosition: number;
  /** Total number of units in this plot's block. */
  blockSize: number;
}

export interface RoadSegment {
  id: string;
  centerlineBng: BNGPoint[];
  widthM: number;
}

export interface LayoutResult {
  plots: PlacedPlot[];
  roads: RoadSegment[];
  parkingSpacesBng: BNGPoint[];
}

export interface Metrics {
  totalUnits: number;
  mix: Record<HouseTypeId, number>;
  /** Dwellings per hectare over the developable (net) area — excludes roads/open space. */
  netDensityDph: number;
  /** Dwellings per hectare over the whole site boundary. */
  grossDensityDph: number;
  totalGiaM2: number;
  gdv: number;
  buildCost: number;
  /** Target developer profit deducted in arriving at residualLandValue (not a cash cost line, but shown for transparency). */
  developerProfit: number;
  residualLandValue: number;
  /** Number of the totalUnits notionally treated as affordable, per the resolved jurisdiction's affordable-housing-% table. Note: v0's layout doesn't tag any specific physical plot as "affordable" — this is a financial overlay on the whole scheme, not a per-plot flag. */
  affordableUnits: number;
  /** The % actually used (0 if the resolved table had no on-site figure for this band/size, e.g. because the source says "off-site contribution" instead — see jurisdiction pack comments). */
  affordablePercentOnSite: number;
  /** Which council's rules were actually resolved and used for this calculation. */
  localAuthority: string;
  /** Which market band was actually used (input, or the local pack's own default). */
  marketBand: MarketBand;
  /** true when affordableUnits > 0 and the resolved jurisdiction approximates ACG (Acceptable Cost Guidance) as equal to OMV for the social-rent transfer value — this OVERSTATES gdv, developerProfit and residualLandValue, since real ACG rates are materially below OMV. Surface prominently in the UI whenever true; never hide it. */
  affordableValueOverstated: boolean;
  /** residualLandValue is always a simplified, single-point calculation (no real cash-flow model) — present so the UI doesn't need to hardcode that fact; always true in v0. */
  residualLandValueIndicative: true;
}

export interface ComplianceCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  /** Where the rule comes from — a citation, not a magic number. */
  ruleRef: string;
  detail: string;
}

export interface EngineOutput {
  layout: LayoutResult;
  metrics: Metrics;
  compliance: ComplianceCheck[];
}
