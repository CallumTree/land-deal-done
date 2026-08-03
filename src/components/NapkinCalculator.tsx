import { useState, useEffect, useMemo } from "react";
import { PropertyRow, GlobalInputs as GlobalInputsType } from "@/types/calculator";
import { SensitivityAdjustments, DEFAULT_SENSITIVITY } from "@/types/sensitivity";
import { calculateTotals } from "@/utils/calculatorHelpers";
import GlobalInputs from "@/components/calculator/GlobalInputs";
import GDVTable from "@/components/calculator/GDVTable";
import SummaryPanel from "@/components/calculator/SummaryPanel";
import MarketSensitivityPanel from "@/components/calculator/MarketSensitivityPanel";
import LenderReportModal from "@/components/calculator/LenderReportModal";
import { ROIVisualiser } from "@/components/roi/ROIVisualiser";
import { PlanningUpliftInsight } from "@/components/calculator/PlanningUpliftInsight";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

// removed static STORAGE_KEY in favor of per-project key

interface NapkinCalculatorProps {
  siteArea?: number;
  initialRows?: PropertyRow[];
  mapImageUrl?: string;
  showROIVisualiser?: boolean;
  projectId?: string; // Add projectId for proper per-project storage
  presetInfo?: {
    region: string;
    spec: "low" | "medium" | "high";
    appliedAt: string;
  };
  suggestionMetadata?: {
    source: string;
    localAuthority?: string;
    region: string;
    baseBand: string;
    generatedAt: string;
  };
}

