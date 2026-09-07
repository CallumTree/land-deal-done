import { PropertyRow, GlobalInputs, CalculatedValues } from "@/types/calculator";

export const formatCurrency = (value: number): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return '£0';
  }
  return `£${Math.round(value).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Calculate row-level values: override if >0, else salesValue
 */
export const calculateRowValues = (row: PropertyRow) => {
  const gia = row.gia_m2_per_unit || row.giaPerUnit || 0;
  const buildPpm2 = row.build_ppm2 || row.buildPerSqm || 0;
  const units = row.units || 0;
  
  // Override if >0, else salesValue (£/unit)
  const saleValuePerUnit = (row.unitPriceOverride && row.unitPriceOverride > 0)
    ? row.unitPriceOverride
    : (row.salesValue || 0);
  const salePpm2 = gia > 0 ? saleValuePerUnit / gia : 0;
  
  const buildPerUnit = buildPpm2 * gia;
  const buildTotal = buildPerUnit * units;
  const gdvTotal = saleValuePerUnit * units;
  const marginPct = gdvTotal > 0 ? ((gdvTotal - buildTotal) / gdvTotal) * 100 : 0;

  return {
    buildPerUnit: isNaN(buildPerUnit) ? 0 : buildPerUnit,
    buildTotal: isNaN(buildTotal) ? 0 : buildTotal,
    gdvPerUnit: isNaN(saleValuePerUnit) ? 0 : saleValuePerUnit,
    gdvTotal: isNaN(gdvTotal) ? 0 : gdvTotal,
    saleValuePerUnit,
    salePpm2,
    marginPct,
  };
};

/**
 * Calculate totals with new spec math while maintaining backward compatibility
 */
export const calculateTotals = (
  rows: PropertyRow[],
  inputs: GlobalInputs,
  sensitivityAdjustments?: {
    salesValuePercent: number;
    buildCostPercent: number;
    financeRatePercent: number;
    contingencyPercent: number;
    programmeDelayMonths: number;
  }
): CalculatedValues => {
  const sensitivity = sensitivityAdjustments || {
    salesValuePercent: 0,
    buildCostPercent: 0,
    financeRatePercent: 0,
    contingencyPercent: 0,
    programmeDelayMonths: 0,
  };

  // 1. Total GDV
  const totalGDV = rows.reduce((sum, row) => {
    const { gdvTotal } = calculateRowValues(row);
    return sum + gdvTotal;
  }, 0) * (1 + sensitivity.salesValuePercent / 100);

  // 2. Base build cost
  const baseBuildCost = rows.reduce((sum, row) => {
    const { buildTotal } = calculateRowValues(row);
    return sum + buildTotal;
  }, 0) * (1 + sensitivity.buildCostPercent / 100);

  // 3. Externals (percentage of base build, if specified)
  const externals = baseBuildCost * ((inputs.externalsPercent || 0) / 100);

  // 4. Prelims (percentage of base build, default 12%)
  const prelims = baseBuildCost * ((inputs.prelimsPercent || 12) / 100);

  // 5. Professional fees (percentage of base build)
  const professionalFees = baseBuildCost * (inputs.professionalFeesPercent / 100);

  // 6. Contingency (percentage of base + prelims + externals + prof fees)
  const subtotalForContingency = baseBuildCost + prelims + externals + professionalFees;
  const adjustedContingencyRate = inputs.contingencyPercent + sensitivity.contingencyPercent;
  const contingency = subtotalForContingency * (adjustedContingencyRate / 100);

  // 7. Marketing (percentage of GDV)
  const marketingSales = totalGDV * (inputs.marketingSalesPercent / 100);

  // 8. Site prep & technical (fixed £ amounts)
  let abnormals = inputs.abnormals || 0;
  if (inputs.abnormalsPercentEnabled && abnormals === 0) {
    abnormals = baseBuildCost * (inputs.abnormalsPercent / 100);
  }
  
  const sitePrepTechnical = 
    (inputs.demolitionClearance || 0) +
    (inputs.ecologyEnvironmental || 0) +
    (inputs.groundInvestigation || 0) +
    (inputs.serviceConnections || 0) +
    (inputs.s278s38Works || 0) +
    (inputs.planningStatutoryFees || inputs.planningApplicationFees || 0) +
    abnormals +
    (inputs.siteSecurity || 0) +
    (inputs.miscellaneousAllowance || 0);

  // 9. Other planning (S106/CIL + BC fees if specified separately)
  const otherPlanning = 
    (inputs.s106CIL || 0) +
    (inputs.buildingControlFees || 0);

  // 10. Finance
  // Use new fields if available, fall back to legacy
  const financeApr = inputs.financeInterestApr || inputs.financePercent || 8;
  const programmeMonths = inputs.programmeDurationMonths || 18;
  
  const totalSpend = baseBuildCost + externals + prelims + professionalFees + contingency + 
                     marketingSales + sitePrepTechnical + otherPlanning;
  
  const adjustedApr = financeApr + sensitivity.financeRatePercent;
  const adjustedMonths = programmeMonths + sensitivity.programmeDelayMonths;
  const financeInterest = (totalSpend * 0.5) * (adjustedApr / 100) * (adjustedMonths / 12);
  
  const financeFixedFees = (inputs.financeArrangementFee || 0) + (inputs.financeExitFee || 0);
  const totalFinance = financeInterest + financeFixedFees;

  // 11. Land acquisition costs
  const landAcquisitionCosts = 
    (inputs.stampDutyLandTax || 0) +
    (inputs.legalFeesLand || 0);

  // 12. Total costs
  const totalCosts = 
    baseBuildCost + 
    externals + 
    prelims + 
    professionalFees + 
    contingency + 
    marketingSales + 
    financeInterest + 
    financeFixedFees + 
    sitePrepTechnical + 
    otherPlanning + 
    inputs.landCost +
    landAcquisitionCosts;

  // 13. Profit metrics
  const netProfit = totalGDV - totalCosts;
  const profitMarginPercent = totalGDV > 0 ? (netProfit / totalGDV) * 100 : 0;
  const costToGDVPercent = totalGDV > 0 ? (totalCosts / totalGDV) * 100 : 0;

  // 14. RLV at target margin
  const targetProfit = totalGDV * (inputs.targetMarginPercent / 100);
  const costsExLand = totalCosts - inputs.landCost - landAcquisitionCosts;
  const residualLandValue = totalGDV - targetProfit - costsExLand;
  
  const variance = residualLandValue - inputs.landCost;

  // 15. ROCE (return on capital employed)
  const equity = inputs.landCost + (inputs.developerEquityCash || 0);
  const roce = equity > 0 ? (netProfit / equity) * 100 : 0;

  return {
    totalGDV,
    baseBuildCost,
    externals,
    prelims,
    professionalFees,
    marketingSales,
    contingency,
    financeInterest,
    financeFixedFees,
    sitePrepTechnical,
    otherPlanning,
    landCost: inputs.landCost,
    landAcquisitionCosts,
    totalCosts,
    netProfit,
    profitMarginPercent,
    costToGDVPercent,
    residualLandValue,
    variance,
    roce,
  };
};

export const exportToCSV = (rows: PropertyRow[], filename: string = "napkin-gdv.csv") => {
  const headers = [
    "Type",
    "Units",
    "GIA/Unit (m²)",
    "Sale £/unit",
    "Sale £/m²",
    "Build £/m²",
    "Notes",
  ];

  const csvContent = [
    headers.join(","),
    ...rows.map(row => {
      const gia = row.gia_m2_per_unit || row.giaPerUnit || 0;
      const salePerUnit = (row.unitPriceOverride && row.unitPriceOverride > 0)
        ? row.unitPriceOverride
        : (row.salesValue || 0);
      const salePpm2 = gia > 0 ? salePerUnit / gia : 0;
      const buildPpm2 = row.build_ppm2 || row.buildPerSqm || 0;
      
      return [
        row.type,
        row.units,
        gia.toFixed(1),
        salePerUnit,
        salePpm2.toFixed(0),
        buildPpm2,
        `"${row.notes.replace(/"/g, '""')}"`,
      ].join(",");
    }),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

export const importFromCSV = (file: File): Promise<PropertyRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        const headers = lines[0].split(",");
        
        const rows: PropertyRow[] = lines.slice(1).map((line, index) => {
          const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
          const cleanValues = values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
          
          const gia = parseFloat(cleanValues[2]) || 0;
          const salePerUnit = parseFloat(cleanValues[3]) || 0;
          const salePpm2 = parseFloat(cleanValues[4]) || 0;
          const buildPpm2 = parseFloat(cleanValues[5]) || 0;
          
          return {
            id: `imported-${Date.now()}-${index}`,
            type: cleanValues[0] || "Custom",
            units: parseInt(cleanValues[1]) || 0,
            giaPerUnit: gia,
            salesValue: salePerUnit,
            unitPriceOverride: 0,
            buildPerSqm: buildPpm2,
            gia_m2_per_unit: gia,
            build_ppm2: buildPpm2,
            notes: cleanValues[6] || "",
          };
        });
        
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};
