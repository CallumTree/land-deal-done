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

  const waterfallData = [
    { name: "GDV", value: values.totalGDV, isPositive: true, color: "hsl(var(--chart-1))" },
    { name: "Build", value: -values.buildCost, isNegative: true, color: "hsl(var(--chart-2))" },
    { name: "Professional Fees", value: -values.professionalFees, isNegative: true, color: "hsl(var(--chart-3))" },
    { name: "Marketing & Sales", value: -values.marketingSales, isNegative: true, color: "hsl(var(--chart-4))" },
    { name: "Contingency", value: -values.contingency, isNegative: true, color: "hsl(var(--chart-5))" },
    { name: "Finance", value: -values.finance, isNegative: true, color: "hsl(var(--destructive))" },
    { name: "Land", value: -values.landCost, isNegative: true, color: "hsl(var(--primary))" },
  ];

  if (values.sitePrepTechnical > 0) {
    waterfallData.push({
      name: "Site Prep & Technical",
      value: -values.sitePrepTechnical,
      isNegative: true,
      color: "hsl(var(--warning))",
    });
  }

  if (values.other > 0) {
    waterfallData.push({
      name: "Other",
      value: -values.other,
      isNegative: true,
      color: "hsl(var(--muted))",
    });
  }

  waterfallData.push({
    name: "Net Profit",
    value: values.netProfit,
    isPositive: true,
    color: "hsl(var(--success))",
  });

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
