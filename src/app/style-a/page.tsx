"use client";

// Style A — "Dashboard": a classic split layout (map left, controls and
// results right), refined from the original page.tsx but wired to the
// real worker/hooks, the real OS map, the simplified size-tier mix +
// auto-optimiser, and plain-English compliance labels. See /style-b for
// the alternative "command deck" full-bleed-map treatment — both are
// temporary comparison routes; CLAUDE.md's main page stays the
// pre-existing one until a style is picked.

import { useMemo, useState } from "react";
import { rules } from "@/engine";
import type { BNGPoint, BNGPolygon, HouseTypeId } from "@/engine/types";
import { resolveJurisdiction } from "@/rules/jurisdictions";
import { appraisalProvenance, planningProvenance } from "@/rules/jurisdictions/provenance";
import { schemeSizeBandForUnits, type MarketBand } from "@/rules/jurisdictions/types";
import { SiteCanvas, type DrawMode } from "@/components/plot-line/SiteCanvas";
import { MetricsPanel } from "@/components/plot-line/MetricsPanel";
import { ComplianceList } from "@/components/plot-line/ComplianceList";
import { ProvenanceRow } from "@/components/plot-line/ProvenanceDisclosure";
import { MixPanel } from "@/components/plot-line/MixPanel";
import { useEngineWorker } from "@/hooks/useEngineWorker";
import { useLiveLayout } from "@/hooks/useLiveLayout";
import { useMixState } from "@/hooks/useMixState";
import { useOptimizer } from "@/hooks/useOptimizer";

const LOCAL_AUTHORITY_OPTIONS = [{ id: "pembrokeshire", label: "Pembrokeshire County Council" }];

type DesignStandard = "ndss" | "generous";

export default function StyleA() {
  const [boundary, setBoundary] = useState<BNGPolygon>([]);
  const [entrance, setEntrance] = useState<BNGPoint | null>(null);
  const [mode, setMode] = useState<DrawMode>("boundary");

  const [standard, setStandard] = useState<DesignStandard>("ndss");
  const [localAuthority, setLocalAuthority] = useState("pembrokeshire");
  const [marketBand, setMarketBand] = useState<MarketBand>(2);
  const [proView, setProView] = useState(false);

  const worker = useEngineWorker();
  const mix = useMixState();
  const optimizer = useOptimizer(worker);

  const jurisdiction = useMemo(() => resolveJurisdiction(localAuthority), [localAuthority]);

  const ndssOverride = useMemo(() => {
    if (standard !== "generous") return undefined;
    const scaled: Partial<Record<HouseTypeId, number>> = {};
    for (const [type, value] of Object.entries(rules.NDSS_MIN_GIA_M2) as [HouseTypeId, number][]) {
      scaled[type] = Math.round(value * 1.2);
    }
    return scaled;
  }, [standard]);

  const baseInputs = useMemo(
    () => ({ localAuthority, marketBand, ndssMinGiaM2: ndssOverride }),
    [localAuthority, marketBand, ndssOverride]
  );

  const liveInputs = useMemo(() => ({ ...baseInputs, ...mix.engineMixFields }), [baseInputs, mix.engineMixFields]);

  // No vertex-dragging UI exists yet in SiteCanvas (click-to-place only,
  // no dragging an already-placed point) — so this is always "full"
  // quality. The engine/hook machinery for draft-while-dragging
  // (generateLayout's quality input, useLiveLayout's isDragging option)
  // is real and already wired; there's just no UI interaction yet that
  // would set isDragging=true. Stated plainly rather than implied.
  const live = useLiveLayout(worker, { boundary, entrance, inputs: liveInputs });

  const schemeSizeBand = live.output ? schemeSizeBandForUnits(live.output.metrics.totalUnits) : "1";
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
            Draw a site boundary on the real map, set the entrance, and get a live buildable layout with
            compliance and viability.
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

      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[1fr_340px]">
        <SiteCanvas
          boundary={boundary}
          entrance={entrance}
          layout={live.output?.layout ?? null}
          mode={mode}
          onAddBoundaryPoint={(p) => setBoundary((b) => [...b, p])}
          onSetEntrance={(p) => {
            setEntrance(p);
            setMode("done");
          }}
        />

        <div className="space-y-4 overflow-y-auto">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <MixPanel mix={mix} optimizer={optimizer} boundary={boundary} entrance={entrance} baseInputs={baseInputs} />
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Space standard</h3>
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-xs dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setStandard("ndss")}
                className={`flex-1 rounded-md px-2 py-1 font-medium transition ${
                  standard === "ndss" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500"
                }`}
              >
                NDSS minimum
              </button>
              <button
                type="button"
                onClick={() => setStandard("generous")}
                className={`flex-1 rounded-md px-2 py-1 font-medium transition ${
                  standard === "generous" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500"
                }`}
              >
                Generous (+20%)
              </button>
            </div>

            <h3 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Local authority</h3>
            <select
              value={localAuthority}
              onChange={(e) => setLocalAuthority(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              {LOCAL_AUTHORITY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <h3 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Market band</h3>
            <div className="grid grid-cols-4 gap-1">
              {([1, 2, 3, 4] as MarketBand[]).map((b) => {
                const price = jurisdiction.localAppraisal?.byMarketBand[b]?.salesPricePerSqm.value ?? null;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setMarketBand(b)}
                    className={`rounded-md border px-1 py-1.5 text-center text-[11px] transition ${
                      marketBand === b
                        ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                        : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    <div className="font-semibold">Band {b}</div>
                    <div>{price ? `£${price.toLocaleString()}/m²` : "—"}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {live.isComputing && (
            <div className="rounded-xl border border-dashed border-sky-300 p-3 text-center text-xs text-sky-600 dark:border-sky-800">
              Recalculating…
            </div>
          )}
          {live.error && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30">
              {live.error}
            </div>
          )}

          {live.output ? (
            <>
              <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Yield &amp; viability</h3>
                <MetricsPanel metrics={live.output.metrics} />
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Compliance</h3>
                  <button
                    type="button"
                    onClick={() => setProView((v) => !v)}
                    className="text-[11px] text-sky-600 hover:underline"
                  >
                    {proView ? "Simple view" : "Pro view"}
                  </button>
                </div>
                <ComplianceList checks={live.output.compliance} proView={proView} />
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
