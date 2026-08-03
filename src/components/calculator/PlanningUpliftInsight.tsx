import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, TrendingUp, Info } from "lucide-react";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";
import { PlanningUpliftData } from "@/types/calculator";

interface PlanningUpliftInsightProps {
  rlv: number;
  siteArea: number;
  data: PlanningUpliftData;
  onChange: (data: PlanningUpliftData) => void;
}

const EUV_PRESETS: Record<string, number> = {
  Agricultural: 25000, // £25k per hectare
  Brownfield: 150000,  // £150k per hectare
  Industrial: 300000,  // £300k per hectare
  Yard: 200000,        // £200k per hectare
};

export const PlanningUpliftInsight = ({ rlv, siteArea, data, onChange }: PlanningUpliftInsightProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const siteAreaHa = siteArea / 10000;
  
  const getCurrentValue = () => {
    if (data.currentValueType === "Custom" && data.currentValueOverride) {
      return data.currentValueOverride;
    }
    return EUV_PRESETS[data.currentValueType] * siteAreaHa;
  };

  const currentValue = getCurrentValue();
  const grossUplift = rlv - currentValue - data.planningCosts;
  const adjustedUplift = grossUplift * (data.successProbability / 100);

  // Empty state check
  const hasValidRLV = rlv > 0;

  return (
    <TooltipProvider>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="shadow-soft rounded-lg">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors p-5">
              <CardTitle className="text-[15px] font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Planning Uplift Insight (Optional)
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-0 px-5 pb-5">
              {!hasValidRLV ? (
                <div className="p-4 rounded-lg bg-muted/30 border border-border text-center">
                  <p className="text-sm text-muted-foreground">
                    Once your GDV is complete, BuildFlow can estimate your planning uplift potential here.
                  </p>
                </div>
              ) : (
                <>
                  {/* RLV (auto-filled) */}
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] text-muted-foreground">
                          RLV (from GDV)
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px]">
                            <p className="text-xs">Land value post-planning, automatically derived from your GDV scenario.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(rlv)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Auto-filled from calculator</p>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border my-4" />

                  {/* Existing Land Value (EUV) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="current-value-type" className="text-[13px] font-medium">
                        Existing Land Value (EUV)
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px]">
                          <p className="text-xs">Estimated current market value before planning consent.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={data.currentValueType}
                      onValueChange={(value: any) => 
                        onChange({ ...data, currentValueType: value, currentValueOverride: undefined })
                      }
                    >
                      <SelectTrigger id="current-value-type" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="Agricultural">Agricultural (£25k/ha)</SelectItem>
                        <SelectItem value="Brownfield">Brownfield (£150k/ha)</SelectItem>
                        <SelectItem value="Industrial">Industrial (£300k/ha)</SelectItem>
                        <SelectItem value="Yard">Yard (£200k/ha)</SelectItem>
                        <SelectItem value="Custom">Custom Value</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {data.currentValueType === "Custom" && (
                    <div className="space-y-2.5">
                      <Label htmlFor="custom-value" className="text-[13px] font-medium">
                        Custom EUV (£)
                      </Label>
                      <Input
                        id="custom-value"
                        type="number"
                        value={data.currentValueOverride || 0}
                        onChange={(e) => 
                          onChange({ ...data, currentValueOverride: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="Enter custom value"
                        className="h-9"
                      />
                    </div>
                  )}

                  <div className="p-2.5 rounded bg-muted/50">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Site Area: {siteAreaHa.toFixed(2)} ha</span>
                      <span className="font-medium">EUV: {formatCurrency(currentValue)}</span>
                    </div>
                  </div>

                  {/* Planning Costs */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="planning-costs" className="text-[13px] font-medium">
                        Planning Costs (£)
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[240px]">
                          <p className="text-xs">Includes all professional, application, and technical fees to secure planning.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="planning-costs"
                      type="number"
                      value={data.planningCosts}
                      onChange={(e) => 
                        onChange({ ...data, planningCosts: parseFloat(e.target.value) || 0 })
                      }
                      className="h-9"
                    />
                  </div>

                  {/* Chance of Planning Success */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="probability" className="text-[13px] font-medium">
                          Chance of Planning Success (%)
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px]">
                            <p className="text-xs">Estimated probability of gaining consent. Adjust based on site or authority risk.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-[13px] font-semibold text-primary">
                        {data.successProbability}%
                      </span>
                    </div>
                    <Slider
                      id="probability"
                      min={0}
                      max={100}
                      step={5}
                      value={[data.successProbability]}
                      onValueChange={(value) => 
                        onChange({ ...data, successProbability: value[0] })
                      }
                      className="py-2 w-full"
                    />
                    {/* Visual bar under slider */}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-success transition-all duration-300"
                          style={{ width: `${data.successProbability}%` }}
                        />
                      </div>
                      <span>Risk-adjusted ({data.successProbability}%)</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border my-4" />

                  {/* Gross Uplift */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] text-muted-foreground">
                          Gross Uplift
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px]">
                            <p className="text-xs">Calculated as RLV − EUV − Planning Costs.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-base font-semibold text-foreground">
                        {formatCurrency(grossUplift)}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      RLV − EUV − Planning Costs
                    </div>
                  </div>

                  {/* Adjusted Uplift with animation */}
                  <div 
                    className={`p-3.5 rounded-lg transition-all duration-400 ${
                      adjustedUplift > 0
                        ? 'bg-success/10 border border-success/30'
                        : 'bg-warning/10 border border-warning/30'
                    }`}
                    key={adjustedUplift} // Key change triggers re-mount for animation
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-foreground">
                          Adjusted Uplift
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px]">
                            <p className="text-xs">Gross uplift adjusted for planning success probability.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span 
                        className={`text-xl font-bold animate-in fade-in duration-400 ${
                          adjustedUplift > 0 ? 'text-success' : 'text-warning'
                        }`}
                        style={{ 
                          animation: 'fadeInGlow 0.4s ease-out',
                        }}
                      >
                        {formatCurrency(adjustedUplift)}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Gross Uplift × {data.successProbability}% probability
                    </div>
                  </div>

                  {/* Checkbox - moved directly below Adjusted Uplift */}
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="include-lender"
                      checked={data.includeInLenderPack}
                      onCheckedChange={(checked) => 
                        onChange({ ...data, includeInLenderPack: !!checked })
                      }
                    />
                    <Label
                      htmlFor="include-lender"
                      className="text-[13px] font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                     
                    >
                      Include in Lender Pack
                    </Label>
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <style>{`
        @keyframes fadeInGlow {
          0% {
            opacity: 0.6;
            filter: drop-shadow(0 0 8px hsl(var(--success) / 0.4));
          }
          100% {
            opacity: 1;
            filter: drop-shadow(0 0 0 hsl(var(--success) / 0));
          }
        }
      `}</style>
    </TooltipProvider>
  );
};
