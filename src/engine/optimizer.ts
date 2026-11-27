// Auto mix optimiser: searches a small set of size-tier mixes ANCHORED ON
// the council's own sourced dwelling-mix policy (a jurisdiction's
// `defaultAutoSizeMixPercent` — the exact evidence-based split
// generateLayout.ts itself falls back to as "Auto", see its own
// resolveEffectiveHouseMix), discards anything that breaks a hard rule
// (any `fail` in the engine's own compliance output), and picks the one
// surviving candidate with the highest residualLandValue. Pure,
// deterministic, no DOM — lives beside generateLayout.ts for the same
// reason: it's meant to run inside the same Web Worker, not on the main
// thread.
//
// Single objective, by design (first-principles audit, see CLAUDE.md
// "challenge every screen and every click"): a prior version searched the
// mix space UNCONSTRAINED — every pure single-tier mix, all 24
// permutations of a [3,2,1,0] weight sweep, and 40 extra seeded-random
// mixes — and ranked the survivors three ways ("Most homes" / "Most
// value" / "Balanced"), handing the user three philosophies to choose
// between with no steer on which is actually sound planning. Almost none
// of that unconstrained space reflects what a real LPA's dwelling-mix
// policy would accept; offering "All XL" or a random skew as a selectable
// "winner" was offering non-starters. Collapsing to "maximise residual
// land value among mixes within the council's own policy band" removes
// that false choice: there's one defensible objective (RLV is what a
// seller/developer actually cares about), and the search only ever
// considers mixes a real planning officer would recognise as close to
// the adopted evidence base, not a wide search of mixes nobody would
// approve.
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
import { resolveJurisdiction } from "../rules/jurisdictions";
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
  /** The compliant, policy-anchored candidate with the highest residualLandValue — the optimiser's one objective. Null only when every candidate tried was non-compliant (see failureExplanation). */
  best: RankedCandidate | null;
  /** Plain-English explanation, set ONLY when every candidate tried was non-compliant (best is null). */
  failureExplanation: string | null;
}

/**
 * How far a candidate may stray from the council's policy mix, in
 * percentage points moved from one tier to an adjacent one. Small enough
 * that every candidate stays recognisably close to the adopted evidence
 * base — this is a local search around policy, not a free search of the
 * mix space (see the module comment above for why that distinction
 * matters). Not a sourced figure itself — a modelling choice for how wide
 * a "still within policy" band is read as.
 */
const POLICY_SHIFT_PERCENT = 10;

/**
 * Builds the policy-anchored search list: the council's own Auto mix
 * (percent weights — see resolveEffectiveHouseMix's identical fallback in
 * generateLayout.ts, kept in lockstep with it here rather than
 * re-deriving a second notion of "the default mix"), plus one shift of
 * POLICY_SHIFT_PERCENT between each pair of ADJACENT size tiers in both
 * directions (Small<->Medium, Medium<->Large, Large<->XL) — covering
 * "a bit more of the next tier up/down" without wandering into a mix no
 * real LPA mix policy resembles. Each mix is also tried with bungalows
 * included when it carries any Medium weight, since that's a free (non-
 * mix-changing) toggle, not a different policy position. A fixed,
 * deterministic list — no randomness, no unconstrained sweep — so the
 * same inputs always produce the same candidates in the same order.
 */
function buildCandidateList(policyMixPercent: Record<SizeTier, number>): MixCandidate[] {
  const candidates: MixCandidate[] = [];
  const push = (label: string, sizeMix: Partial<Record<SizeTier, number>>, includeBungalows: boolean) =>
    candidates.push({ label, sizeMix, includeBungalows });

  const tryBothBungalowOptions = (label: string, sizeMix: Partial<Record<SizeTier, number>>) => {
    push(label, sizeMix, false);
    if ((sizeMix.Medium ?? 0) > 0) push(`${label}, with bungalows`, sizeMix, true);
  };

  tryBothBungalowOptions("Council policy mix", { ...policyMixPercent });

  for (let i = 0; i < SIZE_TIERS.length - 1; i++) {
    const from = SIZE_TIERS[i];
    const to = SIZE_TIERS[i + 1];
    for (const [giver, taker] of [
      [from, to],
      [to, from],
    ] as const) {
      if (policyMixPercent[giver] <= 0) continue; // nothing to shift from an already-zero tier
      const shift = Math.min(POLICY_SHIFT_PERCENT, policyMixPercent[giver]);
      const sizeMix: Partial<Record<SizeTier, number>> = { ...policyMixPercent };
      sizeMix[giver] = policyMixPercent[giver] - shift;
      sizeMix[taker] = (policyMixPercent[taker] ?? 0) + shift;
      tryBothBungalowOptions(`Policy mix, +${shift}% ${taker} / -${shift}% ${giver}`, sizeMix);
    }
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

  // Same fallback generateLayout.ts's resolveEffectiveHouseMix uses for
  // "Auto": the jurisdiction's own sourced dwelling-mix evidence, or an
  // equal Small/Medium/Large split (XL excluded) if no local pack
  // resolved at all.
  const jurisdiction = resolveJurisdiction(baseInputs.localAuthority);
  const policyMixPercent: Record<SizeTier, number> = jurisdiction.localAppraisal
    ? (Object.fromEntries(SIZE_TIERS.map((t) => [t, jurisdiction.localAppraisal!.defaultAutoSizeMixPercent[t].value])) as Record<SizeTier, number>)
    : { Small: 1, Medium: 1, Large: 1, XL: 0 };

  const candidates = buildCandidateList(policyMixPercent);
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
    return { candidatesTried, compliantCount: 0, elapsedMs, timedOut, draftFallbackCount, best: null, failureExplanation };
  }

  const best = compliant.reduce((b, c) => (c.output.metrics.residualLandValue > b.output.metrics.residualLandValue ? c : b));

  return {
    candidatesTried,
    compliantCount: compliant.length,
    elapsedMs,
    timedOut,
    draftFallbackCount,
    best,
    failureExplanation: null,
  };
}
