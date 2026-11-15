"use client";

import { useMemo, useState } from "react";
import { generateLayout, rules } from "@/engine";
import type { BNGPoint, BNGPolygon, EngineOutput, HouseTypeId } from "@/engine/types";
import { resolveJurisdiction } from "@/rules/jurisdictions";
import { appraisalProvenance, planningProvenance } from "@/rules/jurisdictions/provenance";
import { schemeSizeBandForUnits, type MarketBand } from "@/rules/jurisdictions/types";
import { SiteCanvas, type DrawMode } from "@/components/plot-line/SiteCanvas";
import { ControlsPanel, type DesignStandard } from "@/components/plot-line/ControlsPanel";
import { MetricsPanel } from "@/components/plot-line/MetricsPanel";
import { ComplianceList } from "@/components/plot-line/ComplianceList";
import { ProvenanceRow } from "@/components/plot-line/ProvenanceDisclosure";

const LOCAL_AUTHORITY_OPTIONS = [{ id: "pembrokeshire", label: "Pembrokeshire County Council" }];

const DEFAULT_MIX: Record<HouseTypeId, number> = {
  "2-bed-terrace": 1,
  "2-bed-semi": 0,
  "2-bed-detached": 0,
  "3-bed-terrace": 0,
  "3-bed-semi": 1,
  "3-bed-detached": 0,
  "3-bed-bungalow": 0,
  "4-bed-terrace": 0,
  "4-bed-semi": 0,
  "4-bed-detached": 1,
  "5-bed-detached": 0,
};

export default function Home() {
  const [boundary, setBoundary] = useState<BNGPolygon>([]);
  const [entrance, setEntrance] = useState<BNGPoint | null>(null);
  const [mode, setMode] = useState<DrawMode>("boundary");

  const [mix, setMix] = useState<Record<HouseTypeId, number>>(DEFAULT_MIX);
  const [standard, setStandard] = useState<DesignStandard>("ndss");
  const [localAuthority, setLocalAuthority] = useState("pembrokeshire");
  const [marketBand, setMarketBand] = useState<MarketBand>(2);

  const jurisdiction = useMemo(() => resolveJurisdiction(localAuthority), [localAuthority]);

  const ndssOverride = useMemo(() => {
    if (standard !== "generous") return undefined;
    const scaled: Partial<Record<HouseTypeId, number>> = {};
    for (const [type, value] of Object.entries(rules.NDSS_MIN_GIA_M2) as [HouseTypeId, number][]) {
      scaled[type] = Math.round(value * 1.2);
    }
    return scaled;
  }, [standard]);

  const output: EngineOutput | null = useMemo(() => {
    if (boundary.length < 3 || !entrance) return null;
    try {
      return generateLayout(boundary, entrance, { mix, localAuthority, marketBand, ndssMinGiaM2: ndssOverride });
    } catch {
      return null;
    }
  }, [boundary, entrance, mix, localAuthority, marketBand, ndssOverride]);

  const schemeSizeBand = output ? schemeSizeBandForUnits(output.metrics.totalUnits) : "1";
  const appraisalEntries = useMemo(
    () => appraisalProvenance(jurisdiction, schemeSizeBand, marketBand),
    [jurisdiction, schemeSizeBand, marketBand]
  );
  const planningEntries = useMemo(() => planningProvenance(jurisdiction), [jurisdiction]);

  const canFinishBoundary = mode === "boundary" && boundary.length >= 3;

  const handleReset = () => {
    setBoundary([]);
    setEntrance(null);
    setMode("boundary");
  };

  return (
    <div className="flex flex-1 flex-col gap-4 bg-zinc-50 p-4 dark:bg-zinc-950 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Plot Line</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Draw a site boundary, set the entrance, and get a live buildable layout with compliance and viability.
          </p>
        </div>
        <div className="flex gap-2">
          {canFinishBoundary && (
            <button
              type="button"
              onClick={() => setMode("entrance")}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
            >
              Finish boundary
            </button>
          )}
          {boundary.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
        <SiteCanvas
          boundary={boundary}
          entrance={entrance}
          layout={output?.layout ?? null}
          mode={mode}
          onAddBoundaryPoint={(p) => setBoundary((b) => [...b, p])}
          onSetEntrance={(p) => {
            setEntrance(p);
            setMode("done");
          }}
        />

        <div className="space-y-4 overflow-y-auto">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <ControlsPanel
              mix={mix}
              onMixChange={(type, weight) => setMix((m) => ({ ...m, [type]: weight }))}
              standard={standard}
              onStandardChange={setStandard}
              localAuthorityOptions={LOCAL_AUTHORITY_OPTIONS}
              localAuthority={localAuthority}
              onLocalAuthorityChange={setLocalAuthority}
              marketBand={marketBand}
              onMarketBandChange={setMarketBand}
              marketBandSalesPrice={(b) => jurisdiction.localAppraisal?.byMarketBand[b]?.salesPricePerSqm.value ?? null}
            />
          </div>

          {output ? (
            <>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Yield &amp; viability</h3>
                <MetricsPanel metrics={output.metrics} />
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Compliance</h3>
                <ComplianceList checks={output.compliance} />
              </div>

              <details className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Planning rule sources
                </summary>
                <div className="mt-2">
                  {planningEntries.map((e) => (
                    <ProvenanceRow key={e.id} entry={e} />
                  ))}
                </div>
              </details>

              <details className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900" open>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Appraisal input sources
                </summary>
                <div className="mt-2">
                  {appraisalEntries.map((e) => (
                    <ProvenanceRow key={e.id} entry={e} />
                  ))}
                </div>
              </details>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
              Draw a boundary and set an entrance to see a layout.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
