import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";

interface KPICardsProps {
  roi: number;
  roce: number;
  costToGDV: number;
  gdvPerSqm: number;
  gdvPerUnit: number;
  buildPerUnit: number;
}

export function KPICards({
  roi,
  roce,
  costToGDV,
  gdvPerSqm,
  gdvPerUnit,
  buildPerUnit,
}: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-1">ROI (Return on Cost)</div>
        <div className="text-2xl font-bold">{formatPercent(roi)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-1">ROCE</div>
        <div className="text-2xl font-bold">{formatPercent(roce)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-1">Cost-to-GDV</div>
        <div className="text-2xl font-bold">{formatPercent(costToGDV)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-1">£/m² GDV</div>
        <div className="text-2xl font-bold">£{Math.round(gdvPerSqm)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-1">£/unit GDV</div>
        <div className="text-2xl font-bold">{formatCurrency(gdvPerUnit)}</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-muted-foreground mb-1">£/unit Build (Base)</div>
        <div className="text-2xl font-bold">{formatCurrency(buildPerUnit)}</div>
      </Card>
    </div>
  );
}
