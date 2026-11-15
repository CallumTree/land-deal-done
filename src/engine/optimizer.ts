// Auto mix optimiser: searches candidate size-tier mixes within a time
// budget, discards anything that breaks a hard rule (any `fail` in the
// engine's own compliance output), and ranks what's left three ways —
// "Most homes" (totalUnits), "Most value" (residualLandValue) and
// "Balanced" (see BALANCED_WEIGHT below). Pure, deterministic, no DOM —
// lives beside generateLayout.ts for the same reason: it's meant to run
// inside the same Web Worker, not on the main thread.
//
// "Layout parameters such as road side/orientation" (mentioned in the
// brief) aren't independently searchable in this v0 engine: topology
// (double-loaded / single-sided / none) is fully DETERMINED by the
// boundary shape and the mix, not a free choice generateLayout takes as
// an input — see generateLayout.ts's topology fallback. The only real
// search dimension v0 has is the mix itself, so that's what's searched;
// this is stated explicitly rather than silently pretending to search a
// dimension that doesn't exist yet.

import { generateLayout } from "./generateLayout";
import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput } from "./types";
import { SIZE_TIERS, type SizeTier } from "./sizeTiers";

export interface MixCandidate {
  label: string;
  sizeMix: Partial<Record<SizeTier, number>>;
  includeBungalows: boolean;
}

export interface RankedCandidate {
  candidate: MixCandidate;
  output: EngineOutput;
}

export interface OptimizerResult {
  candidatesTried: number;
  compliantCount: number;
  elapsedMs: number;
  /** true if the time budget ran out before the candidate list was exhausted — candidatesTried may then be fewer than the full list. */
  timedOut: boolean;
  /** How many of candidatesTried were evaluated at draft quality instead of full, because the projected cost of finishing the list at full quality exceeded the remaining time budget. 0 on a fast site — the adaptive switch-over never triggers there. */
  draftFallbackCount: number;
  mostHomes: RankedCandidate | null;
  mostValue: RankedCandidate | null;
  balanced: RankedCandidate | null;
  /** Plain-English explanation, set ONLY when every candidate tried was non-compliant (mostHomes/mostValue/balanced are all null). */
  failureExplanation: string | null;
}

/** Weight given to normalized totalUnits vs normalized residualLandValue in the "Balanced" ranking. 0.5/0.5 — a modelling choice, not a sourced figure. */
const BALANCED_UNITS_WEIGHT = 0.5;

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fixed, deterministic candidate list — no Math.random, a seeded PRNG
 * only for the "extra coverage" tail — so the SAME inputs always produce
 * the SAME candidate order and (modulo the time budget cutting the list
 * short at a different point under CPU load) the same winners.
 */
function buildCandidateList(includeBungalowOption: boolean): MixCandidate[] {
  const candidates: MixCandidate[] = [];
  const push = (label: string, sizeMix: Partial<Record<SizeTier, number>>, includeBungalows: boolean) =>
    candidates.push({ label, sizeMix, includeBungalows });

  // 1. Auto (equal weight here — the real jurisdiction-sourced Auto
  //    default is already what generateLayout falls back to when no
  //    mix/sizeMix is given at all; included explicitly so it's always
  //    one of the candidates compared against, not just an implicit default).
  push("Auto (equal tiers)", { Small: 1, Medium: 1, Large: 1, XL: 1 }, false);
  if (includeBungalowOption) push("Auto (equal tiers, with bungalows)", { Small: 1, Medium: 1, Large: 1, XL: 1 }, true);

  // 2. Pure single-tier candidates.
  for (const tier of SIZE_TIERS) {
    push(`All ${tier}`, { [tier]: 1 }, false);
  }
  if (includeBungalowOption) push("All Medium, with bungalows", { Medium: 1 }, true);

  // 3. A fixed set of skewed combinations — every permutation of weights
  //    [3,2,1,0] across the 4 tiers (24 permutations), covering "mostly
  //    Small", "mostly XL", etc. without an unbounded combinatorial blow-up.
  const weights = [3, 2, 1, 0];
  const permute = (arr: number[]): number[][] => {
    if (arr.length <= 1) return [arr];
    const out: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of permute(rest)) out.push([arr[i], ...p]);
    }
    return out;
  };
  for (const perm of permute(weights)) {
    const sizeMix = Object.fromEntries(SIZE_TIERS.map((t, i) => [t, perm[i]])) as Partial<Record<SizeTier, number>>;
    push(`Skewed ${perm.join("/")} (S/M/L/XL)`, sizeMix, false);
  }

  // 4. Deterministic (seeded) extra coverage, in case the time budget
  //    allows more than the ~30 fixed candidates above.
  const rand = mulberry32(1337);
  for (let i = 0; i < 40; i++) {
    const sizeMix = Object.fromEntries(SIZE_TIERS.map((t) => [t, Math.round(rand() * 3)])) as Partial<Record<SizeTier, number>>;
    push(`Random seed-1337 #${i}`, sizeMix, includeBungalowOption && rand() > 0.5);
  }

  return candidates;
}

