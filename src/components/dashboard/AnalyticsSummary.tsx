import { Card, CardContent } from "@/components/ui/card";
import { ProjectSummary } from "@/types/project";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";
import { TrendingUp, Target, Award, Home, Layers, DollarSign } from "lucide-react";

interface AnalyticsSummaryProps {
  summary: ProjectSummary;
}

const AnalyticsSummary = ({ summary }: AnalyticsSummaryProps) => {
  const kpis = [
    {
      label: "Total Portfolio GDV",
      value: formatCurrency(summary.totalGDV),
      icon: DollarSign,
      color: "text-primary",
    },
    {
      label: "Avg Profit Margin",
      value: formatPercent(summary.averageProfitMargin),
      icon: TrendingUp,
      color: "text-success",
    },
    {
      label: "Highest Margin",
      value: summary.highestMarginProject 
        ? `${formatPercent(summary.highestMarginProject.margin)}`
        : "N/A",
      subtext: summary.highestMarginProject?.name,
      icon: Award,
      color: "text-warning",
    },
    {
      label: "Avg Units/Project",
      value: summary.averageUnits.toFixed(1),
      icon: Home,
      color: "text-info",
    },
    {
      label: "Total Sites",
      value: summary.totalSites.toString(),
      icon: Layers,
      color: "text-primary",
    },
    {
      label: "Combined RLV",
      value: formatCurrency(summary.estimatedCombinedRLV),
      icon: Target,
      color: "text-success",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <div className="font-bold text-xl">{kpi.value}</div>
            {kpi.subtext && (
              <div className="text-xs text-muted-foreground truncate">{kpi.subtext}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AnalyticsSummary;
