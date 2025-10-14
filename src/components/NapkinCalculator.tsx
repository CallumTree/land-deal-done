import { useState, useEffect } from "react";
import { PropertyRow, GlobalInputs as GlobalInputsType } from "@/types/calculator";
import { calculateTotals } from "@/utils/calculatorHelpers";
import GlobalInputs from "@/components/calculator/GlobalInputs";
import GDVTable from "@/components/calculator/GDVTable";
import SummaryPanel from "@/components/calculator/SummaryPanel";

const STORAGE_KEY = "napkin-calculator-data";

const NapkinCalculator = () => {
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
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setRows(data.rows || []);
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

  const calculatedValues = calculateTotals(rows, inputs);

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

        <GlobalInputs inputs={inputs} onChange={setInputs} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <GDVTable rows={rows} onChange={setRows} />
          </div>

          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-4">
              <SummaryPanel 
                values={calculatedValues} 
                targetMargin={inputs.targetMarginPercent}
              />
            </div>
          </div>
        </div>

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
