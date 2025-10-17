import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatPercent } from "@/utils/calculatorHelpers";

interface CostToGDVGaugeProps {
  costToGDV: number;
  profitMargin: number;
  targetMargin: number;
  onIncludeInPack: (include: boolean) => void;
}

export function CostToGDVGauge({
  costToGDV,
  profitMargin,
  targetMargin,
  onIncludeInPack,
}: CostToGDVGaugeProps) {
  const getColor = () => {
    if (costToGDV <= 75) return "hsl(var(--success))";
    if (costToGDV <= 85) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  const getStatus = () => {
    if (costToGDV <= 75) return "🟢 Excellent";
    if (costToGDV <= 85) return "🟠 Moderate";
    return "🔴 High Risk";
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Cost-to-GDV Ratio</h3>
          <p className="text-sm text-muted-foreground">Total costs as percentage of GDV</p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="include-gauge" onCheckedChange={onIncludeInPack} />
          <Label htmlFor="include-gauge" className="text-sm cursor-pointer">
            Add to Pack
          </Label>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-8">
        <div className="relative w-64 h-64">
          {/* Gauge background */}
          <svg className="w-full h-full" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="20"
              strokeDasharray="377"
              strokeDashoffset="94"
              transform="rotate(135 100 100)"
            />
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke={getColor()}
              strokeWidth="20"
              strokeDasharray="377"
              strokeDashoffset={377 - (costToGDV / 100) * 283}
              transform="rotate(135 100 100)"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold" style={{ color: getColor() }}>
              {formatPercent(costToGDV)}
            </div>
            <div className="text-sm text-muted-foreground mt-2">{getStatus()}</div>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            Profit Margin: <span className="font-semibold">{formatPercent(profitMargin)}</span> vs
            Target <span className="font-semibold">{formatPercent(targetMargin)}</span>
          </p>
        </div>

        <div className="flex items-center gap-6 mt-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span>≤ 75%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span>75–85%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span>&gt; 85%</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
