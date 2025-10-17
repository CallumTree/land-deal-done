import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { formatPercent } from "@/utils/calculatorHelpers";
import { PropertyRow, GlobalInputs } from "@/types/calculator";
import { calculateTotals } from "@/utils/calculatorHelpers";

interface ROCELineProps {
  rows: PropertyRow[];
  inputs: GlobalInputs;
  onIncludeInPack: (include: boolean) => void;
}

export function ROCELine({ rows, inputs, onIncludeInPack }: ROCELineProps) {
  const salesChanges = [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10];

  const data = salesChanges.map((salesChange) => {
    const result = calculateTotals(rows, inputs, {
      salesValuePercent: salesChange,
      buildCostPercent: 0,
      financeRatePercent: 0,
      contingencyPercent: 0,
      programmeDelayMonths: 0,
    });

    const cashIn = result.totalCosts - result.landCost;
    const roce = result.landCost + cashIn > 0 ? (result.netProfit / (result.landCost + cashIn)) * 100 : 0;

    return {
      salesChange,
      roce,
      profitMargin: result.profitMarginPercent,
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">Sales Change: {payload[0].payload.salesChange > 0 ? "+" : ""}{payload[0].payload.salesChange}%</p>
          <p className="text-sm">ROCE: <span className="font-semibold">{formatPercent(payload[0].payload.roce)}</span></p>
          <p className="text-sm">Profit Margin: <span className="font-semibold">{formatPercent(payload[0].payload.profitMargin)}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">ROCE vs Sales Change</h3>
          <p className="text-sm text-muted-foreground">Return on Capital Employed across sales scenarios</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="include-roce" onCheckedChange={onIncludeInPack} />
          <Label htmlFor="include-roce" className="text-sm cursor-pointer">
            Add to Pack
          </Label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis
            dataKey="salesChange"
            tickFormatter={(value) => `${value > 0 ? "+" : ""}${value}%`}
            fontSize={12}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(value) => `${value}%`}
            fontSize={12}
            label={{ value: "ROCE %", angle: -90, position: "insideLeft" }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(value) => `${value}%`}
            fontSize={12}
            label={{ value: "Profit %", angle: 90, position: "insideRight" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="roce"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="ROCE"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="profitMargin"
            stroke="hsl(var(--success))"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Profit Margin"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
