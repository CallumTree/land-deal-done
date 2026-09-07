import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Download, Info, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { REGION_PRESETS, UK_REGIONS } from "@/types/locationPresets";
import { GlobalInputs, PropertyRow } from "@/types/calculator";
import { toast } from "sonner";
import { PresetDiffModal } from "./PresetDiffModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    if (!preset) {
      toast.error("Please select a UK region first");
      return;
    }
    if (currentRows.length === 0) {
      toast.error("Applied only after rows exist", {
        description: "Populate units first via Smart Layout on the map or enter them in the GDV Calculator, then return here to refresh their £/m² rates.",
      });
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
    toast.success(`Refreshed ${currentRows.length} rows with ${selectedRegion} (${selectedSpec} spec) £/m² benchmarks${mode}`, {
      description: "Sales values, build costs, and fee percentages updated. Edit any row to refine.",
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
                  <MapPin className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">Regional £/m² Benchmarks</CardTitle>
                      <Badge variant="outline" className="text-xs font-normal">
                        Manual Refresh Tool
                      </Badge>
                      {currentRows.length > 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          {currentRows.length} {currentRows.length === 1 ? 'row' : 'rows'} active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-800">
                          Applies after rows exist
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs mt-1">
                      Manually updates sales £/m², build £/m², and fee percentages on existing unit rows for {selectedRegion || detectedRegion || "a selected UK region"}.
                    </CardDescription>
                    {selectedRegion && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className="text-xs">
                          📍 {selectedRegion} • {selectedSpec.charAt(0).toUpperCase() + selectedSpec.slice(1)} Spec
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
                  Configure
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewApply();
                          }}
                          disabled={!preset || currentRows.length === 0}
                          size="sm"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Refresh £/m²
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {currentRows.length === 0 && (
                      <TooltipContent>
                        <p className="text-xs">Requires existing rows. Populate units first via Smart Layout or GDV Calculator.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              {/* Context distinction notice */}
              {currentRows.length === 0 ? (
                <div className="rounded-lg border border-amber-300/80 bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">Applied only after unit rows exist</p>
                      <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                        This is a <strong>manual pricing tool</strong> to benchmark £/m² rates, not a unit generator. It recalculates sales values and build costs on existing rows without creating or altering unit quantities.
                      </p>
                      <p className="text-muted-foreground pt-1">
                        👉 To populate units from your site boundary, click <strong>Generate Smart Layout</strong> in the Site Map. Or add rows manually in the GDV Calculator. Once rows exist, return here to refresh their rates.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">Ready to benchmark {currentRows.length} existing {currentRows.length === 1 ? 'unit row' : 'unit rows'}</p>
                      <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                        Applying this preset will recalculate sales values and build costs for your {currentRows.length} existing {currentRows.length === 1 ? 'row' : 'rows'} using <strong>{selectedRegion}</strong> ({selectedSpec} spec: £{preset?.buildPerSqm[selectedSpec].toLocaleString()}/m²) rates. Unit quantities remain unchanged.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                  <label className="text-sm font-medium">Build Specification</label>
                  <Select value={selectedSpec} onValueChange={(v) => setSelectedSpec(v as "low" | "medium" | "high")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (Volume Specification)</SelectItem>
                      <SelectItem value="medium">Medium (Standard Specification)</SelectItem>
                      <SelectItem value="high">High (Premium Specification)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview */}
              {preset && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Regional Benchmark Rates ({selectedRegion})</h4>
                  </div>

                  {/* Sales Values */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Regional sales £/m² by unit type (applied to existing rows):</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span>2-Bed Semi:</span>
                        <span className="font-medium">£{preset.salesPerSqm["2-Bed Semi"].toLocaleString()}/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>3-Bed Semi:</span>
                        <span className="font-medium">£{preset.salesPerSqm["3-Bed Semi"].toLocaleString()}/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>3-Bed Det:</span>
                        <span className="font-medium">£{preset.salesPerSqm["3-Bed Detached"].toLocaleString()}/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>4-Bed Det:</span>
                        <span className="font-medium">£{preset.salesPerSqm["4-Bed Detached"].toLocaleString()}/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2-Bed Bungalow:</span>
                        <span className="font-medium">£{preset.salesPerSqm["2-Bed Bungalow"].toLocaleString()}/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span>3-Bed Bungalow:</span>
                        <span className="font-medium">£{preset.salesPerSqm["3-Bed Bungalow"].toLocaleString()}/m²</span>
                      </div>
                    </div>
                  </div>

                  {/* Build Costs */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Regional build cost £/m²:</p>
                    <div className="flex gap-4 text-xs">
                      <Badge variant={selectedSpec === "low" ? "default" : "outline"}>
                        Low: £{preset.buildPerSqm.low.toLocaleString()}/m²
                      </Badge>
                      <Badge variant={selectedSpec === "medium" ? "default" : "outline"}>
                        Medium: £{preset.buildPerSqm.medium.toLocaleString()}/m²
                      </Badge>
                      <Badge variant={selectedSpec === "high" ? "default" : "outline"}>
                        High: £{preset.buildPerSqm.high.toLocaleString()}/m²
                      </Badge>
                    </div>
                  </div>

                  {/* Fees */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Standard regional fees & contingency:</p>
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
                    <p className="text-xs text-muted-foreground mb-2">Typical regional cost allowances:</p>
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
                  {currentRows.length > 0
                    ? `Refresh £/m² on ${currentRows.length} Existing ${currentRows.length === 1 ? 'Row' : 'Rows'}`
                    : "Refresh £/m² (Requires Existing Rows)"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                This tool only updates £/m² pricing rates and global fee percentages on existing rows. It never adds, deletes, or modifies unit quantities. All updates can be previewed in a side-by-side diff before applying.
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
