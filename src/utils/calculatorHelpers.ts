import { PropertyRow, GlobalInputs, CalculatedValues } from "@/types/calculator";

export const formatCurrency = (value: number): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return '£0';
  }
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const calculateRowValues = (row: PropertyRow) => {
  // Either sale_value_per_unit or sale_ppm2 drives the calculation
  const saleValuePerUnit = row.sale_value_per_unit ?? 
    ((row.sale_ppm2 || 0) * (row.gia_m2_per_unit || 0));
  const salePpm2 = row.sale_ppm2 ?? 
    ((row.gia_m2_per_unit || 0) > 0 ? (row.sale_value_per_unit || 0) / (row.gia_m2_per_unit || 0) : 0);
  
  const buildPerUnit = (row.gia_m2_per_unit || 0) * (row.build_ppm2 || 0);
  const buildTotal = (row.units || 0) * buildPerUnit;
  const gdvTotal = (row.units || 0) * saleValuePerUnit;
  const marginPct = gdvTotal > 0 ? ((gdvTotal - buildTotal) / gdvTotal) * 100 : 0;

  return {
    saleValuePerUnit: isNaN(saleValuePerUnit) ? 0 : saleValuePerUnit,
    salePpm2: isNaN(salePpm2) ? 0 : salePpm2,
    buildPerUnit: isNaN(buildPerUnit) ? 0 : buildPerUnit,
    buildTotal: isNaN(buildTotal) ? 0 : buildTotal,
    gdvTotal: isNaN(gdvTotal) ? 0 : gdvTotal,
    marginPct: isNaN(marginPct) ? 0 : marginPct,
  };
};

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

  // Total GDV = Σ row_gdv
  const totalGDV = rows.reduce((sum, row) => {
    const { gdvTotal } = calculateRowValues(row);
    return sum + gdvTotal;
  }, 0) * (1 + sensitivity.salesValuePercent / 100);

  // Base build cost = Σ row_build
  const baseBuildCost = rows.reduce((sum, row) => {
    const { buildTotal } = calculateRowValues(row);
    return sum + buildTotal;
  }, 0) * (1 + sensitivity.buildCostPercent / 100);

  // Externals (applies to base_build_cost)
  const externals = baseBuildCost * ((inputs.externalsPercent || 0) / 100);
  
  // Prelims (applies to base_build_cost)
  const prelims = baseBuildCost * ((inputs.prelimsPercent || 0) / 100);
  
  // Professional fees (applies to base_build_cost)
  const professionalFees = baseBuildCost * ((inputs.professionalFeesPercent || 0) / 100);
  
  // Contingency (applies to base_build_cost + prelims + externals + prof_fees)
  const contingencyBase = baseBuildCost + prelims + externals + professionalFees;
  const contingencyRate = (inputs.contingencyPercent || 0) + sensitivity.contingencyPercent;
  const contingency = contingencyBase * (contingencyRate / 100);
  
  // Marketing & Sales (applies to total_gdv)
  const marketingSales = totalGDV * ((inputs.marketingSalesPercent || 0) / 100);
  
  // Site prep & technical (£ fixed values)
  const sitePrepTechnical = 
    (inputs.demolitionClearance || 0) +
    (inputs.ecologyEnvironmental || 0) +
    (inputs.groundInvestigation || 0) +
    (inputs.serviceConnections || 0) +
    (inputs.s278S38Works || 0) +
    (inputs.abnormals || 0) +
    (inputs.siteSecurity || 0) +
    (inputs.miscellaneousAllowance || 0);
  
  // Other planning (£ fixed values)
  const otherPlanning = 
    (inputs.s106CIL || 0) +
    (inputs.buildingControlFees || 0) +
    (inputs.planningStatutoryFees || 0);
  
  // Finance interest (staged cashflow approximation)
  const totalSpend = baseBuildCost + externals + prelims + professionalFees + contingency + 
    marketingSales + sitePrepTechnical + otherPlanning;
  const avgDrawdown = totalSpend * 0.5; // Assume 50% average exposure
  const adjustedApr = (inputs.financeInterestApr || 0) + sensitivity.financeRatePercent;
  const programmeMonths = (inputs.financeProgrammeMonths || 18) + sensitivity.programmeDelayMonths;
  const financeInterest = avgDrawdown * (adjustedApr / 100) * (programmeMonths / 12);
  
  // Finance fees (fixed £)
  const financeFeesFixed = (inputs.financeArrangementFee || 0) + (inputs.financeExitFee || 0);
  
  // Land cost
  const landCost = inputs.landCost || 0;
  
  // Total costs
  const totalCosts = baseBuildCost + externals + prelims + professionalFees + contingency + 
    marketingSales + financeInterest + financeFeesFixed + sitePrepTechnical + otherPlanning + landCost;
  
  // Net profit
  const netProfit = totalGDV - totalCosts;
  
  // Profit margin % = net_profit / total_gdv
  const profitMarginPercent = totalGDV > 0 ? (netProfit / totalGDV) * 100 : 0;
  
  // Cost-to-GDV %
  const costToGDVPercent = totalGDV > 0 ? (totalCosts / totalGDV) * 100 : 0;
  
  // RLV at target margin
  const targetProfit = totalGDV * ((inputs.targetMarginPercent || 0) / 100);
  const costsExLand = totalCosts - landCost;
  const residualLandValue = totalGDV - targetProfit - costsExLand;
  
  // Variance
  const variance = residualLandValue - landCost;
  
  // ROCE (net_profit / land_cost; can add developer equity if available)
  const roce = landCost > 0 ? (netProfit / landCost) * 100 : 0;

  return {
    totalGDV,
    baseBuildCost,
    externals,
    prelims,
    professionalFees,
    contingency,
    marketingSales,
    financeInterest,
    financeFeesFixed,
    sitePrepTechnical,
    otherPlanning,
    landCost,
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
      const { saleValuePerUnit, salePpm2 } = calculateRowValues(row);
      return [
        row.type,
        row.units,
        row.gia_m2_per_unit,
        saleValuePerUnit,
        salePpm2,
        row.build_ppm2,
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
        
        const rows: PropertyRow[] = lines.slice(1).map((line, index) => {
          const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
          const cleanValues = values.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
          
          return {
            id: `imported-${Date.now()}-${index}`,
            type: cleanValues[0] || "Custom",
            units: parseInt(cleanValues[1]) || 0,
            gia_m2_per_unit: parseFloat(cleanValues[2]) || 0,
            sale_value_per_unit: parseFloat(cleanValues[3]) || undefined,
            sale_ppm2: parseFloat(cleanValues[4]) || undefined,
            build_ppm2: parseFloat(cleanValues[5]) || 0,
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
