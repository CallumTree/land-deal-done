import { PropertyRow, GlobalInputs, CalculatedValues } from "@/types/calculator";

export const formatCurrency = (value: number): string => {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const calculateRowValues = (row: PropertyRow) => {
  const buildPerUnit = row.giaPerUnit * row.buildPerSqm;
  const buildTotal = row.units * buildPerUnit;
  const gdvPerUnit = row.unitPriceOverride > 0 
    ? row.unitPriceOverride 
    : row.salesValue;
  const gdvTotal = row.units * gdvPerUnit;

  return {
    buildPerUnit,
    buildTotal,
    gdvPerUnit,
    gdvTotal,
  };
};

export const calculateTotals = (
  rows: PropertyRow[],
  inputs: GlobalInputs
): CalculatedValues => {
  const totalGDV = rows.reduce((sum, row) => {
    const { gdvTotal } = calculateRowValues(row);
    return sum + gdvTotal;
  }, 0);

  const buildCost = rows.reduce((sum, row) => {
    const { buildTotal } = calculateRowValues(row);
    return sum + buildTotal;
  }, 0);

  const professionalFees = buildCost * (inputs.professionalFeesPercent / 100);
  const marketingSales = totalGDV * (inputs.marketingSalesPercent / 100);
  const contingency = buildCost * (inputs.contingencyPercent / 100);
  
  // Finance on half the total (staged drawdown)
  const financeBase = (buildCost + professionalFees + marketingSales + contingency) * 0.5;
  const finance = financeBase * (inputs.financePercent / 100);

  const totalCosts = buildCost + professionalFees + marketingSales + contingency + finance + inputs.s106CIL + inputs.landCost;
  const netProfit = totalGDV - totalCosts;
  const profitMarginPercent = totalGDV > 0 ? (netProfit / totalGDV) * 100 : 0;

  // RLV at target margin
  const residualLandValue = totalGDV * (1 - inputs.targetMarginPercent / 100) - 
    (buildCost + professionalFees + marketingSales + contingency + finance + inputs.s106CIL);
  
  const variance = residualLandValue - inputs.landCost;

  return {
    totalGDV,
    buildCost,
    professionalFees,
    marketingSales,
    contingency,
    finance,
    other: inputs.s106CIL,
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
