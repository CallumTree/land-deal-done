import { CalculatedValues, GlobalInputs, PropertyRow } from "@/types/calculator";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Printer, Download } from "lucide-react";
import { useState } from "react";

interface LenderSummaryPackProps {
  open: boolean;
  onClose: () => void;
  values: CalculatedValues;
  inputs: GlobalInputs;
  rows: PropertyRow[];
  siteArea?: number;
  mapImageUrl?: string;
}

const LenderSummaryPack = ({
  open,
  onClose,
  values,
  inputs,
  rows,
  siteArea = 0,
  mapImageUrl,
}: LenderSummaryPackProps) => {
  const [preparedBy, setPreparedBy] = useState("");
  const [projectName, setProjectName] = useState("Development Site");
  const [siteAddress, setSiteAddress] = useState("");
  const [planningConsiderations, setPlanningConsiderations] = useState("");
  const [utilitiesAbnormals, setUtilitiesAbnormals] = useState("");
  const [marketCommentary, setMarketCommentary] = useState("");
  const [exitStrategy, setExitStrategy] = useState("");

  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
  const siteAreaHa = siteArea / 10000;
  const density = siteAreaHa > 0 ? totalUnits / siteAreaHa : 0;

  const costBreakdown = [
    { label: "Build (Base)", value: values.baseBuildCost },
    ...(values.externals > 0 ? [{ label: `Externals (${inputs.externalsPercent || 0}% of Base Build)`, value: values.externals }] : []),
    ...(values.prelims > 0 ? [{ label: `Prelims (${inputs.prelimsPercent || 12}% of Base Build)`, value: values.prelims }] : []),
    { label: `Professional Fees (${inputs.professionalFeesPercent}% of Base Build)`, value: values.professionalFees },
    { label: `Marketing & Sales (${inputs.marketingSalesPercent}% of GDV)`, value: values.marketingSales },
    { label: `Contingency (${inputs.contingencyPercent}% of Build+Prelims+Externals+Fees)`, value: values.contingency },
    { label: "Finance", value: values.finance },
    ...(values.sitePrepTechnical > 0 ? [{ label: "Site Prep & Technical", value: values.sitePrepTechnical }] : []),
    { label: "Other (S106/CIL)", value: values.other },
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
      values.finance + 
      values.sitePrepTechnical + 
      values.other + 
      values.landCost;
    
    const adjustedProfit = adjustedGDV - adjustedTotalCosts;
    const adjustedMargin = adjustedGDV > 0 ? (adjustedProfit / adjustedGDV) * 100 : 0;
    
    return adjustedMargin;
  };

  const roce = values.landCost > 0 ? (values.netProfit / values.landCost) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full">
        <DialogHeader className="print:hidden">
          <DialogTitle>Lender Summary Pack</DialogTitle>
          <div className="flex gap-2 mt-2">
            <Button onClick={handlePrint} size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
            <Button onClick={onClose} variant="outline" size="sm">
              Close
            </Button>
          </div>
        </DialogHeader>

        <div className="print:p-8 space-y-6" id="lender-pack">
          {/* Header */}
          <div className="border-b pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-primary">BuildFlow Feasibility Summary</h1>
                <div className="mt-2 space-y-1 text-sm">
                  <Input
                    placeholder="Project Name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
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
                <p className="text-2xl font-bold text-green-600">{formatCurrency(values.netProfit)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Profit Margin</p>
                <p className="text-2xl font-bold text-green-600">{formatPercent(values.profitMarginPercent)}</p>
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
                  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-gray-500', 'bg-slate-500'];
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
              <div className="mt-2 relative h-8 bg-green-100 rounded-lg overflow-hidden border-2 border-green-600">
                <div
                  className="absolute h-full bg-green-600"
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
                <p className={`text-2xl font-bold ${values.variance >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
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
                  <td className="text-right p-2 text-green-600">+10%</td>
                  <td className="text-right p-2 text-green-600">-5%</td>
                  <td className="text-right p-2 font-semibold text-green-600">{formatPercent(calculateSensitivity(10, -5))}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Moderate Upside</td>
                  <td className="text-right p-2 text-green-600">+5%</td>
                  <td className="text-right p-2">0%</td>
                  <td className="text-right p-2 font-semibold text-green-600">{formatPercent(calculateSensitivity(5, 0))}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Moderate Downside</td>
                  <td className="text-right p-2 text-amber-600">-5%</td>
                  <td className="text-right p-2 text-amber-600">+5%</td>
                  <td className="text-right p-2 font-semibold text-amber-600">{formatPercent(calculateSensitivity(-5, 5))}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2">Pessimistic</td>
                  <td className="text-right p-2 text-red-600">-10%</td>
                  <td className="text-right p-2 text-red-600">+10%</td>
                  <td className="text-right p-2 font-semibold text-red-600">{formatPercent(calculateSensitivity(-10, 10))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Assumptions Summary */}
          <div className="break-inside-avoid">
            <h2 className="text-xl font-semibold mb-3">Assumptions Summary</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Professional Fees (% of Base Build):</span>
                <span className="font-medium">{formatPercent(inputs.professionalFeesPercent)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Marketing & Sales (% of GDV):</span>
                <span className="font-medium">{formatPercent(inputs.marketingSalesPercent)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Contingency (% of Build Stack):</span>
                <span className="font-medium">{formatPercent(inputs.contingencyPercent)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Finance Rate (Annual %):</span>
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
                <span className="text-muted-foreground">Land Cost:</span>
                <span className="font-medium">{formatCurrency(inputs.landCost)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">VAT Enabled:</span>
                <span className="font-medium">{inputs.vatEnabled ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Risks & Comments */}
          <div className="break-inside-avoid">
            <h2 className="text-xl font-semibold mb-3">Risks & Comments</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Planning Considerations</Label>
                <Textarea
                  placeholder="Add planning notes, constraints, or opportunities..."
                  value={planningConsiderations}
                  onChange={(e) => setPlanningConsiderations(e.target.value)}
                  className="print:border-0 print:min-h-0 print:p-0 mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Utilities / Abnormals</Label>
                <Textarea
                  placeholder="Add notes on utilities, abnormal costs, or site conditions..."
                  value={utilitiesAbnormals}
                  onChange={(e) => setUtilitiesAbnormals(e.target.value)}
                  className="print:border-0 print:min-h-0 print:p-0 mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Market Commentary</Label>
                <Textarea
                  placeholder="Add market insights, comparable sales, or demand analysis..."
                  value={marketCommentary}
                  onChange={(e) => setMarketCommentary(e.target.value)}
                  className="print:border-0 print:min-h-0 print:p-0 mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Exit Strategy Summary</Label>
                <Textarea
                  placeholder="Add exit strategy, sales phasing, or timeline notes..."
                  value={exitStrategy}
                  onChange={(e) => setExitStrategy(e.target.value)}
                  className="print:border-0 print:min-h-0 print:p-0 mt-1"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            <p>Generated by BuildFlow Feasibility Dashboard</p>
            <p>{new Date().toLocaleString('en-GB')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LenderSummaryPack;
