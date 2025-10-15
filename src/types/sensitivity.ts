export interface SensitivityAdjustments {
  salesValuePercent: number;
  buildCostPercent: number;
  financeRatePercent: number;
  contingencyPercent: number;
  programmeDelayMonths: number;
}

export const DEFAULT_SENSITIVITY: SensitivityAdjustments = {
  salesValuePercent: 0,
  buildCostPercent: 0,
  financeRatePercent: 0,
  contingencyPercent: 0,
  programmeDelayMonths: 0,
};

export const SENSITIVITY_PRESETS = {
  "Sales -10%": { salesValuePercent: -10, buildCostPercent: 0, financeRatePercent: 0, contingencyPercent: 0, programmeDelayMonths: 0 },
  "Build +15%": { salesValuePercent: 0, buildCostPercent: 15, financeRatePercent: 0, contingencyPercent: 0, programmeDelayMonths: 0 },
  "Finance +2%": { salesValuePercent: 0, buildCostPercent: 0, financeRatePercent: 2, contingencyPercent: 0, programmeDelayMonths: 0 },
  "Market Stress": { salesValuePercent: -10, buildCostPercent: 15, financeRatePercent: 2, contingencyPercent: 5, programmeDelayMonths: 3 },
};
