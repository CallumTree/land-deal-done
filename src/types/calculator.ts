export interface PropertyRow {
  id: string;
  type: string;
  units: number;
  giaPerUnit: number;
  salesPerSqm: number;
  unitPriceOverride: number;
  buildPerSqm: number;
  notes: string;
}

export interface GlobalInputs {
  professionalFeesPercent: number;
  marketingSalesPercent: number;
  contingencyPercent: number;
  financePercent: number;
  s106CIL: number;
  landCost: number;
  targetMarginPercent: number;
  vatEnabled: boolean;
}

export interface CalculatedValues {
  totalGDV: number;
  buildCost: number;
  professionalFees: number;
  marketingSales: number;
  contingency: number;
  finance: number;
  other: number;
  landCost: number;
  totalCosts: number;
  netProfit: number;
  profitMarginPercent: number;
  residualLandValue: number;
  variance: number;
}

export const PROPERTY_DEFAULTS: Record<string, Partial<PropertyRow>> = {
  "2-Bed Semi": { giaPerUnit: 75, salesPerSqm: 3300, buildPerSqm: 1650 },
  "3-Bed Semi": { giaPerUnit: 90, salesPerSqm: 3250, buildPerSqm: 1650 },
  "3-Bed Detached": { giaPerUnit: 92.5, salesPerSqm: 3400, buildPerSqm: 1700 },
  "4-Bed Detached": { giaPerUnit: 120, salesPerSqm: 3600, buildPerSqm: 1800 },
  "2-Bed Bungalow": { giaPerUnit: 84.5, salesPerSqm: 3350, buildPerSqm: 1800 },
  "3-Bed Bungalow": { giaPerUnit: 109, salesPerSqm: 3400, buildPerSqm: 1900 },
  "Apartment (1-bed)": { giaPerUnit: 52, salesPerSqm: 4000, buildPerSqm: 2000 },
  "Apartment (2-bed)": { giaPerUnit: 70, salesPerSqm: 3800, buildPerSqm: 2000 },
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
