import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPercent } from "@/utils/calculatorHelpers";
import { PropertyRow, GlobalInputs } from "@/types/calculator";
import { calculateTotals } from "@/utils/calculatorHelpers";

interface SensitivityMatrixProps {
  rows: PropertyRow[];
  inputs: GlobalInputs;
  onIncludeInPack: (include: boolean) => void;
}

export function SensitivityMatrix({ rows, inputs, onIncludeInPack }: SensitivityMatrixProps) {
  const [bandSize, setBandSize] = useState("5");

  const bands = {
    "2.5": [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10],
    "5": [-10, -5, 0, 5, 10],
    "7.5": [-15, -7.5, 0, 7.5, 15],
    "10": [-10, 0, 10],
    "15": [-15, 0, 15],
  };

  const salesBands = bands[bandSize as keyof typeof bands];
  const buildBands = [...bands[bandSize as keyof typeof bands]].reverse();

  const calculateProfitMargin = (salesChange: number, buildChange: number) => {
    const result = calculateTotals(rows, inputs, {
      salesValuePercent: salesChange,
      buildCostPercent: buildChange,
      financeRatePercent: 0,
      contingencyPercent: 0,
      programmeDelayMonths: 0,
    });
    return result.profitMarginPercent;
  };

  const getColorForMargin = (margin: number) => {
    if (margin >= 25) return "bg-success/20 text-success";
    if (margin >= 20) return "bg-success/10 text-success";
    if (margin >= 15) return "bg-warning/20 text-warning";
    if (margin >= 10) return "bg-warning/10 text-warning";
    return "bg-destructive/20 text-destructive";
  };

  const allMargins = buildBands.flatMap((build) =>
    salesBands.map((sales) => calculateProfitMargin(sales, build))
  );
  const worstMargin = Math.min(...allMargins);
  const bestMargin = Math.max(...allMargins);
  const medianMargin = allMargins.sort((a, b) => a - b)[Math.floor(allMargins.length / 2)];

  const generateSummary = () => {
    let salesThreshold = 0;
    let buildThreshold = 0;

    for (let sales of salesBands) {
      for (let build of buildBands) {
        const margin = calculateProfitMargin(sales, build);
        if (margin < 20) {
          salesThreshold = sales;
          buildThreshold = build;
          break;
        }
      }
    }

    if (worstMargin >= 20) {
      return "Profit remains ≥20% across all tested scenarios.";
    }

    return `Profit remains ≥20% unless sales fall below ${salesThreshold}% or build rises above ${buildThreshold}%.`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Sensitivity Matrix</h3>
          <p className="text-sm text-muted-foreground">Quick stress test: Sales vs Build variations</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={bandSize} onValueChange={setBandSize}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2.5">±2.5%</SelectItem>
              <SelectItem value="5">±5%</SelectItem>
              <SelectItem value="7.5">±7.5%</SelectItem>
              <SelectItem value="10">±10%</SelectItem>
              <SelectItem value="15">±15%</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox id="include-sensitivity" onCheckedChange={onIncludeInPack} />
            <Label htmlFor="include-sensitivity" className="text-sm cursor-pointer">
              Add to Pack
            </Label>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-center gap-8 text-sm">
        <div>
          Worst: <span className="font-semibold text-destructive">{formatPercent(worstMargin)}</span>
        </div>
        <div>
          Median: <span className="font-semibold">{formatPercent(medianMargin)}</span>
        </div>
        <div>
          Best: <span className="font-semibold text-success">{formatPercent(bestMargin)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 text-xs bg-muted">Sales ↓ / Build →</th>
              {salesBands.map((band) => (
                <th key={band} className="border p-2 text-xs bg-muted">
                  {band > 0 ? "+" : ""}
                  {band}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buildBands.map((buildBand) => (
              <tr key={buildBand}>
                <td className="border p-2 text-xs font-medium bg-muted">
                  {buildBand > 0 ? "+" : ""}
                  {buildBand}%
                </td>
                {salesBands.map((salesBand) => {
                  const margin = calculateProfitMargin(salesBand, buildBand);
                  return (
                    <td
                      key={`${salesBand}-${buildBand}`}
                      className={`border p-2 text-center text-xs font-medium ${getColorForMargin(margin)}`}
                    >
                      {formatPercent(margin)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
        <p className="text-muted-foreground">{generateSummary()}</p>
      </div>
    </Card>
  );
}
