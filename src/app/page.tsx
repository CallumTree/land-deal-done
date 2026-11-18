"use client";

// "Grid Runner" — the one main UI, mobile-first dark neon map app. Full-
// bleed OS map as the hero, a floating top pill (wordmark, postcode
// search, live dot), and a draggable bottom sheet (floating left panel
// at 768px+) carrying the stats, mix controls and compliance line. See
// CLAUDE.md "Default view dead simple... compliance shown as colour."
//
// The generative logic itself (engine, worker, hooks, optimiser, the OS
// map/vector overlay) is untouched by this rebuild — this file only
// wires those existing pieces into the new presentation.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteCanvas, type DrawMode } from "@/components/plot-line/SiteCanvas";
import { Scene3D } from "@/components/plot-line/Scene3D";
import { BottomSheet, type SheetSnap } from "@/components/plot-line/BottomSheet";
import { PostcodeSearch } from "@/components/plot-line/PostcodeSearch";
import { MetricsPanel } from "@/components/plot-line/MetricsPanel";
import { ComplianceList } from "@/components/plot-line/ComplianceList";
import { ProvenanceSummary } from "@/components/plot-line/ProvenanceDisclosure";
import { useEngineWorker } from "@/hooks/useEngineWorker";
import { useLiveLayout } from "@/hooks/useLiveLayout";
import { useMixState } from "@/hooks/useMixState";
import { useOptimizer } from "@/hooks/useOptimizer";
import { SIZE_TIERS } from "@/engine/sizeTiers";
import { readStoredMapTheme, storeMapTheme } from "@/components/plot-line/mapFilter";
import { getComplianceCopy, describeSizeMix, MIX_CARD_COPY, BUNGALOW_TOGGLE_HELP } from "@/copy/labels";
import { resolveJurisdiction } from "@/rules/jurisdictions";
import { appraisalProvenance, planningProvenance } from "@/rules/jurisdictions/provenance";
import { schemeSizeBandForUnits, type MarketBand } from "@/rules/jurisdictions/types";
import type { BNGPoint, BNGPolygon, EngineInputs, ComplianceCheck } from "@/engine/types";

const gbp = (n: number) => `£${Math.round(n).toLocaleString()}`;

/**
 * Checks that are genuinely per-plot (a specific home's own GIA/garden/
 * parking falls short) rather than scheme-structural (road/topology/
 * turning-head/etc). Drives both tightPlotIds (the map's amber outlines)
 * and the compliance line's "N homes a bit tight" vs a more serious
 * message — see ComplianceCheck.affectedPlotIds' own doc comment.
 */
const PER_PLOT_CHECK_IDS = new Set(["ndss-gia", "garden-depth", "parking"]);

function unionAffectedPlotIds(compliance: ComplianceCheck[]): Set<string> {
  const ids = new Set<string>();
  for (const check of compliance) {
    if (PER_PLOT_CHECK_IDS.has(check.id) && check.affectedPlotIds) {
      for (const id of check.affectedPlotIds) ids.add(id);
    }
  }
  return ids;
}

// Audit: was a user-facing "Plot spacing" control (Tighter/Typical/
// Roomier, see EngineInputs.sideGapTier). Hidden per CLAUDE.md's "default
// view dead simple... challenge every screen and every click" — a
// first-time developer has no way to judge between three spacing
// presets, two of which (typical/roomier) are this engine's own unsourced
// modelling choices rather than a planning standard (see rules.ts's
// SIDE_GAP_TIER_M comment). Fixed at "tighter" — the ONE sourced value
// (the documented ~1m fire/visual-separation convention) and the same
// default this already was, so hiding the control changes no behaviour.
// The engine still accepts all three tiers via EngineInputs.sideGapTier
// for a future "advanced" surface — only the front-and-centre control is
// removed.
const FIXED_SIDE_GAP_TIER = "tighter" as const;

