import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Settings } from "lucide-react";
import { GlobalInputs as GlobalInputsType } from "@/types/calculator";

interface GlobalInputsProps {
  inputs: GlobalInputsType;
  onChange: (inputs: GlobalInputsType) => void;
  totalUnits?: number;
}

const GlobalInputs = ({ inputs, onChange, totalUnits = 0 }: GlobalInputsProps) => {
  const [isSitePrepOpen, setIsSitePrepOpen] = useState(false);
  
  const updateInput = (key: keyof GlobalInputsType, value: number | boolean | string) => {
    onChange({ ...inputs, [key]: value });
  };
  
  const sitePrepFields = [
    { key: 'demolitionClearance' as const, label: 'Demolition / Site Clearance', desc: 'Existing structures, hardstanding removal' },
    { key: 'ecologyEnvironmental' as const, label: 'Ecology / Environmental', desc: 'Surveys, biodiversity net gain, mitigation' },
    { key: 'groundInvestigation' as const, label: 'Ground Investigation / Surveys', desc: 'SI, topo, contamination, drainage' },
    { key: 'planningStatutoryFees' as const, label: 'Planning / Statutory Fees', desc: 'Application fees, building regs' },
    { key: 'serviceConnections' as const, label: 'Service Connections', desc: 'Gas, electric, water, BT, drainage' },
    { key: 'abnormals' as const, label: 'Abnormals', desc: 'Retaining walls, piling, diversions' },
    { key: 'siteSecurity' as const, label: 'Site Security & Welfare', desc: 'Fencing, CCTV, WC, compounds' },
    { key: 'miscellaneousAllowance' as const, label: 'Miscellaneous Allowance', desc: 'Unforeseen pre-build costs' },
  ];
  
  const sitePrepTotal = sitePrepFields.reduce((sum, field) => {
    let value = inputs[field.key] || 0;
    if (field.key === 'abnormals' && inputs.abnormalsPercentEnabled && value === 0) {
      // Calculate from build cost if available (rough estimate based on 220m² * 1650/m² * units)
      const estimatedBuildCost = totalUnits * 220 * 1650;
      value = estimatedBuildCost * (inputs.abnormalsPercent / 100);
    }
    return sum + value;
  }, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-muted/30 rounded-lg mb-6">
      <div className="space-y-2">
        <Label htmlFor="profFees" className="text-sm font-medium">
          Professional Fees %
        </Label>
        <Input
          id="profFees"
          type="number"
          min="5"
          max="15"
          step="0.5"
          value={inputs.professionalFeesPercent}
          onChange={(e) => updateInput("professionalFeesPercent", parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="marketing" className="text-sm font-medium">
          Marketing & Sales % (of GDV)
        </Label>
        <Input
          id="marketing"
          type="number"
          min="1"
          max="4"
          step="0.5"
          value={inputs.marketingSalesPercent}
          onChange={(e) => updateInput("marketingSalesPercent", parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contingency" className="text-sm font-medium">
          Contingency % (of Build)
        </Label>
        <Input
          id="contingency"
          type="number"
          min="5"
          max="10"
          step="0.5"
          value={inputs.contingencyPercent}
          onChange={(e) => updateInput("contingencyPercent", parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="finance" className="text-sm font-medium">
          Finance % (staged)
        </Label>
        <Input
          id="finance"
          type="number"
          min="5"
          max="12"
          step="0.5"
          value={inputs.financePercent}
          onChange={(e) => updateInput("financePercent", parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="s106" className="text-sm font-medium">
          S106 / CIL / Other (£)
        </Label>
        <Input
          id="s106"
          type="number"
          min="0"
          value={inputs.s106CIL}
          onChange={(e) => updateInput("s106CIL", parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="landCost" className="text-sm font-medium">
          Land Cost (£)
        </Label>
        <Input
          id="landCost"
          type="number"
          min="0"
          value={inputs.landCost}
          onChange={(e) => updateInput("landCost", parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetMargin" className="text-sm font-medium">
          Target Margin % (on GDV)
        </Label>
        <Input
          id="targetMargin"
          type="number"
          min="15"
          max="25"
          step="0.5"
          value={inputs.targetMarginPercent}
          onChange={(e) => updateInput("targetMarginPercent", parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="siteArea" className="text-sm font-medium">
          Site Area (m²)
        </Label>
        <Input
          id="siteArea"
          type="number"
          min="0"
          value={inputs.siteArea}
          onChange={(e) => updateInput("siteArea", parseFloat(e.target.value) || 0)}
          className="text-sm"
          placeholder="From map or manual entry"
        />
        {inputs.siteArea > 0 && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {(inputs.siteArea / 10000).toFixed(2)} hectares
            </p>
            {totalUnits > 0 && inputs.siteArea > 0 && (
              <Badge variant="secondary" className="text-xs">
                {((totalUnits / (inputs.siteArea / 10000)).toFixed(0))} dph
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="vat"
          checked={inputs.vatEnabled}
          onCheckedChange={(checked) => updateInput("vatEnabled", checked)}
        />
        <Label htmlFor="vat" className="text-sm font-medium cursor-pointer">
          Include VAT (20%)
        </Label>
      </div>
      
      {/* Site Prep & Technical Costs - Collapsible */}
      <div className="md:col-span-2 lg:col-span-4">
        <Collapsible open={isSitePrepOpen} onOpenChange={setIsSitePrepOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Site Preparation & Technical Costs</span>
              {sitePrepTotal > 0 && (
                <Badge variant="secondary" className="ml-2">
                  £{sitePrepTotal.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Badge>
              )}
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${isSitePrepOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/20 rounded-lg">
              {sitePrepFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key} className="text-sm font-medium">
                    {field.label}
                  </Label>
                  <Input
                    id={field.key}
                    type="number"
                    min="0"
                    value={inputs[field.key]}
                    onChange={(e) => updateInput(field.key, parseFloat(e.target.value) || 0)}
                    className="text-sm"
                    placeholder="£0"
                  />
                  <p className="text-xs text-muted-foreground">{field.desc}</p>
                </div>
              ))}
              
              {/* Abnormals % toggle */}
              <div className="space-y-2 md:col-span-2 lg:col-span-3 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="abnormalsPercent"
                    checked={inputs.abnormalsPercentEnabled}
                    onCheckedChange={(checked) => updateInput("abnormalsPercentEnabled", checked)}
                  />
                  <Label htmlFor="abnormalsPercent" className="text-sm font-medium cursor-pointer">
                    Include Abnormals Allowance (% of Build)
                  </Label>
                </div>
                {inputs.abnormalsPercentEnabled && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="abnormalsPercentValue" className="text-sm">
                      Abnormals % (default 5%)
                    </Label>
                    <Input
                      id="abnormalsPercentValue"
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={inputs.abnormalsPercent}
                      onChange={(e) => updateInput("abnormalsPercent", parseFloat(e.target.value) || 5)}
                      className="text-sm w-32"
                    />
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export default GlobalInputs;
