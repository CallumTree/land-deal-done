// Plot Line layout engine — shared types.
//
// Pure TypeScript, no React/DOM/Supabase imports anywhere in src/engine.
// Must stay callable from a plain Node script (scripts/run-fixtures.ts)
// and later from a Web Worker, unchanged.

/** A point in British National Grid (EPSG:27700) metres: [easting, northing]. */
export type BNGPoint = [number, number];

/** Closed or open ring of BNG points describing a polygon boundary. */
export type BNGPolygon = BNGPoint[];

export type HouseTypeId = "2-bed-terrace" | "3-bed-semi" | "4-bed-detached";

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
  /** £ per sq ft used to estimate GDV. */
  gdvPerSqFt?: number;
  /** £ per sq ft used to estimate build cost. */
  buildCostPerSqFt?: number;
}

export interface PlacedPlot {
  id: string;
  houseType: HouseTypeId;
  /** House footprint, BNG polygon. */
  footprintBng: BNGPolygon;
  /** Private garden area, BNG polygon, or null if none could be fitted. */
  gardenBng: BNGPolygon | null;
  /** Gross internal area, m². */
  giaM2: number;
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
  residualLandValue: number;
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
