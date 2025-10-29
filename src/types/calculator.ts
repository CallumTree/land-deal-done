export interface PropertyRow {
  id: string;
  type: string;
  units: number;
  // Legacy fields (for backward compatibility)
  giaPerUnit: number;
  salesValue: number;
  unitPriceOverride: number;
  buildPerSqm: number;
  // New fields (preferred)
  gia_m2_per_unit?: number;
  sale_value_per_unit?: number;
  sale_ppm2?: number;
  build_ppm2?: number;
  notes: string;
  priceSource?: {
    region: string;
    spec: string;
    localityMultiplier: number;
    appliedAt: string;
  };
}

export interface PlanningUpliftData {
  currentValueType: "Agricultural" | "Brownfield" | "Industrial" | "Yard" | "Custom";
  currentValueOverride?: number;
  planningCosts: number;
  successProbability: number;
  includeInLenderPack: boolean;
}

export interface GlobalInputs {
  // Legacy fields (for backward compatibility)
  professionalFeesPercent: number;
  marketingSalesPercent: number;
  contingencyPercent: number;
  financePercent: number;
  s106CIL: number;
  landCost: number;
  targetMarginPercent: number;
  vatEnabled: boolean;
  siteArea: number;
  demolitionClearance: number;
  ecologyEnvironmental: number;
  groundInvestigation: number;
  planningStatutoryFees: number;
  serviceConnections: number;
  abnormals: number;
  siteSecurity: number;
  miscellaneousAllowance: number;
  abnormalsPercentEnabled: boolean;
  abnormalsPercent: number;
  siteNotes: string;
  
  // New fields (preferred)
  buildBaselineType?: "manual" | "preset";
  externalsPercent?: number;
  prelimsPercent?: number;
  financeInterestApr?: number;
  financeArrangementFee?: number;
  financeExitFee?: number;
  programmeDurationMonths?: number;
  s278s38Works?: number;
  planningApplicationFees?: number;
  buildingControlFees?: number;
  stampDutyLandTax?: number;
  legalFeesLand?: number;
  developerEquityCash?: number;
  planningUplift?: PlanningUpliftData;
}

export interface CalculatedValues {
  totalGDV: number;
  // Legacy fields
  buildCost: number;
  finance: number;
  other: number;
  // New fields (with full breakdown)
  baseBuildCost?: number;
  externals?: number;
  prelims?: number;
  professionalFees: number;
  marketingSales: number;
  contingency: number;
  financeInterest?: number;
  financeFixedFees?: number;
  sitePrepTechnical: number;
  otherPlanning?: number;
  landCost: number;
  landAcquisitionCosts?: number;
  totalCosts: number;
  netProfit: number;
  profitMarginPercent: number;
  costToGDVPercent?: number;
  residualLandValue: number;
  variance: number;
  roce?: number;
}

export const PROPERTY_DEFAULTS: Record<string, Partial<PropertyRow>> = {
  "2-Bed Semi": { giaPerUnit: 75, salesValue: 247500, buildPerSqm: 1650, unitPriceOverride: 0 },
  "3-Bed Semi": { giaPerUnit: 90, salesValue: 292500, buildPerSqm: 1650, unitPriceOverride: 0 },
  "3-Bed Detached": { giaPerUnit: 92.5, salesValue: 314500, buildPerSqm: 1700, unitPriceOverride: 0 },
  "4-Bed Detached": { giaPerUnit: 120, salesValue: 432000, buildPerSqm: 1800, unitPriceOverride: 0 },
  "2-Bed Bungalow": { giaPerUnit: 84.5, salesValue: 283075, buildPerSqm: 1800, unitPriceOverride: 0 },
  "3-Bed Bungalow": { giaPerUnit: 109, salesValue: 370600, buildPerSqm: 1900, unitPriceOverride: 0 },
  "Apartment (1-bed)": { giaPerUnit: 52, salesValue: 208000, buildPerSqm: 2000, unitPriceOverride: 0 },
  "Apartment (2-bed)": { giaPerUnit: 70, salesValue: 266000, buildPerSqm: 2000, unitPriceOverride: 0 },
};

export const PROPERTY_TYPES = [
  "2-Bed Semi",
  "3-Bed Semi",
  "3-Bed Detached",
  "4-Bed Detached",
  "2-Bed Bungalow",
  "3-Bed Bungalow",
  "Apartment (1-bed)",
  "Apartment (2-bed)",
  "Custom",
];

export const SCENARIO_PRESETS = {
  "Max Profit Mix": [
    { type: "4-Bed Detached", units: 4 },
    { type: "3-Bed Detached", units: 6 },
    { type: "3-Bed Semi", units: 8 },
  ],
  "Planning-Friendly Mix": [
    { type: "2-Bed Semi", units: 6 },
    { type: "3-Bed Semi", units: 8 },
    { type: "2-Bed Bungalow", units: 4 },
    { type: "Apartment (1-bed)", units: 4 },
  ],
  "Starter Homes Bias": [
    { type: "2-Bed Semi", units: 12 },
    { type: "3-Bed Semi", units: 8 },
    { type: "Apartment (2-bed)", units: 6 },
  ],
  "Bungalow Bias": [
    { type: "2-Bed Bungalow", units: 8 },
    { type: "3-Bed Bungalow", units: 6 },
    { type: "3-Bed Semi", units: 4 },
  ],
};