/**
 * Adaptive quality switch-over: after each candidate, project whether
 * there's realistically enough budget left to run the REST of the list
 * at full quality (using the running average cost-per-candidate seen so
 * far). If not, the remaining candidates switch to draft quality instead
 * of the search simply timing out and returning nothing for them. On a
 * fast site this never triggers — the whole list finishes at full
 * quality, identical to a non-adaptive sweep. On a slow, complex site
 * (e.g. a large multi-loop boundary), only the TAIL of the list degrades
 * to draft, rather than the search just running out of clock and
 * silently giving up on most of the list. A safety margin (this
 * constant) means the switch-over triggers a little early rather than
 * right at the edge, since the average cost-per-candidate estimate is
 * noisy with only a few samples.
 */
const ADAPTIVE_SAFETY_MARGIN = 1.3;

export function optimizeMix(
  boundary: BNGPolygon,
  entrance: BNGPoint,
  baseInputs: EngineInputs,
  opts: { timeBudgetMs?: number } = {}
): OptimizerResult {
  const timeBudgetMs = opts.timeBudgetMs ?? 1000;
  const start = performance.now();

  const candidates = buildCandidateList(true);
  const compliant: RankedCandidate[] = [];
  const failureCounts = new Map<string, number>();
  let candidatesTried = 0;
  let timedOut = false;
  let draftFallbackCount = 0;
  let fullCostTotalMs = 0;
  let fullCostSamples = 0;

  for (let i = 0; i < candidates.length; i++) {
    const elapsed = performance.now() - start;
    if (elapsed > timeBudgetMs) {
      timedOut = true;
      break;
    }
    const candidate = candidates[i];
    const remainingCandidates = candidates.length - i;
    const remainingBudget = timeBudgetMs - elapsed;
    const avgFullCost = fullCostSamples > 0 ? fullCostTotalMs / fullCostSamples : 0;
    const projectedFullCost = avgFullCost * remainingCandidates * ADAPTIVE_SAFETY_MARGIN;
    // Only degrade to draft once we have a real cost estimate (a few full
    // samples in) AND that estimate says the rest of the list won't fit.
    const useDraft = fullCostSamples >= 3 && projectedFullCost > remainingBudget;

    candidatesTried++;
    if (useDraft) draftFallbackCount++;
    const inputs: EngineInputs = {
      ...baseInputs,
      mix: undefined,
      sizeMix: candidate.sizeMix,
      includeBungalows: candidate.includeBungalows,
      quality: useDraft ? "draft" : "full",
    };
    const callStart = performance.now();
    let output: EngineOutput;
    try {
      output = generateLayout(boundary, entrance, inputs);
    } catch {
      continue;
    }
    if (!useDraft) {
      fullCostTotalMs += performance.now() - callStart;
      fullCostSamples++;
    }
    const failing = output.compliance.filter((c) => c.status === "fail");
    if (failing.length === 0 && output.metrics.totalUnits > 0) {
      compliant.push({ candidate, output });
    } else {
      const reason = failing[0]?.label ?? (output.metrics.totalUnits === 0 ? "No units placed" : "Unknown");
      failureCounts.set(reason, (failureCounts.get(reason) ?? 0) + 1);
    }
  }

  const elapsedMs = performance.now() - start;

  if (compliant.length === 0) {
    const sortedReasons = [...failureCounts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sortedReasons[0];
    const failureExplanation = top
      ? `No compliant layout found among ${candidatesTried} mix${candidatesTried === 1 ? "" : "es"} tried${timedOut ? " (time budget ran out)" : ""}. The most common reason: "${top[0]}" (${top[1]}/${candidatesTried} candidates). Try a different entrance point or a less ambitious mix.`
      : `No compliant layout found among ${candidatesTried} mixes tried — every candidate produced zero buildable units. This site/entrance combination may be too small or too awkwardly shaped for any mix v0 can place.`;
    return { candidatesTried, compliantCount: 0, elapsedMs, timedOut, draftFallbackCount, mostHomes: null, mostValue: null, balanced: null, failureExplanation };
  }

  const mostHomes = compliant.reduce((best, c) => (c.output.metrics.totalUnits > best.output.metrics.totalUnits ? c : best));
  const mostValue = compliant.reduce((best, c) => (c.output.metrics.residualLandValue > best.output.metrics.residualLandValue ? c : best));

  const maxUnits = Math.max(...compliant.map((c) => c.output.metrics.totalUnits));
  const minUnits = Math.min(...compliant.map((c) => c.output.metrics.totalUnits));
  const maxRlv = Math.max(...compliant.map((c) => c.output.metrics.residualLandValue));
  const minRlv = Math.min(...compliant.map((c) => c.output.metrics.residualLandValue));
  const norm = (v: number, lo: number, hi: number) => (hi > lo ? (v - lo) / (hi - lo) : 1);
  const balanced = compliant.reduce((best, c) => {
    const score =
      BALANCED_UNITS_WEIGHT * norm(c.output.metrics.totalUnits, minUnits, maxUnits) +
      (1 - BALANCED_UNITS_WEIGHT) * norm(c.output.metrics.residualLandValue, minRlv, maxRlv);
    const bestScore =
      BALANCED_UNITS_WEIGHT * norm(best.output.metrics.totalUnits, minUnits, maxUnits) +
      (1 - BALANCED_UNITS_WEIGHT) * norm(best.output.metrics.residualLandValue, minRlv, maxRlv);
    return score > bestScore ? c : best;
  });

  return {
    candidatesTried,
    compliantCount: compliant.length,
    elapsedMs,
    timedOut,
    draftFallbackCount,
    mostHomes,
    mostValue,
    balanced,
    failureExplanation: null,
  };
}
