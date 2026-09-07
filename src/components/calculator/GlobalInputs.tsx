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
  hasPolygon?: boolean;
}

const GlobalInputs = ({ inputs, onChange, totalUnits = 0, hasPolygon = false }: GlobalInputsProps) => {
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-card/30 rounded-lg mb-6 border border-border">
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
        <div className="flex items-center justify-between">
          <Label htmlFor="siteArea" className="text-sm font-medium">
            Site Area (m²)
          </Label>
          {hasPolygon && (
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-300/70 dark:border-emerald-800 rounded px-1.5 py-0.5">
              from map
            </span>
          )}
        </div>
        <Input
          id="siteArea"
          type="number"
          min="0"
          value={inputs.siteArea > 0 ? inputs.siteArea : (hasPolygon ? 0 : "")}
          onChange={(e) => {
            if (!hasPolygon) {
              updateInput("siteArea", parseFloat(e.target.value) || 0);
            }
          }}
          readOnly={hasPolygon}
          className={`text-sm ${
            hasPolygon
              ? "bg-muted/50 text-muted-foreground cursor-not-allowed border-dashed focus-visible:ring-0 select-all"
              : ""
          }`}
          placeholder={hasPolygon ? "Defined by map boundary" : "From map or manual entry"}
          title={hasPolygon ? "Site area is read-only because it is calculated from the drawn map boundary" : undefined}
        />
        {inputs.siteArea > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-foreground/70">
              {(inputs.siteArea / 10000).toFixed(2)} hectares
            </span>
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
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-card/50 hover:bg-card transition-colors border border-border">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-foreground/70" />
              <span className="text-sm font-semibold text-foreground">Site Preparation & Technical Costs</span>
              {sitePrepTotal > 0 && (
                <Badge variant="secondary" className="ml-2">
                  £{sitePrepTotal.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Badge>
              )}
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${isSitePrepOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-card/20 rounded-lg border border-border">
              {sitePrepFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key} className="text-sm font-medium">
                    {field.label}
                  </Label>
                  <Input
                    id={field.key}
                    type="number"
                    min="0"
                    value={inputs[field.key] || 0}
                    onChange={(e) => updateInput(field.key, parseFloat(e.target.value) || 0)}
                    className="text-sm"
                    placeholder="£0"
                  />
                  <p className="text-xs text-foreground/60">{field.desc}</p>
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
