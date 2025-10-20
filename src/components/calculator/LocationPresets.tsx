import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Download, X, Info, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { REGION_PRESETS, UK_REGIONS } from "@/types/locationPresets";
import { GlobalInputs, PropertyRow } from "@/types/calculator";
import { toast } from "sonner";
import { PresetDiffModal } from "./PresetDiffModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface LocationPresetsProps {
  onApply: (updatedRows: PropertyRow[], updatedInputs: GlobalInputs, presetInfo: { region: string; spec: "low" | "medium" | "high"; appliedAt: string }) => void;
  currentRows: PropertyRow[];
  currentInputs: GlobalInputs;
  projectLocation?: string;
  detectedRegion?: string;
  collapsed?: boolean;
}

export const LocationPresets = ({
  onApply,
  currentRows,
  currentInputs,
  projectLocation,
  detectedRegion,
  collapsed = true,
}: LocationPresetsProps) => {
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [selectedRegion, setSelectedRegion] = useState<string>(detectedRegion || "");
  const [selectedSpec, setSelectedSpec] = useState<"low" | "medium" | "high">("medium");
  const [showDiffModal, setShowDiffModal] = useState(false);

  const preset = selectedRegion ? REGION_PRESETS[selectedRegion] : null;

  const handlePreviewApply = () => {
    if (!preset || currentRows.length === 0) {
      toast.error("Please add property rows in GDV first");
      return;
    }
    setShowDiffModal(true);
  };

  const handleApply = (createScenario: boolean) => {
    if (!preset) return;

    // Update rows with new sales and build values
    const updatedRows = currentRows.map((row) => {
      const salesPerSqm = preset.salesPerSqm[row.type as keyof typeof preset.salesPerSqm];
      const buildPerSqm = preset.buildPerSqm[selectedSpec];

      return {
        ...row,
        salesValue: salesPerSqm ? salesPerSqm * row.giaPerUnit * row.units : row.salesValue,
        buildPerSqm: buildPerSqm || row.buildPerSqm,
      };
    });

    // Update inputs with new fees
    const updatedInputs: GlobalInputs = {
      ...currentInputs,
      professionalFeesPercent: preset.fees.professionalFeesPercent,
      marketingSalesPercent: preset.fees.marketingSalesPercent,
      contingencyPercent: preset.fees.contingencyPercent,
    };

    const presetInfo = {
      region: selectedRegion,
      spec: selectedSpec,
      appliedAt: new Date().toISOString(),
    };
    
    onApply(updatedRows, updatedInputs, presetInfo);
    
    const mode = createScenario ? " as new scenario" : "";
    toast.success(`Applied ${selectedRegion} – ${selectedSpec.charAt(0).toUpperCase() + selectedSpec.slice(1)} defaults${mode}`, {
      description: "You can edit any value in GDV.",
      duration: 5000,
    });
  };

  // Prepare proposed values for diff modal
  const proposedRows = currentRows.map((row) => {
    const salesPerSqm = preset?.salesPerSqm[row.type as keyof typeof preset.salesPerSqm];
    const buildPerSqm = preset?.buildPerSqm[selectedSpec];

    return {
      ...row,
      salesValue: salesPerSqm ? salesPerSqm * row.giaPerUnit * row.units : row.salesValue,
      buildPerSqm: buildPerSqm || row.buildPerSqm,
    };
  });

  const proposedInputs: GlobalInputs = preset ? {
    ...currentInputs,
    professionalFeesPercent: preset.fees.professionalFeesPercent,
    marketingSalesPercent: preset.fees.marketingSalesPercent,
    contingencyPercent: preset.fees.contingencyPercent,
  } : currentInputs;

  return (
    <>
      <Card className="border-primary/20">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <CardTitle className="text-base">📍 Location: {detectedRegion || "Not detected"}</CardTitle>
                    {selectedRegion && (
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {selectedRegion} – {selectedSpec.charAt(0).toUpperCase() + selectedSpec.slice(1)}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </CollapsibleTrigger>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(true);
                  }}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Change
                </Button>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviewApply();
                  }}
                  disabled={!preset || currentRows.length === 0}
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Apply to GDV
                </Button>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
        {/* Selection Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Region</label>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger>
                <SelectValue placeholder="Select region..." />
              </SelectTrigger>
              <SelectContent>
                {UK_REGIONS.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Build Spec</label>
            <Select value={selectedSpec} onValueChange={(v) => setSelectedSpec(v as "low" | "medium" | "high")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (Volume)</SelectItem>
                <SelectItem value="medium">Medium (Standard)</SelectItem>
                <SelectItem value="high">High (Premium)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preview */}
        {preset && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Preset Preview</h4>
            </div>

            {/* Sales Values */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Sales £/m² by type:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span>2-Bed Semi:</span>
                  <span className="font-medium">£{preset.salesPerSqm["2-Bed Semi"].toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>3-Bed Semi:</span>
                  <span className="font-medium">£{preset.salesPerSqm["3-Bed Semi"].toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>3-Bed Det:</span>
                  <span className="font-medium">£{preset.salesPerSqm["3-Bed Detached"].toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>4-Bed Det:</span>
                  <span className="font-medium">£{preset.salesPerSqm["4-Bed Detached"].toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>2-Bed Bungalow:</span>
                  <span className="font-medium">£{preset.salesPerSqm["2-Bed Bungalow"].toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>3-Bed Bungalow:</span>
                  <span className="font-medium">£{preset.salesPerSqm["3-Bed Bungalow"].toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Build Costs */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Build Cost £/m²:</p>
              <div className="flex gap-4 text-xs">
                <Badge variant={selectedSpec === "low" ? "default" : "outline"}>
                  Low: £{preset.buildPerSqm.low.toLocaleString()}
                </Badge>
                <Badge variant={selectedSpec === "medium" ? "default" : "outline"}>
                  Medium: £{preset.buildPerSqm.medium.toLocaleString()}
                </Badge>
                <Badge variant={selectedSpec === "high" ? "default" : "outline"}>
                  High: £{preset.buildPerSqm.high.toLocaleString()}
                </Badge>
              </div>
            </div>

            {/* Fees */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Fees & Contingency:</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Professional:</span>
                  <span className="font-medium">{preset.fees.professionalFeesPercent}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Marketing:</span>
                  <span className="font-medium">{preset.fees.marketingSalesPercent}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Contingency:</span>
                  <span className="font-medium">{preset.fees.contingencyPercent}%</span>
                </div>
              </div>
            </div>

            {/* Typical Ranges */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Typical cost ranges:</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Planning/BC:</span>
                  <span className="text-muted-foreground">{preset.typicalRanges.planning}</span>
                </div>
                <div className="flex justify-between">
                  <span>Utilities:</span>
                  <span className="text-muted-foreground">{preset.typicalRanges.utilities}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ecology:</span>
                  <span className="text-muted-foreground">{preset.typicalRanges.ecology}</span>
                </div>
              </div>
            </div>
          </div>
        )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handlePreviewApply}
                  disabled={!preset || currentRows.length === 0}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Apply to GDV
                </Button>
              </div>

              {/* Future Feature */}
              <Button variant="ghost" size="sm" className="w-full" disabled>
                <Info className="h-4 w-4 mr-2" />
                Fetch Market Data (Beta) – Coming Soon
              </Button>

              <p className="text-xs text-muted-foreground">
                Applied values can be edited manually. Preview shows changes before applying.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Diff Modal */}
      <PresetDiffModal
        open={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        onApply={handleApply}
        currentRows={currentRows}
        proposedRows={proposedRows}
        currentInputs={currentInputs}
        proposedInputs={proposedInputs}
        region={selectedRegion}
        spec={selectedSpec}
      />
    </>
  );
};
