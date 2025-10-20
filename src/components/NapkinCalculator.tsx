import { useState, useEffect } from "react";
import { PropertyRow, GlobalInputs as GlobalInputsType } from "@/types/calculator";
import { SensitivityAdjustments, DEFAULT_SENSITIVITY } from "@/types/sensitivity";
import { calculateTotals } from "@/utils/calculatorHelpers";
import GlobalInputs from "@/components/calculator/GlobalInputs";
import GDVTable from "@/components/calculator/GDVTable";
import SummaryPanel from "@/components/calculator/SummaryPanel";
import MarketSensitivityPanel from "@/components/calculator/MarketSensitivityPanel";
import LenderReportModal from "@/components/calculator/LenderReportModal";
import LenderSummaryPack from "@/components/calculator/LenderSummaryPack";
import { ROIVisualiser } from "@/components/roi/ROIVisualiser";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "napkin-calculator-data";

interface NapkinCalculatorProps {
  siteArea?: number;
  initialRows?: PropertyRow[];
  mapImageUrl?: string;
  showROIVisualiser?: boolean;
  presetInfo?: {
    region: string;
    spec: "low" | "medium" | "high";
    appliedAt: string;
  };
}

const NapkinCalculator = ({ siteArea = 0, initialRows, mapImageUrl, showROIVisualiser = false, presetInfo }: NapkinCalculatorProps) => {
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
  });
  const [sensitivity, setSensitivity] = useState<SensitivityAdjustments>(DEFAULT_SENSITIVITY);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLenderPack, setShowLenderPack] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
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
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, inputs }));
    } catch (error) {
      console.error("Failed to save data:", error);
    }
  }, [rows, inputs]);

  // Update siteArea when prop changes
  useEffect(() => {
    if (siteArea > 0) {
      setInputs(prev => ({ ...prev, siteArea }));
    }
  }, [siteArea]);

  // Apply initialRows when provided (from "Use for GDV")
  useEffect(() => {
    if (initialRows && initialRows.length > 0) {
      setRows(initialRows);
    }
  }, [initialRows]);

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
    <section className="py-16 px-4 bg-background" id="calculator">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-8 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            GDV Calculator
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Use defaults or tweak assumptions. Export your scenario for lender submission.
          </p>
        </div>

        {/* Preset Info Bar */}
        {presetInfo && (
          <div className="mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Regional baseline:</span>
              <span className="font-medium">
                {presetInfo.region} – {presetInfo.spec.charAt(0).toUpperCase() + presetInfo.spec.slice(1)} (Q4-2025)
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">Change</Button>
              <Button variant="ghost" size="sm">Reset</Button>
            </div>
          </div>
        )}

        <GlobalInputs inputs={inputs} onChange={setInputs} totalUnits={totalUnits} />

        <MarketSensitivityPanel
          adjustments={sensitivity}
          onChange={setSensitivity}
          onReset={() => setSensitivity(DEFAULT_SENSITIVITY)}
          onGenerateReport={() => setShowReportModal(true)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <GDVTable rows={rows} onChange={setRows} />
          </div>

          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-4">
              <SummaryPanel 
                values={isSensitivityActive ? adjustedValues : baseValues} 
                targetMargin={inputs.targetMarginPercent}
                isSensitivityActive={isSensitivityActive}
                sensitivity={sensitivity}
                onOpenLenderPack={() => setShowLenderPack(true)}
              />
            </div>
          </div>
        </div>

        <LenderReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          baseCase={baseValues}
          adjustedCase={adjustedValues}
          adjustments={sensitivity}
        />

        <LenderSummaryPack
          open={showLenderPack}
          onClose={() => setShowLenderPack(false)}
          values={isSensitivityActive ? adjustedValues : baseValues}
          inputs={inputs}
          rows={rows}
          siteArea={siteArea}
          mapImageUrl={mapImageUrl}
        />

        {/* Mobile sticky CTA */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-large z-50">
          <div className="flex gap-2">
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = "#email-capture";
                link.click();
              }}
              className="flex-1 bg-primary text-primary-foreground py-3 rounded-md font-semibold hover:bg-primary/90 transition-colors"
            >
              Book a Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NapkinCalculator;
