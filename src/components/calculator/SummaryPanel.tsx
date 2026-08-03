import { CalculatedValues } from "@/types/calculator";
import { SensitivityAdjustments } from "@/types/sensitivity";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Copy, Activity } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SummaryPanelProps {
  values: CalculatedValues;
  targetMargin: number;
  isSensitivityActive?: boolean;
  sensitivity?: SensitivityAdjustments;
}

const SummaryPanel = ({ values, targetMargin, isSensitivityActive = false, sensitivity }: SummaryPanelProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSuccessful = values.profitMarginPercent >= targetMargin;
  const isVariancePositive = values.variance >= 0;

  const handleExportLenderPack = () => {
    const projectMatch = location.pathname.match(/\/project\/([^/]+)/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      navigate(`/project/${projectId}?tab=lender-export`);
    }
  };

  const copySummary = () => {
    const sitePrepPercent = values.totalCosts > 0 ? (values.sitePrepTechnical / values.totalCosts) * 100 : 0;
    const summary = `
Napkin GDV Summary
==================
Total GDV: ${formatCurrency(values.totalGDV)}
Build (Base): ${formatCurrency(values.baseBuildCost)}
${values.externals > 0 ? `Externals: ${formatCurrency(values.externals)}` : ''}
${values.prelims > 0 ? `Prelims: ${formatCurrency(values.prelims)}` : ''}
Professional Fees: ${formatCurrency(values.professionalFees)}
Marketing & Sales: ${formatCurrency(values.marketingSales)}
Contingency: ${formatCurrency(values.contingency)}
Finance: ${formatCurrency(values.finance)}
${values.sitePrepTechnical > 0 ? `Site Prep & Technical: ${formatCurrency(values.sitePrepTechnical)} (${sitePrepPercent.toFixed(1)}%)` : ''}
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
    { label: "Build (Base)", value: values.baseBuildCost, color: "#3B82F6" },
    ...(values.externals > 0 ? [{ label: "Externals", value: values.externals, color: "#06B6D4" }] : []),
    ...(values.prelims > 0 ? [{ label: "Prelims", value: values.prelims, color: "#14B8A6" }] : []),
    { label: "Pro Fees", value: values.professionalFees, color: "#6366F1" },
    { label: "Marketing", value: values.marketingSales, color: "#8B5CF6" },
    { label: "Contingency", value: values.contingency, color: "#64748B" },
    { label: "Finance", value: values.finance, color: "#F59E0B" },
    ...(values.sitePrepTechnical > 0 ? [{ label: "Site Prep", value: values.sitePrepTechnical, color: "#F97316" }] : []),
    { label: "S106/CIL", value: values.other, color: "#A855F7" },
    { label: "Land", value: values.landCost, color: "#EC4899" },
  ].filter(item => item.value > 0);

  const chartData = costBreakdown.map(item => ({
    name: item.label,
    value: item.value,
    fill: item.color,
  }));

  return (
    <div className="space-y-4">
      <Card className={`shadow-soft rounded-lg transition-all ${isSensitivityActive ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              Summary
              {isSensitivityActive && (
                <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
                  <Activity className="h-3 w-3" />
                  Live Sensitivity
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={copySummary}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSensitivityActive && sensitivity && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
              <p className="font-medium text-primary mb-1">Market adjustments applied:</p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {sensitivity.salesValuePercent !== 0 && <p>Sales: {sensitivity.salesValuePercent > 0 ? '+' : ''}{sensitivity.salesValuePercent}%</p>}
                {sensitivity.buildCostPercent !== 0 && <p>Build: {sensitivity.buildCostPercent > 0 ? '+' : ''}{sensitivity.buildCostPercent}%</p>}
                {sensitivity.financeRatePercent !== 0 && <p>Finance: {sensitivity.financeRatePercent > 0 ? '+' : ''}{sensitivity.financeRatePercent}%</p>}
                {sensitivity.contingencyPercent !== 0 && <p>Contingency: {sensitivity.contingencyPercent > 0 ? '+' : ''}{sensitivity.contingencyPercent}%</p>}
                {sensitivity.programmeDelayMonths !== 0 && <p>Delay: +{sensitivity.programmeDelayMonths} months</p>}
              </div>
            </div>
          )}
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
                <span className={`text-2xl font-bold ${isSuccessful ? 'text-success' : 'text-warning'}`}>
                  {formatCurrency(values.netProfit)}
                </span>
              </div>
              
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm text-muted-foreground">Profit Margin</span>
                <span className={`text-lg font-semibold ${isSuccessful ? 'text-success' : 'text-warning'}`}>
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
            
            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              isVariancePositive ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'
            }`}>
              <span className="text-sm font-medium text-foreground">Variance to Land</span>
              <div className="flex items-center gap-2">
                {isVariancePositive ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-warning" />
                )}
                <span className={`text-lg font-bold ${isVariancePositive ? 'text-success' : 'text-warning'}`}>
                  {formatCurrency(values.variance)}
                </span>
              </div>
            </div>
          </div>

          {/* Doughnut chart */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Cost Breakdown</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: any) => (
                    <span className="text-xs text-muted-foreground">
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center mt-2 space-y-1">
              <div className="text-xs text-muted-foreground">Total GDV</div>
              <div className="text-xl font-bold text-primary">{formatCurrency(values.totalGDV)}</div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <Button
              variant="cta"
              className="w-full"
              onClick={handleExportLenderPack}
            >
              Export Lender Pack
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SummaryPanel;
