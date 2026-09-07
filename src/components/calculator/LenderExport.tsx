import { CalculatedValues, GlobalInputs, PropertyRow, PlanningUpliftData } from "@/types/calculator";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Printer, FileText, TrendingUp } from "lucide-react";
import { useState } from "react";

interface LenderExportProps {
  values: CalculatedValues;
  inputs: GlobalInputs;
  rows: PropertyRow[];
  siteArea?: number;
  mapImageUrl?: string;
  projectName?: string;
}

const LenderExport = ({
  values,
  inputs,
  rows,
  siteArea = 0,
  mapImageUrl,
  projectName = "Development Site",
}: LenderExportProps) => {
  const [preparedBy, setPreparedBy] = useState("");
  const [editableProjectName, setEditableProjectName] = useState(projectName);
  const [siteAddress, setSiteAddress] = useState("");
  const [planningConsiderations, setPlanningConsiderations] = useState("");
  const [utilitiesAbnormals, setUtilitiesAbnormals] = useState("");
  const [marketCommentary, setMarketCommentary] = useState("");
  const [exitStrategy, setExitStrategy] = useState("");
  
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
  const siteAreaHa = siteArea / 10000;
  const density = siteAreaHa > 0 ? totalUnits / siteAreaHa : 0;

  const financeCost = values.financeInterest + (values.financeFixedFees || 0);

  const costBreakdown = [
    { label: "Build (Base)", value: values.baseBuildCost },
    ...(values.externals > 0 ? [{ label: "Externals", value: values.externals }] : []),
    ...(values.prelims > 0 ? [{ label: "Prelims", value: values.prelims }] : []),
    { label: "Professional Fees", value: values.professionalFees },
    { label: "Marketing & Sales", value: values.marketingSales },
    { label: "Contingency", value: values.contingency },
    { label: "Finance", value: financeCost },
    ...(values.sitePrepTechnical > 0 ? [{ label: "Site Prep & Technical", value: values.sitePrepTechnical }] : []),
    { label: "Other (S106/CIL)", value: values.otherPlanning },
    { label: "Land Cost", value: values.landCost },
  ].filter(item => item.value > 0);

  const handlePrint = () => {
    window.print();
  };

  const calculateSensitivity = (salesDelta: number, buildDelta: number) => {
    const adjustedGDV = values.totalGDV * (1 + salesDelta / 100);
    const adjustedBaseBuild = values.baseBuildCost * (1 + buildDelta / 100);
    const adjustedExternals = adjustedBaseBuild * ((inputs.externalsPercent || 0) / 100);
    const adjustedPrelims = adjustedBaseBuild * ((inputs.prelimsPercent || 12) / 100);
    const adjustedProfessionalFees = adjustedBaseBuild * (inputs.professionalFeesPercent / 100);
    const adjustedContingency = (adjustedBaseBuild + adjustedExternals + adjustedPrelims + adjustedProfessionalFees) * (inputs.contingencyPercent / 100);
    
    const adjustedTotalCosts = 
      adjustedBaseBuild + 
      adjustedExternals +
      adjustedPrelims +
      adjustedProfessionalFees + 
      values.marketingSales + 
      adjustedContingency + 
      financeCost + 
      values.sitePrepTechnical + 
      values.otherPlanning + 
      values.landCost;
    
    const adjustedProfit = adjustedGDV - adjustedTotalCosts;
    const adjustedMargin = adjustedGDV > 0 ? (adjustedProfit / adjustedGDV) * 100 : 0;
    
    return adjustedMargin;
  };

  const roce = values.landCost > 0 ? (values.netProfit / values.landCost) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center print:hidden bg-card p-4 rounded-lg border">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Lender Summary Pack</h2>
        </div>
        <Button onClick={handlePrint} size="default">
          <Printer className="h-4 w-4 mr-2" />
          Print / Save PDF
        </Button>
      </div>

      {/* Print Content */}
      <div className="print:p-8 space-y-6 bg-background" id="lender-pack">
        {/* Header */}
        <div className="border-b pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-primary">BuildFlow Feasibility Summary</h1>
              <div className="mt-2 space-y-1 text-sm">
                <Input
                  placeholder="Project Name"
                  value={editableProjectName}
                  onChange={(e) => setEditableProjectName(e.target.value)}
                  className="print:border-0 print:p-0 print:h-auto font-semibold"
                />
                <Input
                  placeholder="Site Address"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="print:border-0 print:p-0 print:h-auto"
                />
              </div>
            </div>
            <div className="text-right text-sm space-y-1">
              <p className="font-medium">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              <Input
                placeholder="Prepared by"
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                className="print:border-0 print:p-0 print:h-auto text-right"
              />
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div>
          <h2 className="text-xl font-semibold mb-3">Key Metrics</h2>
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">GDV</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(values.totalGDV)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total Dev Cost</p>
              <p className="text-2xl font-bold">{formatCurrency(values.totalCosts)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(values.netProfit)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Profit Margin</p>
              <p className="text-2xl font-bold text-success">{formatPercent(values.profitMarginPercent)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Site Area</p>
              <p className="text-xl font-bold">{siteAreaHa.toFixed(2)} ha</p>
              <p className="text-xs text-muted-foreground">{siteArea.toLocaleString()} m²</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total Units</p>
              <p className="text-2xl font-bold">{totalUnits}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Density</p>
              <p className="text-2xl font-bold">{density.toFixed(1)} u/ha</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">RLV</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(values.residualLandValue)}</p>
            </Card>
          </div>
        </div>

        {/* Site Overview */}
        <div className="break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3">Site Overview</h2>
          {mapImageUrl && (
            <div className="mb-4 border rounded-lg overflow-hidden">
              <img src={mapImageUrl} alt="Site Map" className="w-full h-64 object-cover" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left p-2">Type</th>
                  <th className="text-right p-2">Units</th>
                  <th className="text-right p-2">GIA (m²)</th>
                  <th className="text-right p-2">Sale £/m²</th>
                  <th className="text-right p-2">Build £/m²</th>
                  <th className="text-right p-2">Row GDV</th>
                  <th className="text-right p-2">Row Cost</th>
                  <th className="text-right p-2">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const gdvPerUnit = row.unitPriceOverride > 0 ? row.unitPriceOverride : row.salesValue;
                  const rowGDV = row.units * gdvPerUnit;
                  const rowCost = row.units * row.giaPerUnit * row.buildPerSqm;
                  const rowMargin = rowGDV > 0 ? ((rowGDV - rowCost) / rowGDV) * 100 : 0;
                  const salePerSqm = row.giaPerUnit > 0 ? gdvPerUnit / row.giaPerUnit : 0;

                  return (
                    <tr key={row.id} className="border-b">
                      <td className="p-2">{row.type}</td>
                      <td className="text-right p-2">{row.units}</td>
                      <td className="text-right p-2">{row.giaPerUnit}</td>
                      <td className="text-right p-2">£{salePerSqm.toFixed(0)}</td>
                      <td className="text-right p-2">£{row.buildPerSqm}</td>
                      <td className="text-right p-2">{formatCurrency(rowGDV)}</td>
                      <td className="text-right p-2">{formatCurrency(rowCost)}</td>
                      <td className="text-right p-2">{formatPercent(rowMargin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3">Cost Breakdown</h2>
          
          {/* Visual Bar */}
          <div className="mb-4">
            <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
              {(() => {
                let offset = 0;
                const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-warning', 'bg-orange-500', 'bg-destructive', 'bg-gray-500', 'bg-slate-500'];
                return costBreakdown.map((item, idx) => {
                  const width = (item.value / values.totalGDV) * 100;
                  const element = (
                    <div
                      key={item.label}
                      className={`absolute h-full ${colors[idx % colors.length]} transition-all`}
                      style={{ left: `${offset}%`, width: `${width}%` }}
                      title={`${item.label}: ${formatCurrency(item.value)}`}
                    />
                  );
                  offset += width;
                  return element;
                });
              })()}
            </div>
            <div className="mt-2 relative h-8 bg-success/15 rounded-lg overflow-hidden border-2 border-success">
              <div
                className="absolute h-full bg-success"
                style={{ width: `${(values.netProfit / values.totalGDV) * 100}%` }}
              >
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                  Profit: {formatCurrency(values.netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted">
                <th className="text-left p-2">Item</th>
                <th className="text-right p-2">Amount (£)</th>
                <th className="text-right p-2">% of GDV</th>
              </tr>
            </thead>
            <tbody>
              {costBreakdown.map((item) => (
                <tr key={item.label} className="border-b">
                  <td className="p-2">{item.label}</td>
                  <td className="text-right p-2">{formatCurrency(item.value)}</td>
                  <td className="text-right p-2">{formatPercent((item.value / values.totalGDV) * 100)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2">
                <td className="p-2">Total Costs</td>
                <td className="text-right p-2">{formatCurrency(values.totalCosts)}</td>
                <td className="text-right p-2">{formatPercent((values.totalCosts / values.totalGDV) * 100)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sensitivity & ROI */}
        <div className="break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3">Sensitivity Analysis & ROI</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">ROCE</p>
              <p className="text-2xl font-bold text-primary">{formatPercent(roce)}</p>
              <p className="text-xs text-muted-foreground mt-1">Return on Capital Employed</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Land Variance</p>
              <p className={`text-2xl font-bold ${values.variance >= 0 ? 'text-success' : 'text-warning'}`}>
                {formatCurrency(values.variance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">RLV vs Purchase Price</p>
            </Card>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted">
                <th className="text-left p-2">Scenario</th>
                <th className="text-right p-2">Sales Change</th>
                <th className="text-right p-2">Build Change</th>
                <th className="text-right p-2">Profit Margin</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2">Base Case</td>
                <td className="text-right p-2">0%</td>
                <td className="text-right p-2">0%</td>
                <td className="text-right p-2 font-semibold">{formatPercent(values.profitMarginPercent)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Optimistic</td>
                <td className="text-right p-2 text-success">+10%</td>
                <td className="text-right p-2 text-success">-5%</td>
                <td className="text-right p-2 font-semibold text-success">{formatPercent(calculateSensitivity(10, -5))}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Moderate Upside</td>
                <td className="text-right p-2 text-success">+5%</td>
                <td className="text-right p-2">0%</td>
                <td className="text-right p-2 font-semibold text-success">{formatPercent(calculateSensitivity(5, 0))}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Moderate Downside</td>
                <td className="text-right p-2 text-warning">-5%</td>
                <td className="text-right p-2 text-warning">+5%</td>
                <td className="text-right p-2 font-semibold text-warning">{formatPercent(calculateSensitivity(-5, 5))}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2">Pessimistic</td>
                <td className="text-right p-2 text-destructive">-10%</td>
                <td className="text-right p-2 text-destructive">+10%</td>
                <td className="text-right p-2 font-semibold text-destructive">{formatPercent(calculateSensitivity(-10, 10))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Assumptions Summary */}
        <div className="break-inside-avoid">
          <h2 className="text-xl font-semibold mb-3">Assumptions Summary</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Professional Fees:</span>
              <span className="font-medium">{formatPercent(inputs.professionalFeesPercent)}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Marketing & Sales:</span>
              <span className="font-medium">{formatPercent(inputs.marketingSalesPercent)}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Contingency:</span>
              <span className="font-medium">{formatPercent(inputs.contingencyPercent)}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Finance Rate:</span>
              <span className="font-medium">{formatPercent(inputs.financePercent)}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">Target Margin:</span>
              <span className="font-medium">{formatPercent(inputs.targetMarginPercent)}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">S106/CIL:</span>
              <span className="font-medium">{formatCurrency(inputs.s106CIL)}</span>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span className="text-muted-foreground">VAT Status:</span>
              <span className="font-medium">{inputs.vatEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>

        {/* Risks & Comments */}
        <div className="break-inside-avoid space-y-4">
          <h2 className="text-xl font-semibold">Risks & Comments</h2>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Planning Considerations</label>
            <Textarea
              value={planningConsiderations}
              onChange={(e) => setPlanningConsiderations(e.target.value)}
              placeholder="Key planning issues, constraints, or opportunities..."
              className="print:border-0 print:p-0 min-h-[80px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Utilities & Abnormals</label>
            <Textarea
              value={utilitiesAbnormals}
              onChange={(e) => setUtilitiesAbnormals(e.target.value)}
              placeholder="Known utility constraints, abnormal costs, or ground conditions..."
              className="print:border-0 print:p-0 min-h-[80px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Market Commentary</label>
            <Textarea
              value={marketCommentary}
              onChange={(e) => setMarketCommentary(e.target.value)}
              placeholder="Market conditions, comparable sales, demand outlook..."
              className="print:border-0 print:p-0 min-h-[80px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Exit Strategy</label>
            <Textarea
              value={exitStrategy}
              onChange={(e) => setExitStrategy(e.target.value)}
              placeholder="Planned exit route, phasing, or sale strategy..."
              className="print:border-0 print:p-0 min-h-[80px]"
            />
          </div>
        </div>

        {/* Planning Uplift Appendix (Conditional) */}
        {inputs.planningUplift?.includeInLenderPack && (() => {
          const siteAreaHa = siteArea / 10000;
          const EUV_PRESETS: Record<string, number> = {
            Agricultural: 25000,
            Brownfield: 150000,
            Industrial: 300000,
            Yard: 200000,
          };
          
          const getCurrentValue = () => {
            if (inputs.planningUplift!.currentValueType === "Custom" && inputs.planningUplift!.currentValueOverride) {
              return inputs.planningUplift!.currentValueOverride;
            }
            return EUV_PRESETS[inputs.planningUplift!.currentValueType] * siteAreaHa;
          };
          
          const currentValue = getCurrentValue();
          const grossUplift = values.residualLandValue - currentValue - inputs.planningUplift!.planningCosts;
          const adjustedUplift = grossUplift * (inputs.planningUplift!.successProbability / 100);
          
          return (
            <div className="break-before-page space-y-4 mt-8">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold">Appendix: Planning Uplift Analysis</h2>
              </div>
              
              <Card className="p-4 bg-muted/30">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Site Area</p>
                    <p className="text-lg font-semibold">{siteAreaHa.toFixed(2)} hectares</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Current Use</p>
                    <p className="text-lg font-semibold">{inputs.planningUplift!.currentValueType}</p>
                  </div>
                </div>
              </Card>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Valuation Breakdown</h3>
                
                <table className="w-full">
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 text-muted-foreground">Residual Land Value (RLV)</td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(values.residualLandValue)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-muted-foreground">
                        Existing Use Value (EUV)
                        <span className="text-xs block">
                          {inputs.planningUplift!.currentValueType !== "Custom" 
                            ? `${inputs.planningUplift!.currentValueType}: ${formatCurrency(EUV_PRESETS[inputs.planningUplift!.currentValueType])}/ha × ${siteAreaHa.toFixed(2)} ha`
                            : "Custom value"
                          }
                        </span>
                      </td>
                      <td className="py-2 text-right font-semibold">({formatCurrency(currentValue)})</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-muted-foreground">Planning Costs</td>
                      <td className="py-2 text-right font-semibold">({formatCurrency(inputs.planningUplift!.planningCosts)})</td>
                    </tr>
                    <tr className="border-t-2 border-primary/20">
                      <td className="py-2 font-semibold">Gross Planning Uplift</td>
                      <td className="py-2 text-right font-bold text-lg">{formatCurrency(grossUplift)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-muted-foreground">Success Probability</td>
                      <td className="py-2 text-right font-semibold">{inputs.planningUplift!.successProbability}%</td>
                    </tr>
                    <tr className={`border-t-2 ${adjustedUplift > 0 ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'}`}>
                      <td className="py-3 font-bold">Risk-Adjusted Uplift</td>
                      <td className={`py-3 text-right font-bold text-xl ${adjustedUplift > 0 ? 'text-success' : 'text-warning'}`}>
                        {formatCurrency(adjustedUplift)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">Assumptions & Disclaimer</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>EUV based on typical market rates for stated use class</li>
                  <li>Planning costs include fees, consultant costs, and section obligations</li>
                  <li>Success probability reflects planning risk, policy compliance, and local factors</li>
                  <li>Uplift figures are indicative and subject to market conditions</li>
                  <li>Professional valuation and planning advice recommended before proceeding</li>
                </ul>
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <div className="border-t pt-4 mt-8 text-xs text-muted-foreground">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-primary text-sm">BuildFlow</p>
              <p>Professional Feasibility Analysis</p>
            </div>
            <div className="text-right">
              <p>Generated: {new Date().toLocaleString('en-GB')}</p>
              <p className="mt-1 italic">This report is indicative only and does not constitute financial advice.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LenderExport;
