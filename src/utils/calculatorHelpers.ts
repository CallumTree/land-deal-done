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
  const buildPerUnit = (row.giaPerUnit || 0) * (row.buildPerSqm || 0);
  const buildTotal = (row.units || 0) * buildPerUnit;
  const gdvPerUnit = row.unitPriceOverride > 0 
    ? row.unitPriceOverride 
    : (row.salesValue || 0);
  const gdvTotal = (row.units || 0) * gdvPerUnit;

  return {
    buildPerUnit: isNaN(buildPerUnit) ? 0 : buildPerUnit,
    buildTotal: isNaN(buildTotal) ? 0 : buildTotal,
    gdvPerUnit: isNaN(gdvPerUnit) ? 0 : gdvPerUnit,
    gdvTotal: isNaN(gdvTotal) ? 0 : gdvTotal,
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

  // Apply sensitivity adjustments to calculations
  const totalGDV = rows.reduce((sum, row) => {
    const { gdvTotal } = calculateRowValues(row);
    return sum + gdvTotal;
  }, 0) * (1 + sensitivity.salesValuePercent / 100);

  const buildCost = rows.reduce((sum, row) => {
    const { buildTotal } = calculateRowValues(row);
    return sum + buildTotal;
  }, 0) * (1 + sensitivity.buildCostPercent / 100);

  const professionalFees = buildCost * (inputs.professionalFeesPercent / 100);
  const marketingSales = totalGDV * (inputs.marketingSalesPercent / 100);
  
  // Apply contingency adjustment
  const contingencyRate = inputs.contingencyPercent + sensitivity.contingencyPercent;
  const contingency = buildCost * (contingencyRate / 100);
  
  // Calculate site prep & technical costs
  let abnormals = inputs.abnormals || 0;
  if (inputs.abnormalsPercentEnabled && abnormals === 0) {
    abnormals = buildCost * (inputs.abnormalsPercent / 100);
  }
  
  const sitePrepTechnical = 
    (inputs.demolitionClearance || 0) +
    (inputs.ecologyEnvironmental || 0) +
    (inputs.groundInvestigation || 0) +
    (inputs.planningStatutoryFees || 0) +
    (inputs.serviceConnections || 0) +
    abnormals +
    (inputs.siteSecurity || 0) +
    (inputs.miscellaneousAllowance || 0);
  
  // Apply finance rate adjustment and programme delay
  const financeBase = (buildCost + professionalFees + marketingSales + contingency + sitePrepTechnical) * 0.5;
  const adjustedFinanceRate = inputs.financePercent + sensitivity.financeRatePercent;
  const delayMultiplier = 1 + (sensitivity.programmeDelayMonths / 12); // Convert months to years
  const finance = financeBase * (adjustedFinanceRate / 100) * delayMultiplier;

  const totalCosts = buildCost + professionalFees + marketingSales + contingency + finance + sitePrepTechnical + inputs.s106CIL + inputs.landCost;
  const netProfit = totalGDV - totalCosts;
  const profitMarginPercent = totalGDV > 0 ? (netProfit / totalGDV) * 100 : 0;

  // RLV at target margin
  const residualLandValue = totalGDV * (1 - inputs.targetMarginPercent / 100) - 
    (buildCost + professionalFees + marketingSales + contingency + finance + sitePrepTechnical + inputs.s106CIL);
  
  const variance = residualLandValue - inputs.landCost;

  return {
    totalGDV,
    buildCost,
    professionalFees,
    marketingSales,
    contingency,
    finance,
    other: inputs.s106CIL,
    sitePrepTechnical,
    landCost: inputs.landCost,
    totalCosts,
    netProfit,
    profitMarginPercent,
    residualLandValue,
    variance,
  };
};

export const exportToCSV = (rows: PropertyRow[], filename: string = "napkin-gdv.csv") => {
  const headers = [
    "Type",
    "Units",
    "GIA / Unit (m²)",
    "Sales Value (£)",
    "Unit Price Override (£)",
    "Build £/m²",
    "Notes",
  ];

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      [
        row.type,
        row.units,
        row.giaPerUnit,
        row.salesValue,
        row.unitPriceOverride,
        row.buildPerSqm,
        `"${row.notes.replace(/"/g, '""')}"`,
      ].join(",")
    ),
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
          
          return {
            id: `imported-${Date.now()}-${index}`,
            type: cleanValues[0] || "Custom",
            units: parseInt(cleanValues[1]) || 0,
            giaPerUnit: parseFloat(cleanValues[2]) || 0,
            salesValue: parseFloat(cleanValues[3]) || 0,
            unitPriceOverride: parseFloat(cleanValues[4]) || 0,
            buildPerSqm: parseFloat(cleanValues[5]) || 0,
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
