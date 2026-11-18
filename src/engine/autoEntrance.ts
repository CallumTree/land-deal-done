// Auto-entrance: when the user hasn't dragged/tapped an entrance of
// their own, suggests one by trying a spread of candidate points along
// the boundary's own edges and picking the best by the SAME objective
// the mix optimiser already uses (optimizer.ts) — compliant first, then
// highest residual land value. Pure engine code, no DOM — lives beside
// generateLayout.ts/optimizer.ts for the same reason: it's meant to run
// on the worker, not the main thread.
//
// "Prefer edges adjacent to a road, otherwise all edges" (the brief):
// this engine has no road-network/frontage data source at all right now
// — nothing in src/ resolves which boundary edge, if any, fronts a real
// road — so there is nothing to prefer BY, and this tries every edge
// uniformly. Said plainly rather than quietly pretending a preference
// exists: add road-adjacency weighting here the day that data source is
// actually wired in, not before.

import { generateLayout } from "./generateLayout";
import * as geo from "./geometry";
import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput } from "./types";

export interface EntranceSuggestion {
  entrance: BNGPoint;
  output: EngineOutput;
}

/** Target spacing between candidate entrance points along an edge — "every 5-10m" per the brief; 8m splits that range. */
const CANDIDATE_SPACING_M = 8;

/** Default candidate budget when the caller doesn't say — draft (live drag) stays cheap; full (idle) searches more thoroughly. Caching note: this only runs from an effect gated on boundary/inputs actually changing (see useAutoEntrance.ts) — there is no redundant re-search to cache against beyond what that dependency-gating already gives for free, so no separate memo layer is added here. */
const DEFAULT_MAX_CANDIDATES_DRAFT = 8;
const DEFAULT_MAX_CANDIDATES_FULL = 24;

/** Soft wall-clock budget, mirroring optimizer.ts's own timeBudgetMs pattern — stops trying further candidates once exceeded rather than let one pathological boundary make the whole suggestion open-ended, but always returns the best candidate found so far, never nothing. */
const DEFAULT_TIME_BUDGET_MS_DRAFT = 150;
const DEFAULT_TIME_BUDGET_MS_FULL = 1000;

/** Midpoint-biased candidate points spread along every edge at ~CANDIDATE_SPACING_M, evenly subsampled down to `maxCandidates` if the boundary's edges would naturally produce more than that. */
function candidateEntrances(boundary: BNGPolygon, maxCandidates: number): BNGPoint[] {
  const ring = geo.stripClosingDuplicate(boundary);
  const raw: BNGPoint[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const edgeLen = Math.hypot(dx, dy);
    const n = Math.max(1, Math.round(edgeLen / CANDIDATE_SPACING_M));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      raw.push([a[0] + dx * t, a[1] + dy * t]);
    }
  }
  if (raw.length <= maxCandidates) return raw;
  const step = raw.length / maxCandidates;
  const picked: BNGPoint[] = [];
  for (let i = 0; i < maxCandidates; i++) picked.push(raw[Math.floor(i * step)]);
  return picked;
}

function isCompliant(output: EngineOutput): boolean {
  return output.metrics.totalUnits > 0 && output.compliance.every((c) => c.status !== "fail");
}

export function suggestEntrance(
  boundary: BNGPolygon,
  inputs: EngineInputs,
  opts: { maxCandidates?: number; timeBudgetMs?: number } = {}
): EntranceSuggestion {
  const draft = inputs.quality === "draft";
  const maxCandidates = opts.maxCandidates ?? (draft ? DEFAULT_MAX_CANDIDATES_DRAFT : DEFAULT_MAX_CANDIDATES_FULL);
  const timeBudgetMs = opts.timeBudgetMs ?? (draft ? DEFAULT_TIME_BUDGET_MS_DRAFT : DEFAULT_TIME_BUDGET_MS_FULL);
  const candidates = candidateEntrances(boundary, maxCandidates);

  const start = performance.now();
  let best: EntranceSuggestion | null = null;
  let bestCompliant = false;
  let bestUnits = -1;

  for (const candidate of candidates) {
    if (performance.now() - start > timeBudgetMs && best) break;
    let output: EngineOutput;
    try {
      output = generateLayout(boundary, candidate, inputs);
    } catch {
      continue; // a candidate too close to a vertex can fall outside entranceEdgeFrame's tolerance — skip it, try the next
    }
    const compliant = isCompliant(output);
    if (compliant) {
      if (!bestCompliant || output.metrics.residualLandValue > best!.output.metrics.residualLandValue) {
        best = { entrance: candidate, output };
        bestCompliant = true;
      }
    } else if (!bestCompliant && output.metrics.totalUnits > bestUnits) {
      best = { entrance: candidate, output };
      bestUnits = output.metrics.totalUnits;
    }
  }

  if (best) return best;

  // Every candidate threw (a genuinely degenerate boundary) — fall back
  // to the first edge's own midpoint so a suggestion always exists.
  const ring = geo.stripClosingDuplicate(boundary);
  const fallbackEntrance: BNGPoint = [(ring[0][0] + ring[1][0]) / 2, (ring[0][1] + ring[1][1]) / 2];
  return { entrance: fallbackEntrance, output: generateLayout(boundary, fallbackEntrance, inputs) };
}
