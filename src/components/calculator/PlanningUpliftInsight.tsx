import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, TrendingUp } from "lucide-react";
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

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="shadow-medium">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Planning Uplift Insight
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm text-muted-foreground">RLV (from GDV)</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(rlv)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Auto-filled from calculator</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="current-value-type" className="text-sm font-medium">
                  Current Value (EUV)
                </Label>
                <Select
                  value={data.currentValueType}
                  onValueChange={(value: any) => 
                    onChange({ ...data, currentValueType: value, currentValueOverride: undefined })
                  }
                >
                  <SelectTrigger id="current-value-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Agricultural">Agricultural (£25k/ha)</SelectItem>
                    <SelectItem value="Brownfield">Brownfield (£150k/ha)</SelectItem>
                    <SelectItem value="Industrial">Industrial (£300k/ha)</SelectItem>
                    <SelectItem value="Yard">Yard (£200k/ha)</SelectItem>
                    <SelectItem value="Custom">Custom Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {data.currentValueType === "Custom" && (
                <div className="space-y-2">
                  <Label htmlFor="custom-value" className="text-sm font-medium">
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
                  />
                </div>
              )}

              <div className="p-2 rounded bg-muted">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Site Area: {siteAreaHa.toFixed(2)} ha</span>
                  <span className="font-medium">EUV: {formatCurrency(currentValue)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="planning-costs" className="text-sm font-medium">
                  Planning Costs (£)
                </Label>
                <Input
                  id="planning-costs"
                  type="number"
                  value={data.planningCosts}
                  onChange={(e) => 
                    onChange({ ...data, planningCosts: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <Label htmlFor="probability" className="text-sm font-medium">
                    Success Probability
                  </Label>
                  <span className="text-sm font-semibold text-primary">
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
                  className="py-2"
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Gross Uplift</span>
                  <span className="text-lg font-semibold">
                    {formatCurrency(grossUplift)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  RLV − EUV − Planning Costs
                </div>
              </div>

              <div className={`p-3 rounded-lg ${adjustedUplift > 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-medium">Adjusted Uplift</span>
                  <span className={`text-xl font-bold ${adjustedUplift > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatCurrency(adjustedUplift)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Gross Uplift × {data.successProbability}% probability
                </div>
              </div>
            </div>

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
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Include in Lender Pack
              </Label>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
