import { PropertyRow, GlobalInputs } from "@/types/calculator";

/**
 * Migrates old PropertyRow format to new format
 */
export function migratePropertyRow(oldRow: any): PropertyRow {
  // Handle old field names
  const gia_m2_per_unit = oldRow.gia_m2_per_unit ?? oldRow.giaPerUnit ?? 0;
  const build_ppm2 = oldRow.build_ppm2 ?? oldRow.buildPerSqm ?? 0;
  
  // Handle sale values - migrate from old format
  let sale_value_per_unit: number | undefined;
  let sale_ppm2: number | undefined;
  
  if (oldRow.sale_value_per_unit !== undefined) {
    sale_value_per_unit = oldRow.sale_value_per_unit;
  } else if (oldRow.unitPriceOverride && oldRow.unitPriceOverride > 0) {
    sale_value_per_unit = oldRow.unitPriceOverride;
  } else if (oldRow.salesValue !== undefined) {
    sale_value_per_unit = oldRow.salesValue;
  }
  
  if (oldRow.sale_ppm2 !== undefined) {
    sale_ppm2 = oldRow.sale_ppm2;
  } else if (oldRow.salesPerSqm !== undefined) {
    sale_ppm2 = oldRow.salesPerSqm;
  } else if (sale_value_per_unit && gia_m2_per_unit > 0) {
    sale_ppm2 = sale_value_per_unit / gia_m2_per_unit;
  }

  return {
    id: oldRow.id,
    type: oldRow.type,
    units: oldRow.units ?? 0,
    gia_m2_per_unit,
    sale_value_per_unit,
    sale_ppm2,
    build_ppm2,
    notes: oldRow.notes ?? "",
    priceSource: oldRow.priceSource,
  };
}

/**
 * Migrates old GlobalInputs format to new format
 */
export function migrateGlobalInputs(oldInputs: any): GlobalInputs {
  return {
    // Build cost add-ons
    externalsPercent: oldInputs.externalsPercent ?? 0,
    prelimsPercent: oldInputs.prelimsPercent ?? 0,
    professionalFeesPercent: oldInputs.professionalFeesPercent ?? 10,
    contingencyPercent: oldInputs.contingencyPercent ?? 7.5,
    
    // Marketing & Sales
    marketingSalesPercent: oldInputs.marketingSalesPercent ?? 2.5,
    
    // Finance
    financeInterestApr: oldInputs.financeInterestApr ?? oldInputs.financePercent ?? 8,
    financeProgrammeMonths: oldInputs.financeProgrammeMonths ?? 18,
    financeArrangementFee: oldInputs.financeArrangementFee ?? 0,
    financeExitFee: oldInputs.financeExitFee ?? 0,
    
    // Site prep & technical
    demolitionClearance: oldInputs.demolitionClearance ?? 0,
    ecologyEnvironmental: oldInputs.ecologyEnvironmental ?? 0,
    groundInvestigation: oldInputs.groundInvestigation ?? 0,
    serviceConnections: oldInputs.serviceConnections ?? 0,
    s278S38Works: oldInputs.s278S38Works ?? 0,
    abnormals: oldInputs.abnormals ?? 0,
    siteSecurity: oldInputs.siteSecurity ?? 0,
    miscellaneousAllowance: oldInputs.miscellaneousAllowance ?? 0,
    
    // Planning costs
    s106CIL: oldInputs.s106CIL ?? 0,
    buildingControlFees: oldInputs.buildingControlFees ?? oldInputs.planningStatutoryFees ?? 0,
    planningStatutoryFees: oldInputs.planningStatutoryFees ?? 0,
    
    // Land & Target
    landCost: oldInputs.landCost ?? 0,
    targetMarginPercent: oldInputs.targetMarginPercent ?? 20,
    
    // Other
    vatEnabled: oldInputs.vatEnabled ?? false,
    siteArea: oldInputs.siteArea ?? 0,
    siteNotes: oldInputs.siteNotes ?? "",
    
    // Legacy support
    abnormalsPercentEnabled: oldInputs.abnormalsPercentEnabled,
    abnormalsPercent: oldInputs.abnormalsPercent,
  };
}
