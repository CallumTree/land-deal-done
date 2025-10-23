export interface PropertyRow {
  id: string;
  type: string;
  units: number;
  gia_m2_per_unit: number;
  sale_value_per_unit?: number;
  sale_ppm2?: number;
  build_ppm2: number;
  notes: string;
  // Source tracking for Market Calibration
  priceSource?: {
    region: string;
    spec: "low" | "medium" | "high";
    localityMultiplier: number;
    appliedAt: string;
  };
}

export interface GlobalInputs {
  // Build cost add-ons
  externalsPercent: number;
  prelimsPercent: number;
  professionalFeesPercent: number;
  contingencyPercent: number;
  
  // Marketing & Sales
  marketingSalesPercent: number;
  
  // Finance
  financeInterestApr: number;
  financeProgrammeMonths: number;
  financeArrangementFee: number;
  financeExitFee: number;
  
  // Site prep & technical (£ values)
  demolitionClearance: number;
  ecologyEnvironmental: number;
  groundInvestigation: number;
  serviceConnections: number;
  s278S38Works: number;
  abnormals: number;
  siteSecurity: number;
  miscellaneousAllowance: number;
  
  // Planning costs (£ values)
  s106CIL: number;
  buildingControlFees: number;
  planningStatutoryFees: number;
  
  // Land & Target
  landCost: number;
  targetMarginPercent: number;
  
  // Other
  vatEnabled: boolean;
  siteArea: number;
  siteNotes: string;
  
  // Legacy support
  abnormalsPercentEnabled?: boolean;
  abnormalsPercent?: number;
}

export interface CalculatedValues {
  totalGDV: number;
  baseBuildCost: number;
  externals: number;
  prelims: number;
  professionalFees: number;
  contingency: number;
  marketingSales: number;
  financeInterest: number;
  financeFeesFixed: number;
  sitePrepTechnical: number;
  otherPlanning: number;
  landCost: number;
  totalCosts: number;
  netProfit: number;
  profitMarginPercent: number;
  costToGDVPercent: number;
  residualLandValue: number;
  variance: number;
  roce: number;
}

export const PROPERTY_DEFAULTS: Record<string, Partial<PropertyRow>> = {
  "2-Bed Semi": { gia_m2_per_unit: 75, sale_ppm2: 3300, build_ppm2: 1650 },
  "3-Bed Semi": { gia_m2_per_unit: 90, sale_ppm2: 3250, build_ppm2: 1650 },
  "3-Bed Detached": { gia_m2_per_unit: 92.5, sale_ppm2: 3400, build_ppm2: 1700 },
  "4-Bed Detached": { gia_m2_per_unit: 120, sale_ppm2: 3600, build_ppm2: 1800 },
  "2-Bed Bungalow": { gia_m2_per_unit: 84.5, sale_ppm2: 3350, build_ppm2: 1900 },
  "3-Bed Bungalow": { gia_m2_per_unit: 109, sale_ppm2: 3400, build_ppm2: 2000 },
  "Apartment (1-bed)": { gia_m2_per_unit: 52, sale_ppm2: 4000, build_ppm2: 2100 },
  "Apartment (2-bed)": { gia_m2_per_unit: 70, sale_ppm2: 3800, build_ppm2: 2100 },
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
