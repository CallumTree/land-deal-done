import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PropertyRow, GlobalInputs } from "@/types/calculator";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

interface PresetDiffModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (createScenario: boolean) => void;
  currentRows: PropertyRow[];
  proposedRows: PropertyRow[];
  currentInputs: GlobalInputs;
  proposedInputs: GlobalInputs;
  region: string;
  spec: string;
}

export const PresetDiffModal = ({
  open,
  onClose,
  onApply,
  currentRows,
  proposedRows,
  currentInputs,
  proposedInputs,
  region,
  spec,
}: PresetDiffModalProps) => {
  const [applyMode, setApplyMode] = useState<"scenario" | "overwrite">("scenario");

  const handleApply = () => {
    onApply(applyMode === "scenario");
    onClose();
  };

  // Compare fees
  const feeChanges = [
    { label: "Professional Fees", current: currentInputs.professionalFeesPercent, proposed: proposedInputs.professionalFeesPercent },
    { label: "Marketing/Sales", current: currentInputs.marketingSalesPercent, proposed: proposedInputs.marketingSalesPercent },
    { label: "Contingency", current: currentInputs.contingencyPercent, proposed: proposedInputs.contingencyPercent },
  ];

  // Get unique property types from current rows
  const typeChanges = currentRows.map((row) => {
    const proposedRow = proposedRows.find(r => r.id === row.id);
    if (!proposedRow) return null;
    
    return {
      type: row.type,
      currentSales: row.salesValue,
      proposedSales: proposedRow.salesValue,
      currentBuild: row.buildPerSqm,
      proposedBuild: proposedRow.buildPerSqm,
    };
  }).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview: {region} – {spec.charAt(0).toUpperCase() + spec.slice(1)} Preset</DialogTitle>
          <DialogDescription>
            Review the proposed changes before applying
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Fees Comparison */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Fees & Contingency</h4>
            <div className="space-y-2">
              {feeChanges.map((change) => (
                <div key={change.label} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                  <span className="text-muted-foreground">{change.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{change.current}%</span>
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <span className="font-bold text-primary">{change.proposed}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Property Types Comparison */}
          {typeChanges.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3">Sales & Build Costs (£/m²)</h4>
              <div className="space-y-3">
                {typeChanges.map((change, idx) => (
                  <div key={idx} className="p-3 rounded border border-border space-y-2">
                    <div className="font-medium text-sm">{change!.type}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Sales:</span>
                        <div className="flex items-center gap-1">
                          <span>£{(change!.currentSales / 1000).toFixed(0)}k</span>
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="font-bold text-primary">£{(change!.proposedSales / 1000).toFixed(0)}k</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Build:</span>
                        <div className="flex items-center gap-1">
                          <span>£{change!.currentBuild}</span>
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="font-bold text-primary">£{change!.proposedBuild}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Apply Mode Selection */}
          <div className="pt-4 border-t border-border">
            <RadioGroup value={applyMode} onValueChange={(v) => setApplyMode(v as "scenario" | "overwrite")}>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 rounded border border-border hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="scenario" id="scenario" />
                  <Label htmlFor="scenario" className="flex-1 cursor-pointer">
                    <div className="font-medium">Apply as Scenario Copy (Recommended)</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Creates: "Preset • {region} • {spec.charAt(0).toUpperCase() + spec.slice(1)} • {new Date().toLocaleDateString('en-GB')}"
                    </div>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded border border-border hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="overwrite" id="overwrite" />
                  <Label htmlFor="overwrite" className="flex-1 cursor-pointer">
                    <div className="font-medium">Overwrite Current</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Replace existing values directly (browser undo available)
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply}>Apply to GDV</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
