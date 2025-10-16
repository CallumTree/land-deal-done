import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { GlobalInputs as GlobalInputsType } from "@/types/calculator";

interface GlobalInputsProps {
  inputs: GlobalInputsType;
  onChange: (inputs: GlobalInputsType) => void;
  totalUnits?: number;
}

const GlobalInputs = ({ inputs, onChange, totalUnits = 0 }: GlobalInputsProps) => {
  const updateInput = (key: keyof GlobalInputsType, value: number | boolean) => {
    onChange({ ...inputs, [key]: value });
  };

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
    </div>
  );
};

export default GlobalInputs;