export default function Home() {
  const [boundary, setBoundary] = useState<BNGPolygon>([]);
  const [entrance, setEntrance] = useState<BNGPoint | null>(null);
  const [mode, setMode] = useState<DrawMode>("boundary");
  const [isDragging, setIsDragging] = useState(false);
  const [view3D, setView3D] = useState(false);

  // Must start "dark" (matching SSR, which has no window/localStorage)
  // rather than reading the stored preference in a lazy initializer —
  // same hydration-mismatch reasoning as BottomSheet's isDesktop state:
  // a returning user whose stored preference is "light" would make the
  // CLIENT's first render disagree with the server-rendered HTML. The
  // synchronous setState below runs post-hydration (a later commit), so
  // it corrects to the real preference without that risk — one frame of
  // "dark" before it flips, not an error.
  const [mapDark, setMapDark] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMapDark(readStoredMapTheme() === "dark");
  }, []);
  const handleToggleMapTheme = useCallback(() => {
    setMapDark((prev) => {
      const next = !prev;
      storeMapTheme(next ? "dark" : "light");
      return next;
    });
  }, []);

  const [marketBand] = useState<MarketBand>(2);
// Defaults to "peek" (not "half") so the map stays at least ~60% of
  // the screen height at rest, per the brief's "always the hero" — the
  // user can drag/tap it up to half or full themselves.
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  const [showDetail, setShowDetail] = useState(false);

  const [flyTo, setFlyTo] = useState<{ center: BNGPoint; resolution?: number; key: number } | undefined>(undefined);
  const flyToKeyRef = useRef(0);

  const worker = useEngineWorker();
  const mix = useMixState();
  const optimizer = useOptimizer(worker);

  const liveInputs = useMemo(
    () => ({
      sizeMix: mix.engineMixFields.sizeMix,
      includeBungalows: mix.engineMixFields.includeBungalows,
      localAuthority: "pembrokeshire",
      marketBand,
      sideGapTier: FIXED_SIDE_GAP_TIER,
    }),
    [mix.engineMixFields, marketBand]
  );
  const liveLayout = useLiveLayout(worker, { boundary, entrance, inputs: liveInputs, isDragging });

  // "Refining" glow: a one-shot 2s ring (see globals.css's .grid-refining,
  // already a one-shot per the motion hard limits) around the map while a
  // just-released drag's draft result is replaced by the full-quality
  // recalculation. pendingRefineRef is armed on drag release and consumed
  // the next time isComputing flips back to false (the full result has
  // landed) — never on the plain-input-change recomputes that happen
  // outside a drag.
  const pendingRefineRef = useRef(false);
  const [refining, setRefining] = useState(false);
  const handleDragStateChange = useCallback((dragging: boolean) => {
    setIsDragging(dragging);
    if (dragging) {
      // Dragging an existing boundary corner/entrance is itself a map
      // interaction — collapse an overlapping sheet the same as a tap
      // does (handleMapInteraction below), so the map stays visible
      // the moment the user actually starts working on it.
      setSheetSnap("peek");
    } else {
      pendingRefineRef.current = true;
    }
  }, []);

  // Any tap on the map (adding a boundary point, setting the entrance,
  // or just tapping while in "done" mode) drops an overlapping sheet
  // back to peek — "the map is always one gesture away."
  const handleMapInteraction = useCallback(() => {
    setSheetSnap("peek");
  }, []);
  useEffect(() => {
    if (liveLayout.isComputing || !pendingRefineRef.current) return;
    pendingRefineRef.current = false;
    setRefining(true);
    const t = setTimeout(() => setRefining(false), 2000);
    return () => clearTimeout(t);
  }, [liveLayout.isComputing]);

  const output = liveLayout.output;
  const metrics = output?.metrics ?? null;

  const tightPlotIds = useMemo(() => (output ? unionAffectedPlotIds(output.compliance) : new Set<string>()), [output]);

  const complianceStatus = useMemo((): { dot: "green" | "amber" | "red" | "none"; text: string } => {
    if (!output) return { dot: "none", text: "Draw a boundary and set an entrance to check compliance." };
    const structuralFail = output.compliance.find((c) => !PER_PLOT_CHECK_IDS.has(c.id) && c.status === "fail");
    if (structuralFail) return { dot: "red", text: getComplianceCopy(structuralFail).detail };
    if (tightPlotIds.size > 0) {
      return { dot: "amber", text: `${tightPlotIds.size} home${tightPlotIds.size === 1 ? "" : "s"} a bit tight.` };
    }
    return { dot: "green", text: "All rules met." };
  }, [output, tightPlotIds]);

  const jurisdiction = useMemo(() => resolveJurisdiction("pembrokeshire"), []);
  const schemeSizeBand = metrics ? schemeSizeBandForUnits(metrics.totalUnits) : "1";
  const appraisalEntries = useMemo(
    () => appraisalProvenance(jurisdiction, schemeSizeBand, marketBand),
    [jurisdiction, schemeSizeBand, marketBand]
  );
  const planningEntries = useMemo(() => planningProvenance(jurisdiction), [jurisdiction]);

  const canFinishBoundary = mode === "boundary" && boundary.length >= 3;

  const handleReset = useCallback(() => {
    setBoundary([]);
    setEntrance(null);
    setMode("boundary");
  }, []);

  const handlePostcodeFound = useCallback(
    (center: BNGPoint) => {
      flyToKeyRef.current += 1;
      setFlyTo({ center, resolution: 2, key: flyToKeyRef.current });
    },
    [flyToKeyRef]
  );

  const handleRunOptimizer = useCallback(() => {
    if (!entrance || boundary.length < 3) return;
    const inputs: EngineInputs = { localAuthority: "pembrokeshire", marketBand, sideGapTier: FIXED_SIDE_GAP_TIER, quality: "full" };
    optimizer.run(boundary, entrance, inputs);
  }, [boundary, entrance, marketBand, optimizer]);

  const handleToggleAuto = useCallback(() => {
    const turningOn = mix.mode !== "auto";
    mix.setMode(turningOn ? "auto" : "manual");
    if (turningOn) handleRunOptimizer();
  }, [mix, handleRunOptimizer]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink">
      {/*
        2D and 3D are mutually exclusive, never both mounted — each owns
        a real GPU context (OpenLayers' tile/vector canvases vs three's
        WebGL context), and running both at once on a phone is wasted
        work at best and a WebGL-context-limit risk at worst. Toggling
        away from 3D and back does lose camera position (no "preserve it
        across the toggle" requirement in the brief — only "live updates
        while viewing 3D", which this still gives in full), but drawing/
        dragging stays 2D-only either way, so nothing is lost by
        remounting on re-entry.
      */}
      {view3D ? (
        <Scene3D
          boundary={boundary}
          entrance={entrance}
          layout={output?.layout ?? null}
          tightPlotIds={tightPlotIds}
          dark={mapDark}
        />
      ) : (
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
          onBoundaryChange={setBoundary}
          onEntranceChange={setEntrance}
          onDragStateChange={handleDragStateChange}
          onMapInteraction={handleMapInteraction}
          flyTo={flyTo}
          tightPlotIds={tightPlotIds}
          dark={mapDark}
          fill
        />
      )}

      {/*
        Refining glow: see the pendingRefineRef effect above. Inset by a
        few px rather than inset-0 — .grid-refining's box-shadow ring
        grows OUTWARD from this div's edges, so with edges flush against
        the viewport (inset-0) the whole ring would render off-screen and
        never actually be visible. Caught via a real browser screenshot
        right after a drag release, which showed no glow at all.
      */}
      <div
        className={`pointer-events-none absolute inset-3 z-[5] rounded-[20px] ${refining ? "grid-refining" : ""}`}
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Top floating pill */}
        <div className="pointer-events-auto absolute inset-x-3 top-3 z-20 flex items-center gap-2 rounded-full border border-grid-border bg-sheet px-3 py-2 shadow-[0_0_20px_rgba(25,246,255,0.08)] md:left-1/2 md:right-auto md:w-[460px] md:-translate-x-1/2">
          <span className="shrink-0 text-xs font-bold tracking-[0.2em] text-grid-cyan">PLOT LINE</span>
          <PostcodeSearch
            onFound={handlePostcodeFound}
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
            inputClassName="min-w-0 flex-1 rounded-full border border-grid-border bg-ink/60 px-2.5 py-1 text-xs text-grid-text placeholder:text-grid-muted focus:border-grid-cyan focus:outline-none"
            buttonClassName="shrink-0 rounded-full bg-grid-cyan/90 px-2.5 py-1 text-xs font-semibold text-ink"
          />
          <span className="grid-live-dot h-2 w-2 shrink-0 rounded-full" aria-hidden title="Live" />
        </div>

        {/* Draw-flow action buttons */}
        <div className="pointer-events-auto absolute right-3 top-16 z-20 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setView3D((v) => !v)}
            aria-pressed={view3D}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[0_0_16px_rgba(139,92,255,0.35)] ${
              view3D ? "border-grid-violet bg-grid-violet text-ink" : "border-grid-border bg-sheet text-grid-text"
            }`}
          >
            {view3D ? "2D" : "3D"}
          </button>
          <button
            type="button"
            onClick={handleToggleMapTheme}
            aria-pressed={mapDark}
            className="rounded-full border border-grid-border bg-sheet px-3 py-1.5 text-xs font-medium text-grid-text"
          >
            Map: {mapDark ? "Dark" : "Light"}
          </button>
          {canFinishBoundary && (
            <button
              type="button"
              onClick={() => setMode("entrance")}
              className="rounded-full bg-grid-cyan px-3 py-1.5 text-xs font-semibold text-ink shadow-[0_0_16px_rgba(25,246,255,0.5)]"
            >
              Finish boundary
            </button>
          )}
          {boundary.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-grid-border bg-sheet px-3 py-1.5 text-xs font-medium text-grid-muted"
            >
              Reset
            </button>
          )}
        </div>

        <BottomSheet snap={sheetSnap} onSnapChange={setSheetSnap}>
          <div className="flex gap-2">
            <StatTile
              label="Homes"
              value={metrics ? String(metrics.totalUnits) : "—"}
              colorClass="text-grid-cyan"
              explain="How many homes this layout fits on the site, after every planning rule check."
            />
            <StatTile
              label="Most you can pay for the land"
              value={metrics ? gbp(metrics.residualLandValue) : "—"}
              colorClass="text-grid-lime"
              explain="The residual land value: what's left for the land once build costs and developer profit are taken out of the sales value. A simplified, single-point estimate, not a full cash-flow appraisal."
            />
            <StatTile
              label="Total sales value"
              value={metrics ? gbp(metrics.gdv) : "—"}
              colorClass="text-grid-magenta"
              explain="The gross development value: the total open-market sales value of every home in this layout."
            />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium text-grid-text">Home sizes</div>
            <div className="flex gap-2">
              {SIZE_TIERS.map((tier) => {
                const selected = (mix.sizeMix[tier] ?? 0) > 0;
                return (
                  <button
                    key={tier}
                    type="button"
                    disabled={mix.mode === "auto"}
                    aria-pressed={selected}
                    onClick={() => mix.setTierWeight(tier, selected ? 0 : 1)}
                    className={`flex-1 rounded-full border px-2 py-1.5 text-xs transition-colors ${
                      selected ? "border-grid-cyan bg-grid-cyan/15 font-bold text-grid-cyan" : "border-grid-border text-grid-muted"
                    } ${mix.mode === "auto" ? "opacity-50" : ""}`}
                  >
                    {tier}
                  </button>
                );
              })}
            </div>
            {(mix.sizeMix.Medium ?? 0) > 0 && mix.mode !== "auto" && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => mix.setIncludeBungalows(!mix.includeBungalows)}
                  className="text-[11px] text-grid-muted underline"
                >
                  {mix.includeBungalows ? "✓ " : ""}Include bungalows
                </button>
                <p className="mt-0.5 text-[10px] leading-snug text-grid-muted/70">{BUNGALOW_TOGGLE_HELP}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-medium text-grid-text">Let Plot Line pick the best mix</span>
            <button
              type="button"
              role="switch"
              aria-checked={mix.mode === "auto"}
              onClick={handleToggleAuto}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                mix.mode === "auto" ? "border-grid-violet bg-grid-violet/80" : "border-grid-border bg-panel"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-grid-text transition-transform ${
                  mix.mode === "auto" ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {mix.mode === "auto" && (
            <div className="mt-2 space-y-2">
              {optimizer.isRunning && <p className="text-[11px] text-grid-muted">Searching mixes…</p>}
              {optimizer.error && <p className="text-[11px] text-grid-amber">{optimizer.error}</p>}
              {optimizer.result?.failureExplanation && (
                <p className="text-[11px] text-grid-amber">{optimizer.result.failureExplanation}</p>
              )}
              {optimizer.result?.best && (
                <button
                  type="button"
                  onClick={() => mix.applyMixCandidate(optimizer.result!.best!.candidate)}
                  className="flex w-full items-center justify-between rounded-xl border border-grid-border bg-panel/60 px-3 py-2 text-left hover:border-grid-violet"
                >
                  <span>
                    <span className="block text-xs font-semibold text-grid-text">{MIX_CARD_COPY.best.title}</span>
                    <span className="block text-[11px] text-grid-muted">
                      {describeSizeMix(optimizer.result.best.candidate.sizeMix, optimizer.result.best.candidate.includeBungalows)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold text-grid-cyan">{optimizer.result.best.output.metrics.totalUnits} homes</span>
                    <span className="block text-[11px] text-grid-lime">{gbp(optimizer.result.best.output.metrics.residualLandValue)}</span>
                  </span>
                </button>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs">
            <Dot kind={complianceStatus.dot} />
            <span className="text-grid-text">{complianceStatus.text}</span>
            {liveLayout.isComputing && <span className="text-[10px] text-grid-cyan">Updating…</span>}
          </div>

          {metrics?.affordableValueOverstated && (
            <div className="mt-2 rounded-xl border border-grid-amber/40 bg-grid-amber/10 px-3 py-2 text-[11px] leading-snug text-grid-amber">
              <strong className="font-semibold">Affordable homes value is approximated</strong> — likely overstated, so
              treat the £ figures with caution.
            </div>
          )}

          {output && (
            <div className="mt-4 rounded-xl border border-grid-border">
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                aria-expanded={showDetail}
                className="w-full px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-grid-muted"
              >
                {showDetail ? "Hide" : "Show"} technical detail
              </button>
              {showDetail && (
                <div className="rounded-b-xl bg-white p-3 text-zinc-900">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Yield &amp; viability</h3>
                  <MetricsPanel metrics={output.metrics} />
                  <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Compliance (technical)
                  </h3>
                  <ComplianceList checks={output.compliance} proView />
                  <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Figure sources</h3>
                  <ProvenanceSummary entries={[...planningEntries, ...appraisalEntries]} />
                </div>
              )}
            </div>
          )}
        </BottomSheet>
      </div>
    </div>
  );
}

function StatTile({ label, value, colorClass, explain }: { label: string; value: string; colorClass: string; explain: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className="flex-1 rounded-2xl border border-grid-border bg-panel/60 px-3 py-3 text-left"
    >
      <div className={`grid-glow-text text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-grid-muted">{label}</div>
      {open && <p className="mt-2 text-[11px] leading-snug text-grid-muted">{explain}</p>}
    </button>
  );
}

const DOT_CLASS: Record<"green" | "amber" | "red" | "none", string> = {
  green: "bg-grid-green",
  amber: "bg-grid-amber",
  red: "bg-[#ff3b5c]",
  none: "bg-grid-border",
};

function Dot({ kind }: { kind: "green" | "amber" | "red" | "none" }) {
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[kind]}`} aria-hidden />;
}
