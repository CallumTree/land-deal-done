import { CheckCircle2, XCircle, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutGenerationOutput, LayoutResult } from "@/types/siteLayout";

interface LayoutSummaryPanelProps {
  output: LayoutGenerationOutput;
  onUseLayout: (layout: LayoutResult) => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

const LayoutSummaryPanel = ({ output, onUseLayout }: LayoutSummaryPanelProps) => {
  const { winner, candidates, warning } = output;

  if (warning && !winner) {
    return (
      <Card className="w-full border-destructive/40">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">{warning}</CardContent>
      </Card>
    );
  }

  if (!winner) return null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Recommended Layout: {winner.label}
        </CardTitle>
        <CardDescription>
          Highest profit proxy among {candidates.length} candidates tested, subject to garden, road and density
          rules. {winner.summary.totalUnits} units, {Math.round(winner.summary.roadLengthM)}m access road.
          {winner.region && (
            <>
              {" "}Priced on <span className="font-medium">{winner.region}</span> £/m² rates
              {winner.buildSpec ? ` (${winner.buildSpec} build spec)` : ""} — not a flat national average.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {warning && (
          <div className="text-sm text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
            {warning}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Units placed</p>
            <p className="text-lg font-bold">{winner.summary.totalUnits}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Achieved density</p>
            <p className="text-lg font-bold">{winner.summary.achievedDensityUprHa.toFixed(1)} u/ha</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Est. GDV</p>
            <p className="text-lg font-bold">{formatCurrency(winner.summary.estimatedGDV)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Profit proxy</p>
            <p className="text-lg font-bold">{formatCurrency(winner.summary.profitProxy)}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Planning compliance</h4>
          <div className="space-y-2">
            {winner.summary.compliance.map((check) => (
              <div key={check.id} className="flex items-start gap-2 text-sm">
                {check.pass ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="font-medium">{check.label}:</span>{" "}
                  <span className="text-muted-foreground">{check.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Candidates considered</h4>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Layout</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Density</TableHead>
                  <TableHead className="text-right">Profit proxy</TableHead>
                  <TableHead className="text-right">Compliant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => {
                  const allCompliant = c.summary.totalUnits > 0 && c.summary.compliance.every((chk) => chk.pass);
                  return (
                    <TableRow key={c.id} className={c.id === winner.id ? "bg-primary/5" : undefined}>
                      <TableCell className="font-medium">
                        {c.label}
                        {c.id === winner.id && (
                          <Badge variant="secondary" className="ml-2">
                            Best
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{c.summary.totalUnits}</TableCell>
                      <TableCell className="text-right">{c.summary.achievedDensityUprHa.toFixed(1)} u/ha</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.summary.profitProxy)}</TableCell>
                      <TableCell className="text-right">
                        {allCompliant ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 inline" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive inline" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <Button onClick={() => onUseLayout(winner)} className="w-full">
          Use This Layout
        </Button>
      </CardContent>
    </Card>
  );
};

export default LayoutSummaryPanel;
