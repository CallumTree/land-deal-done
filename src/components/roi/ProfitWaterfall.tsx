import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";
import { CalculatedValues } from "@/types/calculator";

interface ProfitWaterfallProps {
  values: CalculatedValues;
  onIncludeInPack: (include: boolean) => void;
}

export function ProfitWaterfall({ values, onIncludeInPack }: ProfitWaterfallProps) {
  const [showPercentOfCost, setShowPercentOfCost] = useState(false);

  // Colors are kept in lockstep with the cost-breakdown donut in the GDV
  // Calculator (SummaryPanel) so the same category reads as the same color
  // across both tabs.
  const waterfallData = [
    { name: "GDV", value: values.totalGDV, isPositive: true, color: "hsl(var(--foreground))" },
    { name: "Build (Base)", value: -values.baseBuildCost, isNegative: true, color: "#3B82F6" },
  ];

  if (values.externals > 0) {
    waterfallData.push({
      name: "Externals",
      value: -values.externals,
      isNegative: true,
      color: "#06B6D4",
    });
  }

  if (values.prelims > 0) {
    waterfallData.push({
      name: "Prelims",
      value: -values.prelims,
      isNegative: true,
      color: "#14B8A6",
    });
  }

  const financeCost = values.financeInterest + (values.financeFixedFees || 0);

  waterfallData.push(
    { name: "Professional Fees", value: -values.professionalFees, isNegative: true, color: "#6366F1" },
    { name: "Marketing & Sales", value: -values.marketingSales, isNegative: true, color: "#8B5CF6" },
    { name: "Contingency", value: -values.contingency, isNegative: true, color: "#64748B" },
    { name: "Finance", value: -financeCost, isNegative: true, color: "#F59E0B" }
  );

  if (values.sitePrepTechnical > 0) {
    waterfallData.push({
      name: "Site Prep & Technical",
      value: -values.sitePrepTechnical,
      isNegative: true,
      color: "#F97316",
    });
  }

  if (values.otherPlanning > 0) {
    waterfallData.push({
      name: "Other",
      value: -values.otherPlanning,
      isNegative: true,
      color: "#A855F7",
    });
  }

  waterfallData.push(
    { name: "Land", value: -values.landCost, isNegative: true, color: "#EC4899" },
    { name: "Net Profit", value: values.netProfit, isPositive: true, color: "hsl(var(--success))" }
  );

  const baseValue = showPercentOfCost ? values.totalCosts : values.totalGDV;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const absValue = Math.abs(data.value);
      const percentage = (absValue / baseValue) * 100;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-1">{data.name}</p>
          <p className="text-sm">{formatCurrency(absValue)}</p>
          <p className="text-sm text-muted-foreground">
            {formatPercent(percentage)} of {showPercentOfCost ? "Total Cost" : "GDV"}
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
          <h3 className="text-lg font-semibold">Profit Waterfall</h3>
          <p className="text-sm text-muted-foreground">GDV → Costs → Profit breakdown</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-percent-cost"
              checked={showPercentOfCost}
              onCheckedChange={(checked) => setShowPercentOfCost(checked as boolean)}
            />
            <Label htmlFor="show-percent-cost" className="text-sm cursor-pointer">
              % of Total Cost
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="include-waterfall" onCheckedChange={onIncludeInPack} />
            <Label htmlFor="include-waterfall" className="text-sm cursor-pointer">
              Add to Pack
            </Label>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={waterfallData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
          <YAxis tickFormatter={(value) => formatCurrency(Math.abs(value))} fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {waterfallData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
