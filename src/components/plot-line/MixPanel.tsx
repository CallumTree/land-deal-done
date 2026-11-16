"use client";

// Shared mix controls: Auto (jurisdiction default) vs Manual size-tier
// sliders + bungalow toggle, plus the auto-optimiser's "Run" action and
// its three ranked cards. Shared between /style-a and /style-b — this is
// the same interaction/business logic regardless of visual style, so it
// lives in one place rather than being duplicated with only className
// differences. Deliberately minimal own chrome (text/controls only, no
// background/border on the outer element) so each style's own container
// can wrap it in a plain card or a glass panel without this component
// fighting that treatment.

import type { BNGPoint, BNGPolygon, EngineInputs } from "@/engine/types";
import type { SizeTier } from "@/engine/sizeTiers";
import { SIZE_TIERS } from "@/engine/sizeTiers";
import type { UseMixStateResult } from "@/hooks/useMixState";
import type { UseOptimizerResult } from "@/hooks/useOptimizer";
import { SIZE_TIER_LABEL, BUNGALOW_TOGGLE_HELP, describeSizeMix, MIX_CARD_COPY } from "@/copy/labels";

export interface MixPanelProps {
  mix: UseMixStateResult;
  optimizer: UseOptimizerResult;
  boundary: BNGPolygon;
  entrance: BNGPoint | null;
  /** Everything the optimiser needs EXCEPT mix/sizeMix/includeBungalows/quality/previousTopologyHint — it supplies its own per-candidate. */
  baseInputs: Omit<EngineInputs, "mix" | "sizeMix" | "includeBungalows" | "quality" | "previousTopologyHint">;
  accentClassName?: string;
}

const DEFAULT_ACCENT = "accent-sky-500";

export function MixPanel({ mix, optimizer, boundary, entrance, baseInputs, accentClassName = DEFAULT_ACCENT }: MixPanelProps) {
  const canRunOptimizer = boundary.length >= 3 && entrance !== null;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">House mix</h3>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 text-[11px] dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => mix.setMode("auto")}
              className={`rounded-md px-2 py-0.5 font-medium transition ${
                mix.mode === "auto" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500"
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => mix.setMode("manual")}
              className={`rounded-md px-2 py-0.5 font-medium transition ${
                mix.mode === "manual" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500"
              }`}
            >
              Manual
            </button>
          </div>
        </div>

        {mix.mode === "auto" ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Uses this council&apos;s own typical housing mix. Switch to Manual to set your own, or run the
            optimiser below for ranked suggestions.
          </p>
        ) : (
          <div className="space-y-2">
            {SIZE_TIERS.map((tier: SizeTier) => (
              <label key={tier} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-zinc-600 dark:text-zinc-400">{SIZE_TIER_LABEL[tier]}</span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={mix.sizeMix[tier] ?? 0}
                  onChange={(e) => mix.setTierWeight(tier, Number(e.target.value))}
                  className={`flex-1 ${accentClassName}`}
                />
                <span className="w-4 text-right text-zinc-700 dark:text-zinc-300">{mix.sizeMix[tier] ?? 0}</span>
              </label>
            ))}
          </div>
        )}

        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={mix.includeBungalows}
            onChange={(e) => mix.setIncludeBungalows(e.target.checked)}
            className={accentClassName}
          />
          Include bungalows
        </label>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{BUNGALOW_TOGGLE_HELP}</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Auto mix suggestions</h3>
          <button
            type="button"
            disabled={!canRunOptimizer || optimizer.isRunning}
            onClick={() => optimizer.run(boundary, entrance!, baseInputs, 2000)}
            className="rounded-md bg-sky-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
          >
            {optimizer.isRunning ? "Searching…" : "Run"}
          </button>
        </div>

        {!canRunOptimizer && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Draw a boundary and set an entrance first.</p>
        )}
        {optimizer.error && <p className="text-[11px] text-red-600">{optimizer.error}</p>}
        {optimizer.result?.failureExplanation && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">{optimizer.result.failureExplanation}</p>
        )}

        {optimizer.result && !optimizer.result.failureExplanation && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["mostHomes", "mostValue", "balanced"] as const).map((kind) => {
              const ranked = optimizer.result![kind];
              if (!ranked) return null;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => mix.applyMixCandidate(ranked.candidate)}
                  className="rounded-lg border border-zinc-200 p-2 text-left text-[11px] transition hover:border-sky-400 hover:bg-sky-50/50 dark:border-zinc-700 dark:hover:bg-sky-950/20"
                >
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">{MIX_CARD_COPY[kind].title}</div>
                  <div className="text-zinc-500 dark:text-zinc-400">{describeSizeMix(ranked.candidate.sizeMix, ranked.candidate.includeBungalows)}</div>
                  <div className="mt-1 flex gap-2 text-zinc-600 dark:text-zinc-300">
                    <span>{ranked.output.metrics.totalUnits} homes</span>
                    <span>£{Math.round(ranked.output.metrics.residualLandValue).toLocaleString()} RLV</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
