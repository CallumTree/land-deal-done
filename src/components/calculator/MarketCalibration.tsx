import { useState } from "react";
import { PropertyRow } from "@/types/calculator";
import { REGION_PRESETS, UK_REGIONS } from "@/types/locationPresets";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface MarketCalibrationProps {
  currentRows: PropertyRow[];
  onApply: (rows: PropertyRow[], source: { region: string; spec: "low" | "medium" | "high"; localityMultiplier: number }) => void;
}

export function MarketCalibration({ currentRows, onApply }: MarketCalibrationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSpec, setSelectedSpec] = useState<"low" | "medium" | "high">("medium");
  const [localityMultiplier, setLocalityMultiplier] = useState(1.0);
  const [applySizeCurve, setApplySizeCurve] = useState(true);

  const handleApply = () => {
    if (!selectedRegion) {
      toast.error("Please select a region");
      return;
    }

    const preset = REGION_PRESETS[selectedRegion];
    if (!preset) return;

    const updatedRows = currentRows.map(row => {
      const baseSalePpm2 = preset.salesPerSqm[row.type as keyof typeof preset.salesPerSqm] || row.sale_ppm2 || 0;
      let adjustedPpm2 = baseSalePpm2 * localityMultiplier;

      // Apply size curve if enabled
      if (applySizeCurve) {
        if (row.gia_m2_per_unit < 85) {
          adjustedPpm2 *= 1.05; // +5% for small units
        } else if (row.gia_m2_per_unit > 120) {
          adjustedPpm2 *= 0.95; // -5% for large units
        }
      }

      const saleValuePerUnit = adjustedPpm2 * row.gia_m2_per_unit;

      return {
        ...row,
        sale_value_per_unit: saleValuePerUnit,
        sale_ppm2: adjustedPpm2,
        priceSource: {
          region: selectedRegion,
          spec: selectedSpec,
          localityMultiplier,
          appliedAt: new Date().toISOString(),
        },
      };
    });

    onApply(updatedRows, { region: selectedRegion, spec: selectedSpec, localityMultiplier });
    toast.success(`Market calibration applied: ${selectedRegion} - ${selectedSpec}`);
  };

  const preset = selectedRegion ? REGION_PRESETS[selectedRegion] : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-4">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity">
            <div>
              <h3 className="text-lg font-semibold">Market Calibration</h3>
              <p className="text-sm text-muted-foreground">Align sales prices with local market data</p>
            </div>
            <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Region / Local Authority</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select region..." />
                </SelectTrigger>
                <SelectContent>
                  {UK_REGIONS.map(region => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Build Specification</Label>
              <Select value={selectedSpec} onValueChange={(v) => setSelectedSpec(v as "low" | "medium" | "high")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Locality Multiplier: {localityMultiplier.toFixed(2)}x</Label>
            <Slider
              value={[localityMultiplier]}
              onValueChange={(v) => setLocalityMultiplier(v[0])}
              min={0.85}
              max={1.15}
              step={0.01}
              className="py-2"
            />
            <p className="text-xs text-muted-foreground">
              Adjust for micro-market within region (0.85 = -15%, 1.15 = +15%)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="size-curve"
              checked={applySizeCurve}
              onCheckedChange={setApplySizeCurve}
            />
            <Label htmlFor="size-curve" className="cursor-pointer">
              Apply size curve (+5% &lt;85m², -5% &gt;120m²)
            </Label>
          </div>

          {preset && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <h4 className="text-sm font-semibold">Preview: {selectedRegion} - {selectedSpec}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">2-Bed Semi:</span>
                  <span className="ml-2 font-medium">£{Math.round(preset.salesPerSqm["2-Bed Semi"] * localityMultiplier)}/m²</span>
                </div>
                <div>
                  <span className="text-muted-foreground">3-Bed Semi:</span>
                  <span className="ml-2 font-medium">£{Math.round(preset.salesPerSqm["3-Bed Semi"] * localityMultiplier)}/m²</span>
                </div>
                <div>
                  <span className="text-muted-foreground">3-Bed Det:</span>
                  <span className="ml-2 font-medium">£{Math.round(preset.salesPerSqm["3-Bed Detached"] * localityMultiplier)}/m²</span>
                </div>
                <div>
                  <span className="text-muted-foreground">4-Bed Det:</span>
                  <span className="ml-2 font-medium">£{Math.round(preset.salesPerSqm["4-Bed Detached"] * localityMultiplier)}/m²</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Build cost ({selectedSpec}):</span>
                <span className="ml-2 text-xs font-medium">£{preset.buildPerSqm[selectedSpec]}/m²</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleApply} className="flex-1">
              Apply to All Rows
            </Button>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
