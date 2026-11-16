"use client";

// Style B — "Command deck": a full-bleed real map with floating glass
// panels on top, rather than style-a's classic map-plus-sidebar split.
// Same functionality and the same shared hooks/components as /style-a
// (useEngineWorker/useLiveLayout/useMixState/useOptimizer, MixPanel,
// ComplianceList, MetricsPanel) — only the layout/chrome differs, which
// is the actual point of having two style routes to compare. Cyan is
// this style's one accent colour (style-a uses sky); CLAUDE.md: "a few
// purposeful accents... clean, restrained, futuristic."

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { PostcodeSearch } from "@/components/plot-line/PostcodeSearch";
import { useEngineWorker } from "@/hooks/useEngineWorker";
import { useLiveLayout } from "@/hooks/useLiveLayout";
import { useMixState } from "@/hooks/useMixState";
import { useOptimizer } from "@/hooks/useOptimizer";

const LOCAL_AUTHORITY_OPTIONS = [{ id: "pembrokeshire", label: "Pembrokeshire County Council" }];

type DesignStandard = "ndss" | "generous";

const GLASS = "rounded-2xl border border-white/40 bg-white/70 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/60";

export default function StyleB() {
  const [boundary, setBoundary] = useState<BNGPolygon>([]);
  const [entrance, setEntrance] = useState<BNGPoint | null>(null);
  const [mode, setMode] = useState<DrawMode>("boundary");

  const [standard, setStandard] = useState<DesignStandard>("ndss");
  const [localAuthority, setLocalAuthority] = useState("pembrokeshire");
  const [marketBand, setMarketBand] = useState<MarketBand>(2);
  const [proView, setProView] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const [flyTo, setFlyTo] = useState<{ center: BNGPoint; resolution?: number; key: number } | undefined>();
  const [searchedPostcode, setSearchedPostcode] = useState<string | null>(null);
  const handlePostcodeFound = useCallback((center: BNGPoint, postcode: string) => {
    setFlyTo({ center, resolution: 5, key: Date.now() });
    setSearchedPostcode(postcode);
  }, []);

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

  // See style-a's identical comments for the drag/refine-state design.
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const sawComputingSinceReleaseRef = useRef(false);
  const handleDragStateChange = useCallback((dragging: boolean) => {
    setIsDraggingVertex(dragging);
    if (!dragging) {
      sawComputingSinceReleaseRef.current = false;
      setIsRefining(true);
    }
  }, []);

  const live = useLiveLayout(worker, { boundary, entrance, inputs: liveInputs, isDragging: isDraggingVertex });

  useEffect(() => {
    if (!isRefining) return;
    if (live.isComputing) {
      sawComputingSinceReleaseRef.current = true;
    } else if (sawComputingSinceReleaseRef.current) {
      setIsRefining(false);
    }
  }, [isRefining, live.isComputing]);

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
    <div className="relative h-screen w-full overflow-hidden bg-zinc-950">
      <SiteCanvas
        boundary={boundary}
        entrance={entrance}
        layout={live.output?.layout ?? null}
        mode={mode}
        fill
        onAddBoundaryPoint={(p) => setBoundary((b) => [...b, p])}
        onSetEntrance={(p) => {
          setEntrance(p);
          setMode("done");
        }}
        onBoundaryChange={setBoundary}
        onEntranceChange={setEntrance}
        onDragStateChange={handleDragStateChange}
        flyTo={flyTo}
      />

      {/* Top bar */}
      <div className={`absolute left-4 right-4 top-4 z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2 ${GLASS}`}>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Plot Line</h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {searchedPostcode ? `Showing ${searchedPostcode}. ` : "Search a postcode to find your site. "}
            Draw your boundary, set an entrance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PostcodeSearch
            onFound={handlePostcodeFound}
            className="flex items-center gap-1"
            inputClassName="w-36 rounded-md border border-zinc-300 bg-white/80 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900/80"
            buttonClassName="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          />
          {isRefining && <span className="text-[11px] text-cyan-500">Refining…</span>}
          {live.isComputing && !isDraggingVertex && !isRefining && (
            <span className="text-[11px] text-cyan-600 dark:text-cyan-400">Recalculating…</span>
          )}
          {canFinishBoundary && (
            <button
              type="button"
              onClick={() => setMode("entrance")}
              className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700"
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
          <button
            type="button"
            onClick={() => setRightPanelOpen((v) => !v)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {rightPanelOpen ? "Hide results" : "Show results"}
          </button>
        </div>
      </div>

      {/* Left floating panel: mix controls */}
      <div className={`absolute bottom-4 left-4 top-20 z-20 w-80 overflow-y-auto p-3 ${GLASS}`}>
        <MixPanel
          mix={mix}
          optimizer={optimizer}
          boundary={boundary}
          entrance={entrance}
          baseInputs={baseInputs}
          accentClassName="accent-cyan-500"
        />

        <div className="mt-4 border-t border-zinc-200/70 pt-3 dark:border-white/10">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Space standard</h3>
          <div className="flex gap-1 rounded-lg bg-zinc-100/80 p-1 text-xs dark:bg-zinc-800/80">
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
            className="w-full rounded-md border border-zinc-300 bg-white/80 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900/80"
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
                      ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"
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
      </div>

      {/* Right floating panel: results */}
      {rightPanelOpen && (
        <div className={`absolute bottom-4 right-4 top-20 z-20 w-96 overflow-y-auto p-3 ${GLASS}`}>
          {live.error && <p className="mb-2 text-xs text-red-600">{live.error}</p>}
          {live.output ? (
            <div className="space-y-3">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Yield &amp; viability</h3>
                <MetricsPanel metrics={live.output.metrics} />
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Compliance</h3>
                  <button type="button" onClick={() => setProView((v) => !v)} className="text-[11px] text-cyan-600 hover:underline">
                    {proView ? "Simple view" : "Pro view"}
                  </button>
                </div>
                <ComplianceList checks={live.output.compliance} proView={proView} />
              </section>

              <details className="rounded-lg border border-zinc-200/70 p-2 dark:border-white/10">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Planning rule sources
                </summary>
                <div className="mt-2">
                  {planningEntries.map((e) => (
                    <ProvenanceRow key={e.id} entry={e} />
                  ))}
                </div>
              </details>

              <details className="rounded-lg border border-zinc-200/70 p-2 dark:border-white/10" open>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Appraisal input sources
                </summary>
                <div className="mt-2">
                  {appraisalEntries.map((e) => (
                    <ProvenanceRow key={e.id} entry={e} />
                  ))}
                </div>
              </details>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
              Draw a boundary and set an entrance to see a layout.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
