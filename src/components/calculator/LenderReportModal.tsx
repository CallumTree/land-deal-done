import { useState } from "react";
import { CalculatedValues } from "@/types/calculator";
import { SensitivityAdjustments } from "@/types/sensitivity";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";

interface LenderReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseCase: CalculatedValues;
  adjustedCase: CalculatedValues;
  adjustments: SensitivityAdjustments;
}

const LenderReportModal = ({
  isOpen,
  onClose,
  baseCase,
  adjustedCase,
  adjustments,
}: LenderReportModalProps) => {
  const [notes, setNotes] = useState("");

  const getAdjustmentsSummary = () => {
    const parts = [];
    if (adjustments.salesValuePercent !== 0) {
      parts.push(`Sales ${adjustments.salesValuePercent > 0 ? '+' : ''}${adjustments.salesValuePercent}%`);
    }
    if (adjustments.buildCostPercent !== 0) {
      parts.push(`Build ${adjustments.buildCostPercent > 0 ? '+' : ''}${adjustments.buildCostPercent}%`);
    }
    if (adjustments.financeRatePercent !== 0) {
      parts.push(`Finance ${adjustments.financeRatePercent > 0 ? '+' : ''}${adjustments.financeRatePercent}%`);
    }
    if (adjustments.contingencyPercent !== 0) {
      parts.push(`Contingency ${adjustments.contingencyPercent > 0 ? '+' : ''}${adjustments.contingencyPercent}%`);
    }
    if (adjustments.programmeDelayMonths !== 0) {
      parts.push(`Delay +${adjustments.programmeDelayMonths} months`);
    }
    return parts.join(', ') || 'No adjustments';
  };

  const handleExport = () => {
    if (!canExportPDF) {
      toast.error("PDF export requires Pro tier or higher");
      return;
    }

    window.print();
  };

  const ComparisonRow = ({ 
    label, 
    baseValue, 
    adjustedValue, 
    isPercent = false 
  }: { 
    label: string; 
    baseValue: number; 
    adjustedValue: number; 
    isPercent?: boolean;
  }) => {
    const format = isPercent ? formatPercent : formatCurrency;
    const diff = adjustedValue - baseValue;
    const isNegative = diff < 0;
    
    return (
      <div className="grid grid-cols-3 gap-4 py-3 border-b">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-sm text-muted-foreground">{format(baseValue)}</div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${isNegative ? 'text-destructive' : 'text-success'}`}>
            {format(adjustedValue)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({isNegative ? '' : '+'}{format(diff)})
          </span>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Lender Report Summary</DialogTitle>
          <DialogDescription>
            Review your base case and market sensitivity analysis before exporting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Adjustments Applied */}
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm font-medium mb-1">Market Adjustments Applied</p>
            <p className="text-sm text-muted-foreground">{getAdjustmentsSummary()}</p>
          </div>

          {/* Comparison Table */}
          <div>
            <div className="grid grid-cols-3 gap-4 pb-2 border-b-2 border-border">
              <div className="text-sm font-semibold">Metric</div>
              <div className="text-sm font-semibold">Base Case</div>
              <div className="text-sm font-semibold">Adjusted Case</div>
            </div>

            <ComparisonRow 
              label="Total GDV" 
              baseValue={baseCase.totalGDV} 
              adjustedValue={adjustedCase.totalGDV} 
            />
            <ComparisonRow 
              label="Total Costs" 
              baseValue={baseCase.totalCosts} 
              adjustedValue={adjustedCase.totalCosts} 
            />
            <ComparisonRow 
              label="Net Profit" 
              baseValue={baseCase.netProfit} 
              adjustedValue={adjustedCase.netProfit} 
            />
            <ComparisonRow 
              label="Profit Margin" 
              baseValue={baseCase.profitMarginPercent} 
              adjustedValue={adjustedCase.profitMarginPercent}
              isPercent 
            />
            <ComparisonRow 
              label="Residual Land Value" 
              baseValue={baseCase.residualLandValue} 
              adjustedValue={adjustedCase.residualLandValue} 
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes for Lender (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Market stress test for lender pack - assumes 10% sales reduction and 15% build cost increase..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              variant="cta"
              onClick={handleExport}
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LenderReportModal;
