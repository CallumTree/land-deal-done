import { CalculatedValues } from "@/types/calculator";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Copy } from "lucide-react";
import { toast } from "sonner";

interface SummaryPanelProps {
  values: CalculatedValues;
  targetMargin: number;
}

const SummaryPanel = ({ values, targetMargin }: SummaryPanelProps) => {
  const isSuccessful = values.profitMarginPercent >= targetMargin;
  const isVariancePositive = values.variance >= 0;

  const copySummary = () => {
    const summary = `
Napkin GDV Summary
==================
Total GDV: ${formatCurrency(values.totalGDV)}
Build Cost: ${formatCurrency(values.buildCost)}
Professional Fees: ${formatCurrency(values.professionalFees)}
Marketing & Sales: ${formatCurrency(values.marketingSales)}
Contingency: ${formatCurrency(values.contingency)}
Finance: ${formatCurrency(values.finance)}
Other (S106/CIL): ${formatCurrency(values.other)}
Land Cost: ${formatCurrency(values.landCost)}
---
Total Costs: ${formatCurrency(values.totalCosts)}
Net Profit: ${formatCurrency(values.netProfit)}
Profit Margin: ${formatPercent(values.profitMarginPercent)}
---
Residual Land Value: ${formatCurrency(values.residualLandValue)}
Variance to Land: ${formatCurrency(values.variance)}
    `.trim();

    navigator.clipboard.writeText(summary);
    toast.success("Summary copied to clipboard");
  };

  const costBreakdown = [
    { label: "Build", value: values.buildCost, color: "bg-primary" },
    { label: "Fees", value: values.professionalFees, color: "bg-accent" },
    { label: "Marketing", value: values.marketingSales, color: "bg-secondary" },
    { label: "Contingency", value: values.contingency, color: "bg-muted" },
    { label: "Finance", value: values.finance, color: "bg-primary/60" },
    { label: "Other", value: values.other, color: "bg-accent/60" },
    { label: "Land", value: values.landCost, color: "bg-secondary/60" },
  ];

  return (
    <div className="space-y-4">
      <Card className="shadow-medium">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            Summary
            <Button variant="ghost" size="sm" onClick={copySummary}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Total GDV</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(values.totalGDV)}
              </span>
            </div>
            
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Total Costs</span>
              <span className="text-xl font-semibold">
                {formatCurrency(values.totalCosts)}
              </span>
            </div>

            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium">Net Profit</span>
                <span className={`text-2xl font-bold ${isSuccessful ? 'text-green-600' : 'text-amber-600'}`}>
                  {formatCurrency(values.netProfit)}
                </span>
              </div>
              
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm text-muted-foreground">Profit Margin</span>
                <span className={`text-lg font-semibold ${isSuccessful ? 'text-green-600' : 'text-amber-600'}`}>
                  {formatPercent(values.profitMarginPercent)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <h4 className="text-sm font-semibold mb-2">Cost Breakdown</h4>
            {costBreakdown.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{formatCurrency(item.value)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-2">
            <h4 className="text-sm font-semibold">Residual Land Value</h4>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">RLV at Target Margin</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(values.residualLandValue)}
              </span>
            </div>
            
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              isVariancePositive ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
            }`}>
              <span className="text-sm font-medium">Variance to Land</span>
              <div className="flex items-center gap-2">
                {isVariancePositive ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-amber-600" />
                )}
                <span className={`text-lg font-bold ${isVariancePositive ? 'text-green-600' : 'text-amber-600'}`}>
                  {formatCurrency(values.variance)}
                </span>
              </div>
            </div>
          </div>

          {/* Mini bar chart */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Visual Breakdown</h4>
            <div className="space-y-2">
              <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-primary transition-all"
                  style={{ width: '100%' }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground">
                    GDV: {formatCurrency(values.totalGDV)}
                  </span>
                </div>
              </div>
              
              <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-destructive transition-all"
                  style={{ width: `${(values.totalCosts / values.totalGDV) * 100}%` }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-destructive-foreground">
                    Costs: {formatCurrency(values.totalCosts)}
                  </span>
                </div>
              </div>
              
              <div className="relative h-8 bg-muted rounded-full overflow-hidden">
                <div
                  className={`absolute h-full transition-all ${isSuccessful ? 'bg-green-600' : 'bg-amber-600'}`}
                  style={{ width: `${(values.netProfit / values.totalGDV) * 100}%` }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    Profit: {formatCurrency(values.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Button variant="cta" className="w-full mt-4" asChild>
            <a href="#email-capture">Book a Demo</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SummaryPanel;
