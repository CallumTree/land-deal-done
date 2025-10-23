import { useState } from "react";
import { PropertyRow } from "@/types/calculator";
import { REGION_PRESETS, UK_REGIONS, RegionPreset } from "@/types/locationPresets";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { AlertCircle, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/utils/calculatorHelpers";

interface MarketCalibrationProps {
  rows: PropertyRow[];
  onApply: (rows: PropertyRow[]) => void;
  onClose: () => void;
}

const MarketCalibration = ({ rows, onApply, onClose }: MarketCalibrationProps) => {
  const { toast } = useToast();
  const [selectedRegion, setSelectedRegion] = useState<string>(UK_REGIONS[0]);
  const [selectedSpec, setSelectedSpec] = useState<"low" | "medium" | "high">("medium");
  const [localityMultiplier, setLocalityMultiplier] = useState<number>(1.0);
  const [useSizeCurve, setUseSizeCurve] = useState<boolean>(false);
  const [smallThreshold, setSmallThreshold] = useState<number>(85);
  const [largeThreshold, setLargeThreshold] = useState<number>(120);
  const [sizeAdjustment, setSizeAdjustment] = useState<number>(5);

  const getRegionPreset = (): RegionPreset | null => {
    const key = `${selectedRegion}-${selectedSpec}`;
    return REGION_PRESETS[key] || null;
  };

  const calculateAdjustedPrice = (row: PropertyRow, preset: RegionPreset): { saleValuePerUnit: number; salePpm2: number; warning: boolean } => {
    const gia = row.gia_m2_per_unit || row.giaPerUnit || 0;
    if (gia === 0) return { saleValuePerUnit: 0, salePpm2: 0, warning: false };

    // Get base £/m² from preset for this property type
    let basePpm2 = preset.salesPerSqm[row.type] || preset.salesPerSqm["3-Bed Semi"] || 3000;

    // Apply locality multiplier
    basePpm2 = basePpm2 * localityMultiplier;

    // Apply size curve if enabled
    if (useSizeCurve) {
      if (gia < smallThreshold) {
        basePpm2 = basePpm2 * (1 + sizeAdjustment / 100);
      } else if (gia > largeThreshold) {
        basePpm2 = basePpm2 * (1 - sizeAdjustment / 100);
      }
    }

    const saleValuePerUnit = basePpm2 * gia;

    // Check if outside preset band (±15%)
    const presetBandMid = preset.salesPerSqm[row.type] || preset.salesPerSqm["3-Bed Semi"] || 3000;
    const deviation = Math.abs((basePpm2 - presetBandMid) / presetBandMid);
    const warning = deviation > 0.15;

    return { saleValuePerUnit, salePpm2: basePpm2, warning };
  };

  const previewResults = () => {
    const preset = getRegionPreset();
    if (!preset) return [];

    return rows.map(row => {
      const current = {
        gia: row.gia_m2_per_unit || row.giaPerUnit || 0,
        saleValue: row.sale_value_per_unit || row.salesValue || 0,
        salePpm2: row.sale_ppm2 || (row.giaPerUnit > 0 ? row.salesValue / row.giaPerUnit : 0),
      };
      
      const adjusted = calculateAdjustedPrice(row, preset);

      return {
        type: row.type,
        units: row.units,
        current,
        adjusted,
      };
    });
  };

  const handleApply = () => {
    const preset = getRegionPreset();
    if (!preset) {
      toast({
        title: "Error",
        description: "Please select a valid region and spec",
        variant: "destructive",
      });
      return;
    }

    const updatedRows = rows.map(row => {
      const { saleValuePerUnit, salePpm2 } = calculateAdjustedPrice(row, preset);
      const gia = row.gia_m2_per_unit || row.giaPerUnit || 0;

      return {
        ...row,
        // Update both legacy and new fields
        salesValue: saleValuePerUnit,
        giaPerUnit: gia,
        sale_value_per_unit: saleValuePerUnit,
        sale_ppm2: salePpm2,
        gia_m2_per_unit: gia,
        priceSource: {
          region: selectedRegion,
          spec: selectedSpec,
          localityMultiplier,
          appliedAt: new Date().toISOString(),
        },
      };
    });

    onApply(updatedRows);
    toast({
      title: "Market Calibration Applied",
      description: `Sales prices updated using ${selectedRegion} - ${selectedSpec} spec`,
    });
    onClose();
  };

  const preview = previewResults();
  const preset = getRegionPreset();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Region Selection */}
        <div className="space-y-2">
          <Label>Region / Local Authority</Label>
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UK_REGIONS.map(region => (
                <SelectItem key={region} value={region}>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {region}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Spec Selection */}
        <div className="space-y-2">
          <Label>Spec Level</Label>
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

      {/* Locality Multiplier */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Locality Multiplier</Label>
          <span className="text-sm font-mono font-semibold">{localityMultiplier.toFixed(2)}×</span>
        </div>
        <Slider
          value={[localityMultiplier]}
          onValueChange={(v) => setLocalityMultiplier(v[0])}
          min={0.85}
          max={1.15}
          step={0.01}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Adjust for micro-market variations within the region (0.85 = −15%, 1.15 = +15%)
        </p>
      </div>

      {/* Size Curve Toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="size-curve">Apply Size Curve</Label>
          <Switch
            id="size-curve"
            checked={useSizeCurve}
            onCheckedChange={setUseSizeCurve}
          />
        </div>
        {useSizeCurve && (
          <div className="pl-4 space-y-3 border-l-2 border-primary/20">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Small Unit Threshold (m²)</Label>
                <input
                  type="number"
                  value={smallThreshold}
                  onChange={(e) => setSmallThreshold(parseFloat(e.target.value))}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Large Unit Threshold (m²)</Label>
                <input
                  type="number"
                  value={largeThreshold}
                  onChange={(e) => setLargeThreshold(parseFloat(e.target.value))}
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Size Adjustment (%)</Label>
              <input
                type="number"
                value={sizeAdjustment}
                onChange={(e) => setSizeAdjustment(parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-sm border rounded"
              />
              <p className="text-xs text-muted-foreground">
                Units &lt;{smallThreshold}m²: +{sizeAdjustment}% | Units &gt;{largeThreshold}m²: −{sizeAdjustment}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {preset && (
        <Card className="p-4">
          <h4 className="font-semibold mb-3">Preview Changes</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {preview.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm p-2 rounded border">
                <div className="flex-1">
                  <div className="font-medium">{item.type} ({item.units} units)</div>
                  <div className="text-xs text-muted-foreground">
                    {item.current.gia.toFixed(1)}m² each
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Current</div>
                    <div className="font-mono">{formatCurrency(item.current.saleValue)}</div>
                    <div className="text-xs">£{item.current.salePpm2.toFixed(0)}/m²</div>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Adjusted</div>
                    <div className="font-mono font-semibold">{formatCurrency(item.adjusted.saleValuePerUnit)}</div>
                    <div className="text-xs font-semibold">£{item.adjusted.salePpm2.toFixed(0)}/m²</div>
                    {item.adjusted.warning && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-xs">Outside band</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            <strong>Source:</strong> {selectedRegion} – {selectedSpec} spec (Q4-2025) × {localityMultiplier.toFixed(2)}
            {useSizeCurve && ` + size curve (±${sizeAdjustment}%)`}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleApply} variant="default">
          Apply to GDV Table
        </Button>
      </div>
    </div>
  );
};

export default MarketCalibration;
