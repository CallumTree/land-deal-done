import { useState } from "react";
import { SensitivityAdjustments, DEFAULT_SENSITIVITY, SENSITIVITY_PRESETS } from "@/types/sensitivity";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, RotateCcw } from "lucide-react";

interface MarketSensitivityPanelProps {
  adjustments: SensitivityAdjustments;
  onChange: (adjustments: SensitivityAdjustments) => void;
  onReset: () => void;
  onGenerateReport: () => void;
}

const MarketSensitivityPanel = ({
  adjustments,
  onChange,
  onReset,
  onGenerateReport,
}: MarketSensitivityPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const isActive = Object.entries(adjustments).some(([key, value]) => value !== 0);

  const applyPreset = (presetName: string) => {
    const preset = SENSITIVITY_PRESETS[presetName as keyof typeof SENSITIVITY_PRESETS];
    if (preset) {
      onChange(preset);
    }
  };

  const updateAdjustment = (field: keyof SensitivityAdjustments, value: number) => {
    onChange({ ...adjustments, [field]: value });
  };

  return (
    <div className="mb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className={`rounded-lg border transition-all ${isActive ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">Market Sensitivity</h3>
                {isActive && (
                  <span className="px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full">
                    Active
                  </span>
                )}
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="p-4 pt-0 space-y-6">
              {/* Quick Presets */}
              <div>
                <p className="text-sm text-muted-foreground mb-3">Quick Presets</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(SENSITIVITY_PRESETS).map((presetName) => (
                    <Button
                      key={presetName}
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(presetName)}
                      className="text-sm"
                    >
                      {presetName}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Manual Sliders */}
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">Manual Adjustments</p>

                {/* Sales Value */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Sales Value</label>
                    <span className={`text-sm font-semibold ${adjustments.salesValuePercent > 0 ? 'text-green-600' : adjustments.salesValuePercent < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {adjustments.salesValuePercent > 0 ? '+' : ''}{adjustments.salesValuePercent}%
                    </span>
                  </div>
                  <Slider
                    value={[adjustments.salesValuePercent]}
                    onValueChange={([value]) => updateAdjustment('salesValuePercent', value)}
                    min={-30}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Build Cost */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Build Cost</label>
                    <span className={`text-sm font-semibold ${adjustments.buildCostPercent > 0 ? 'text-red-600' : adjustments.buildCostPercent < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {adjustments.buildCostPercent > 0 ? '+' : ''}{adjustments.buildCostPercent}%
                    </span>
                  </div>
                  <Slider
                    value={[adjustments.buildCostPercent]}
                    onValueChange={([value]) => updateAdjustment('buildCostPercent', value)}
                    min={-20}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Finance Rate */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Finance Rate</label>
                    <span className={`text-sm font-semibold ${adjustments.financeRatePercent > 0 ? 'text-red-600' : adjustments.financeRatePercent < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {adjustments.financeRatePercent > 0 ? '+' : ''}{adjustments.financeRatePercent}%
                    </span>
                  </div>
                  <Slider
                    value={[adjustments.financeRatePercent]}
                    onValueChange={([value]) => updateAdjustment('financeRatePercent', value)}
                    min={-5}
                    max={10}
                    step={0.5}
                    className="w-full"
                  />
                </div>

                {/* Contingency */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Contingency</label>
                    <span className={`text-sm font-semibold ${adjustments.contingencyPercent > 0 ? 'text-red-600' : adjustments.contingencyPercent < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {adjustments.contingencyPercent > 0 ? '+' : ''}{adjustments.contingencyPercent}%
                    </span>
                  </div>
                  <Slider
                    value={[adjustments.contingencyPercent]}
                    onValueChange={([value]) => updateAdjustment('contingencyPercent', value)}
                    min={-10}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Programme Delay */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Programme Delay</label>
                    <span className={`text-sm font-semibold ${adjustments.programmeDelayMonths > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {adjustments.programmeDelayMonths} months
                    </span>
                  </div>
                  <Slider
                    value={[adjustments.programmeDelayMonths]}
                    onValueChange={([value]) => updateAdjustment('programmeDelayMonths', value)}
                    min={0}
                    max={12}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReset}
                  disabled={!isActive}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Base
                </Button>
                <Button
                  variant="cta"
                  size="sm"
                  onClick={onGenerateReport}
                  disabled={!isActive}
                >
                  Send to Lender Report
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};

export default MarketSensitivityPanel;