const NapkinCalculator = ({ siteArea = 0, initialRows, mapImageUrl, showROIVisualiser = false, projectId, presetInfo, suggestionMetadata }: NapkinCalculatorProps) => {
  // Create per-project storage key
  const storageKey = useMemo(() => 
    projectId ? `napkin-calculator-data-${projectId}` : "napkin-calculator-data"
  , [projectId]);

  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [inputs, setInputs] = useState<GlobalInputsType>({
    professionalFeesPercent: 10,
    marketingSalesPercent: 2.5,
    contingencyPercent: 7.5,
    financePercent: 8,
    s106CIL: 0,
    landCost: 0,
    targetMarginPercent: 20,
    vatEnabled: false,
    siteArea: 0,
    demolitionClearance: 0,
    ecologyEnvironmental: 0,
    groundInvestigation: 0,
    planningStatutoryFees: 0,
    serviceConnections: 0,
    abnormals: 0,
    siteSecurity: 0,
    miscellaneousAllowance: 0,
    abnormalsPercentEnabled: false,
    abnormalsPercent: 5,
    siteNotes: "",
    planningUplift: {
      currentValueType: "Agricultural",
      planningCosts: 25000,
      successProbability: 60,
      includeInLenderPack: false,
    },
  });
  const [sensitivity, setSensitivity] = useState<SensitivityAdjustments>(DEFAULT_SENSITIVITY);
  const [showReportModal, setShowReportModal] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        // Migrate old data: convert salesPerSqm to salesValue if needed
        const migratedRows = (data.rows || []).map((row: any) => {
          if (row.salesPerSqm !== undefined && row.salesValue === undefined) {
            // Convert old format: salesValue = GIA × salesPerSqm
            return {
              ...row,
              salesValue: (row.giaPerUnit || 0) * (row.salesPerSqm || 0),
            };
          }
          return row;
        });
        setRows(migratedRows);
        setInputs(data.inputs || inputs);
      }
    } catch (error) {
      console.error("Failed to load saved data:", error);
    }
  }, [storageKey]);

  // Save to localStorage when data changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ rows, inputs }));
    } catch (error) {
      console.error("Failed to save data:", error);
    }
  }, [rows, inputs, storageKey]);

  // Update siteArea when prop changes
  useEffect(() => {
    if (siteArea > 0) {
      setInputs(prev => ({ ...prev, siteArea }));
    }
  }, [siteArea]);

  // Apply initialRows when provided (from "Use for GDV") - only if no saved data exists
  useEffect(() => {
    if (!initialRows || initialRows.length === 0) return;
    try {
      const saved = localStorage.getItem(storageKey);
      const hasSaved = !!saved && (() => { try { return (JSON.parse(saved).rows || []).length > 0; } catch { return false; } })();
      if (!hasSaved && rows.length === 0) {
        setRows(initialRows);
      }
    } catch {
      if (rows.length === 0) setRows(initialRows);
    }
  }, [storageKey, initialRows]);

  const baseValues = calculateTotals(rows, inputs);
  const adjustedValues = calculateTotals(rows, inputs, sensitivity);
  const isSensitivityActive = Object.values(sensitivity).some(v => v !== 0);
  
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);

  // Show ROI Visualiser if requested
  if (showROIVisualiser) {
    return (
      <section className="py-8 px-4 bg-background">
        <div className="container mx-auto max-w-7xl">
          <ROIVisualiser 
            rows={rows} 
            inputs={inputs} 
            values={isSensitivityActive ? adjustedValues : baseValues} 
          />
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 px-4 bg-background" id="calculator">
      <div className="container mx-auto max-w-7xl">
        {/* Header Bar */}
        <div className="mb-6">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">
            GDV Calculator
          </h2>
          <p className="text-muted-foreground">
            Define your scheme, adjust assumptions, review viability
          </p>
        </div>

        {/* Quick Assumptions Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4 bg-muted/30 rounded-lg mb-6">
          <div className="space-y-1">
            <Label htmlFor="quick-land" className="text-xs text-muted-foreground">Land Cost</Label>
            <Input
              id="quick-land"
              type="number"
              value={inputs.landCost}
              onChange={(e) => setInputs({ ...inputs, landCost: parseFloat(e.target.value) || 0 })}
              className="h-9 text-sm"
              placeholder="£0"
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="quick-margin" className="text-xs text-muted-foreground">Target Margin %</Label>
            <Input
              id="quick-margin"
              type="number"
              value={inputs.targetMarginPercent}
              onChange={(e) => setInputs({ ...inputs, targetMarginPercent: parseFloat(e.target.value) || 0 })}
              className="h-9 text-sm"
              placeholder="20"
            />
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="quick-area" className="text-xs text-muted-foreground">Site Area (m²)</Label>
            <Input
              id="quick-area"
              type="number"
              value={inputs.siteArea}
              onChange={(e) => setInputs({ ...inputs, siteArea: parseFloat(e.target.value) || 0 })}
              className="h-9 text-sm"
              placeholder="0"
            />
          </div>
          
          <div className="flex items-end">
            <div className="flex items-center space-x-2">
              <Switch
                id="quick-vat"
                checked={inputs.vatEnabled}
                onCheckedChange={(checked) => setInputs({ ...inputs, vatEnabled: checked })}
              />
              <Label htmlFor="quick-vat" className="text-sm cursor-pointer whitespace-nowrap">
                VAT (20%)
              </Label>
            </div>
          </div>
          
          {presetInfo && (
            <div className="col-span-2 flex items-center gap-2 p-2 rounded border border-primary/20 bg-primary/5">
              <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs font-medium truncate">
                {presetInfo.region} – {presetInfo.spec}
              </span>
            </div>
          )}
        </div>

        {/* Main Layout: Unit Mix + Summary Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
          {/* Left: Unit Mix Table */}
          <div className="lg:col-span-8 space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                Unit Mix & GDV
              </h3>
              
              {suggestionMetadata && (
                <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Mix adjusted from {suggestionMetadata.baseBand}
                        {suggestionMetadata.localAuthority && ` for ${suggestionMetadata.localAuthority}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on {suggestionMetadata.source} • {suggestionMetadata.region}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <GDVTable rows={rows} onChange={setRows} />
            </div>

            {/* Cost & Fee Assumptions Panel */}
            <div>
              <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                Cost & Fee Assumptions
              </h3>
              <GlobalInputs inputs={inputs} onChange={setInputs} totalUnits={totalUnits} />
            </div>
          </div>

          {/* Right: Summary Sidebar (Sticky) */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-4 space-y-4">
              <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                Live Summary
              </h3>
              <SummaryPanel
                values={isSensitivityActive ? adjustedValues : baseValues}
                targetMargin={inputs.targetMarginPercent}
                isSensitivityActive={isSensitivityActive}
                sensitivity={sensitivity}
              />
              
              <PlanningUpliftInsight
                rlv={baseValues.residualLandValue}
                siteArea={inputs.siteArea}
                data={inputs.planningUplift || {
                  currentValueType: "Agricultural",
                  planningCosts: 25000,
                  successProbability: 60,
                  includeInLenderPack: false,
                }}
                onChange={(planningUplift) => setInputs({ ...inputs, planningUplift })}
              />
            </div>
          </div>
        </div>

        {/* Market Sensitivity (Collapsed by default) */}
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-sm font-bold">4</span>
            Scenario Testing (Optional)
          </h3>
          <MarketSensitivityPanel
            adjustments={sensitivity}
            onChange={setSensitivity}
            onReset={() => setSensitivity(DEFAULT_SENSITIVITY)}
            onGenerateReport={() => setShowReportModal(true)}
          />
        </div>

        <LenderReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          baseCase={baseValues}
          adjustedCase={adjustedValues}
          adjustments={sensitivity}
        />
      </div>
    </section>
  );
};

export default NapkinCalculator;
