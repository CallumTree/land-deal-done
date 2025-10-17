import { useState } from "react";
import { PropertyRow, GlobalInputs, CalculatedValues } from "@/types/calculator";
import { KPICards } from "./KPICards";
import { ProfitWaterfall } from "./ProfitWaterfall";
import { CostToGDVGauge } from "./CostToGDVGauge";
import { SensitivityMatrix } from "./SensitivityMatrix";
import { ROCELine } from "./ROCELine";
import { RLVCurve } from "./RLVCurve";

interface ROIVisualiserProps {
  rows: PropertyRow[];
  inputs: GlobalInputs;
  values: CalculatedValues;
}

export function ROIVisualiser({ rows, inputs, values }: ROIVisualiserProps) {
  const [includeInPack, setIncludeInPack] = useState({
    waterfall: false,
    gauge: false,
    sensitivity: false,
    roce: false,
    rlv: false,
  });

  // Calculate KPIs
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
  const totalGIA = rows.reduce((sum, row) => sum + row.units * row.giaPerUnit, 0);
  
  const roi = values.totalCosts > 0 ? (values.netProfit / values.totalCosts) * 100 : 0;
  const cashIn = values.totalCosts - values.landCost;
  const roce = values.landCost + cashIn > 0 ? (values.netProfit / (values.landCost + cashIn)) * 100 : 0;
  const costToGDV = values.totalGDV > 0 ? (values.totalCosts / values.totalGDV) * 100 : 0;
  const gdvPerSqm = totalGIA > 0 ? values.totalGDV / totalGIA : 0;
  const gdvPerUnit = totalUnits > 0 ? values.totalGDV / totalUnits : 0;
  const buildPerUnit = totalUnits > 0 ? values.buildCost / totalUnits : 0;

  const handleIncludeInPack = (chart: keyof typeof includeInPack) => (include: boolean) => {
    setIncludeInPack((prev) => ({ ...prev, [chart]: include }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">ROI Visualiser</h2>
        <p className="text-muted-foreground">
          Decision-grade visuals and stress tests auto-updated from your current scenario
        </p>
      </div>

      <KPICards
        roi={roi}
        roce={roce}
        costToGDV={costToGDV}
        gdvPerSqm={gdvPerSqm}
        gdvPerUnit={gdvPerUnit}
        buildPerUnit={buildPerUnit}
      />

      <div className="grid gap-6">
        <ProfitWaterfall values={values} onIncludeInPack={handleIncludeInPack("waterfall")} />

        <div className="grid md:grid-cols-2 gap-6">
          <CostToGDVGauge
            costToGDV={costToGDV}
            profitMargin={values.profitMarginPercent}
            targetMargin={inputs.targetMarginPercent}
            onIncludeInPack={handleIncludeInPack("gauge")}
          />
          <RLVCurve
            rows={rows}
            inputs={inputs}
            currentLandPrice={inputs.landCost}
            onIncludeInPack={handleIncludeInPack("rlv")}
          />
        </div>

        <SensitivityMatrix
          rows={rows}
          inputs={inputs}
          onIncludeInPack={handleIncludeInPack("sensitivity")}
        />

        <ROCELine rows={rows} inputs={inputs} onIncludeInPack={handleIncludeInPack("roce")} />
      </div>
    </div>
  );
}
