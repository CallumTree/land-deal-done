import { PropertyRow, GlobalInputs } from "@/types/calculator";

/**
 * Migrate old PropertyRow format to new format (populating both legacy and new fields)
 */
export const migratePropertyRow = (oldRow: any): PropertyRow => {
  const gia = oldRow.gia_m2_per_unit || oldRow.giaPerUnit || 0;
  const saleValue = oldRow.sale_value_per_unit || oldRow.salesValue || oldRow.unitPriceOverride || 0;
  const salePpm2 = oldRow.sale_ppm2 || oldRow.salesPerSqm || (gia > 0 ? saleValue / gia : 0);
  const buildPpm2 = oldRow.build_ppm2 || oldRow.buildPerSqm || 0;
  
  return {
    id: oldRow.id || `migrated-${Date.now()}`,
    type: oldRow.type || "Custom",
    units: oldRow.units || 0,
    // Legacy fields
    giaPerUnit: gia,
    salesValue: saleValue,
    unitPriceOverride: oldRow.unitPriceOverride || 0,
    buildPerSqm: buildPpm2,
    // New fields
    gia_m2_per_unit: gia,
    sale_value_per_unit: saleValue,
    sale_ppm2: salePpm2,
    build_ppm2: buildPpm2,
    notes: oldRow.notes || "",
    priceSource: oldRow.priceSource || undefined,
  };
};

/**
 * Migrate old GlobalInputs format to new format (populating both legacy and new fields)
 */
export const migrateGlobalInputs = (oldInputs: any): GlobalInputs => {
  return {
    // Legacy fields (required)
    professionalFeesPercent: oldInputs.professionalFeesPercent || 10,
    marketingSalesPercent: oldInputs.marketingSalesPercent || 2.5,
    contingencyPercent: oldInputs.contingencyPercent || 7.5,
    financePercent: oldInputs.financeInterestApr || oldInputs.financePercent || 8,
    s106CIL: oldInputs.s106CIL || 0,
    landCost: oldInputs.landCost || 0,
    targetMarginPercent: oldInputs.targetMarginPercent || 20,
    vatEnabled: oldInputs.vatEnabled || false,
    siteArea: oldInputs.siteArea || 0,
    demolitionClearance: oldInputs.demolitionClearance || 0,
    ecologyEnvironmental: oldInputs.ecologyEnvironmental || 0,
    groundInvestigation: oldInputs.groundInvestigation || 0,
    planningStatutoryFees: oldInputs.planningApplicationFees || oldInputs.planningStatutoryFees || 0,
    serviceConnections: oldInputs.serviceConnections || 0,
    abnormals: oldInputs.abnormals || 0,
    siteSecurity: oldInputs.siteSecurity || 0,
    miscellaneousAllowance: oldInputs.miscellaneousAllowance || 0,
    abnormalsPercentEnabled: oldInputs.abnormalsPercentEnabled || false,
    abnormalsPercent: oldInputs.abnormalsPercent || 5,
    siteNotes: oldInputs.siteNotes || "",
    
    // New fields (optional)
    buildBaselineType: oldInputs.buildBaselineType || "manual",
    externalsPercent: oldInputs.externalsPercent || 0,
    prelimsPercent: oldInputs.prelimsPercent || 12,
    financeInterestApr: oldInputs.financeInterestApr || oldInputs.financePercent || 8,
    financeArrangementFee: oldInputs.financeArrangementFee || 0,
    financeExitFee: oldInputs.financeExitFee || 0,
    programmeDurationMonths: oldInputs.programmeDurationMonths || 18,
    s278s38Works: oldInputs.s278s38Works || 0,
    planningApplicationFees: oldInputs.planningApplicationFees || oldInputs.planningStatutoryFees || 0,
    buildingControlFees: oldInputs.buildingControlFees || 0,
    stampDutyLandTax: oldInputs.stampDutyLandTax || 0,
    legalFeesLand: oldInputs.legalFeesLand || 0,
    developerEquityCash: oldInputs.developerEquityCash || 0,
  };
};

/**
 * Load and migrate saved calculator data from localStorage
 */
export const loadMigratedData = (storageKey: string): { rows: PropertyRow[]; inputs: GlobalInputs } | null => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;
    
    const data = JSON.parse(saved);
    
    const migratedRows = (data.rows || []).map(migratePropertyRow);
    const migratedInputs = migrateGlobalInputs(data.inputs || {});
    
    return {
      rows: migratedRows,
      inputs: migratedInputs,
    };
  } catch (error) {
    console.error("Failed to load and migrate data:", error);
    return null;
  }
};
