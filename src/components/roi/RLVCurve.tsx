import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { formatCurrency } from "@/utils/calculatorHelpers";
import { PropertyRow, GlobalInputs } from "@/types/calculator";
import { calculateTotals } from "@/utils/calculatorHelpers";

interface RLVCurveProps {
  rows: PropertyRow[];
  inputs: GlobalInputs;
  currentLandPrice: number;
  onIncludeInPack: (include: boolean) => void;
}

export function RLVCurve({ rows, inputs, currentLandPrice, onIncludeInPack }: RLVCurveProps) {
  const salesChanges = [-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10];

  const data = salesChanges.map((salesChange) => {
    const result = calculateTotals(rows, inputs, {
      salesValuePercent: salesChange,
      buildCostPercent: 0,
      financeRatePercent: 0,
      contingencyPercent: 0,
      programmeDelayMonths: 0,
    });

    return {
      salesChange,
      rlv: result.residualLandValue,
    };
  });

  // Find RLV at -5% sales
  const rlvAtMinus5 = data.find((d) => d.salesChange === -5)?.rlv || 0;
  const varianceAtMinus5 = rlvAtMinus5 - currentLandPrice;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const variance = payload[0].payload.rlv - currentLandPrice;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">
            Sales Change: {payload[0].payload.salesChange > 0 ? "+" : ""}
            {payload[0].payload.salesChange}%
          </p>
          <p className="text-sm">
            RLV: <span className="font-semibold">{formatCurrency(payload[0].payload.rlv)}</span>
          </p>
          <p className="text-sm">
            vs Land Price:{" "}
            <span className={`font-semibold ${variance >= 0 ? "text-success" : "text-destructive"}`}>
              {variance >= 0 ? "+" : ""}
              {formatCurrency(variance)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Residual Land Value vs Sales</h3>
          <p className="text-sm text-muted-foreground">RLV sensitivity to sales value changes</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="include-rlv" onCheckedChange={onIncludeInPack} />
          <Label htmlFor="include-rlv" className="text-sm cursor-pointer">
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
          <YAxis tickFormatter={(value) => formatCurrency(value)} fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine
            y={currentLandPrice}
            stroke="hsl(var(--destructive))"
            strokeDasharray="3 3"
            label={{ value: "Current Land Price", position: "right" }}
          />
          <Line
            type="monotone"
            dataKey="rlv"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Residual Land Value"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
        <p className="text-muted-foreground">
          At −5% sales, RLV = {formatCurrency(rlvAtMinus5)} (
          <span className={varianceAtMinus5 >= 0 ? "text-success" : "text-destructive"}>
            Δ {formatCurrency(varianceAtMinus5)}
          </span>{" "}
          vs asking)
        </p>
      </div>
    </Card>
  );
}
