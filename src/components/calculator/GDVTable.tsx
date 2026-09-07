import { useState } from "react";
import { PropertyRow, PROPERTY_TYPES, PROPERTY_DEFAULTS, SCENARIO_PRESETS } from "@/types/calculator";
import { calculateRowValues, exportToCSV, importFromCSV, formatCurrency } from "@/utils/calculatorHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Copy, Download, Upload, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface GDVTableProps {
  rows: PropertyRow[];
  onChange: (rows: PropertyRow[]) => void;
}

const GDVTable = ({ rows, onChange }: GDVTableProps) => {
  const [selectedScenario, setSelectedScenario] = useState<string>("");

  const addRow = () => {
    const newRow: PropertyRow = {
      id: `row-${Date.now()}`,
      type: "3-Bed Semi",
      units: 0,
      giaPerUnit: 90,
      salesValue: 292500,
      unitPriceOverride: 0,
      buildPerSqm: 1650,
      notes: "",
    };
    onChange([...rows, newRow]);
  };

  const deleteRow = (id: string) => {
    onChange(rows.filter(row => row.id !== id));
  };

  const duplicateRow = (row: PropertyRow) => {
    const newRow = { ...row, id: `row-${Date.now()}` };
    onChange([...rows, newRow]);
  };

  const updateRow = (id: string, field: keyof PropertyRow, value: string | number) => {
    onChange(
      rows.map(row =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleTypeChange = (id: string, type: string) => {
    const defaults = PROPERTY_DEFAULTS[type] || {};
    onChange(
      rows.map(row =>
        row.id === id
          ? { ...row, type, ...defaults }
          : row
      )
    );
  };

  const handleScenarioChange = (scenarioName: string) => {
    setSelectedScenario(scenarioName);
    const preset = SCENARIO_PRESETS[scenarioName as keyof typeof SCENARIO_PRESETS];
    
    if (preset) {
      const newRows: PropertyRow[] = preset.map((item, index) => {
        const defaults = PROPERTY_DEFAULTS[item.type] || {};
        return {
          id: `preset-${Date.now()}-${index}`,
          type: item.type,
          units: item.units,
          giaPerUnit: defaults.giaPerUnit || 0,
          salesValue: defaults.salesValue || 0,
          unitPriceOverride: 0,
          buildPerSqm: defaults.buildPerSqm || 0,
          notes: "",
        };
      });
      onChange(newRows);
      toast.success(`Loaded: ${scenarioName}`);
    }
  };

  const handleExport = () => {
    exportToCSV(rows);
    toast.success("CSV exported successfully");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedRows = await importFromCSV(file);
      onChange(importedRows);
      toast.success("CSV imported successfully");
    } catch (error) {
      toast.error("Failed to import CSV");
    }
    e.target.value = "";
  };

  const resetTable = () => {
    onChange([]);
    setSelectedScenario("");
    toast.info("Table reset");
  };

  const totals = rows.reduce(
    (acc, row) => {
      const { buildTotal, gdvTotal } = calculateRowValues(row);
      return {
        units: acc.units + row.units,
        gia: acc.gia + row.giaPerUnit * row.units,
        buildTotal: acc.buildTotal + buildTotal,
        gdvTotal: acc.gdvTotal + gdvTotal,
      };
    },
    { units: 0, gia: 0, buildTotal: 0, gdvTotal: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <Select value={selectedScenario} onValueChange={handleScenarioChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Load Scenario..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(SCENARIO_PRESETS).map((scenario) => (
                <SelectItem key={scenario} value={scenario}>
                  {scenario}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={addRow} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>

          <Button onClick={resetTable} variant="outline" size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <div className="flex gap-2">
          <label>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
            />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </span>
            </Button>
          </label>

          <Button onClick={handleExport} variant="cta" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-soft">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[250px] font-semibold">Type</TableHead>
              <TableHead className="w-[140px] font-semibold">Units</TableHead>
              <TableHead className="w-[120px]">GIA/Unit (m²)</TableHead>
              <TableHead className="w-[200px] font-semibold">Sales Value (£/unit)</TableHead>
              <TableHead className="w-[160px]">Override (£/unit)</TableHead>
              <TableHead className="w-[180px] font-semibold">Build £/m²</TableHead>
              <TableHead className="w-[140px]">Build/Unit</TableHead>
              <TableHead className="w-[160px]">Build Total</TableHead>
              <TableHead className="w-[140px]">GDV/Unit</TableHead>
              <TableHead className="w-[160px]">GDV Total</TableHead>
              <TableHead className="w-[200px]">Notes</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const { buildPerUnit, buildTotal, gdvPerUnit, gdvTotal } = calculateRowValues(row);
              
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Select
                      value={row.type}
                      onValueChange={(value) => handleTypeChange(row.id, value)}
                    >
                      <SelectTrigger className="min-w-[250px] w-full h-[44px] px-3 text-base font-medium text-foreground border border-border rounded-lg bg-card shadow-soft focus:border-primary focus:ring-2 focus:ring-primary/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-card border-border">
                        {PROPERTY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={row.units}
                      onChange={(e) => updateRow(row.id, "units", parseInt(e.target.value) || 0)}
                      className="min-w-[140px] w-full h-[44px] px-3 text-base font-medium text-foreground border border-border rounded-lg bg-card shadow-soft focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={row.giaPerUnit}
                      onChange={(e) => updateRow(row.id, "giaPerUnit", parseFloat(e.target.value) || 0)}
                      className="min-w-[120px] w-full h-[44px] px-3 text-base text-foreground border border-border rounded-lg bg-card/50"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={row.salesValue}
                      onChange={(e) => updateRow(row.id, "salesValue", parseFloat(e.target.value) || 0)}
                      className="min-w-[200px] w-full h-[44px] px-3 text-base font-medium text-foreground border border-border rounded-lg bg-card shadow-soft focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={row.unitPriceOverride}
                      onChange={(e) => updateRow(row.id, "unitPriceOverride", parseFloat(e.target.value) || 0)}
                      className="min-w-[160px] w-full h-[44px] px-3 text-base font-medium text-foreground border border-border rounded-lg bg-card shadow-soft focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      placeholder="Optional"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={row.buildPerSqm}
                      onChange={(e) => updateRow(row.id, "buildPerSqm", parseFloat(e.target.value) || 0)}
                      className="min-w-[180px] w-full h-[44px] px-3 text-base font-medium text-foreground border border-border rounded-lg bg-card shadow-soft focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                    />
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatCurrency(buildPerUnit)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatCurrency(buildTotal)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatCurrency(gdvPerUnit)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatCurrency(gdvTotal)}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateRow(row.id, "notes", e.target.value)}
                      className="h-[44px] px-3 text-base border border-border rounded-lg bg-card/50"
                      placeholder="Notes..."
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => duplicateRow(row)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRow(row.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableHeader className="sticky bottom-0 bg-muted/50 backdrop-blur-sm">
            <TableRow>
              <TableHead className="font-bold">TOTALS</TableHead>
              <TableHead className="font-bold">{totals.units}</TableHead>
              <TableHead className="font-bold">{totals.gia.toFixed(0)} m²</TableHead>
              <TableHead>-</TableHead>
              <TableHead>-</TableHead>
              <TableHead>-</TableHead>
              <TableHead>-</TableHead>
              <TableHead className="font-bold">{formatCurrency(totals.buildTotal)}</TableHead>
              <TableHead>-</TableHead>
              <TableHead className="font-bold">{formatCurrency(totals.gdvTotal)}</TableHead>
              <TableHead>-</TableHead>
              <TableHead>-</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No rows yet. Add a row or load a scenario to get started.</p>
        </div>
      )}
    </div>
  );
};

export default GDVTable;
