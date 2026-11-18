"use client";

// Drives generateLayout() live on the engine worker as boundary/entrance/
// inputs change, with latest-wins result handling and layout-stability
// hysteresis wired through automatically.
//
// Latest-wins, honestly stated: the worker is a single JS thread, so if
// request A (e.g. a slow full-quality recalc) is still running when
// request B (the next input change) is posted, the worker finishes A
// before even looking at B — there is no mid-computation cancellation,
// because generateLayout() has no abort signal to check. What this hook
// actually guarantees is that a STALE response never overwrites a newer
// one in React state (via the sequence-number check below), so the UI
// converges on the correct final result instead of flickering backwards.
// It does NOT skip the wasted CPU work of finishing a superseded
// request. Draft quality mode (isDragging=true) is the real mitigation
// for that: each individual request is cheap enough that the worker's
// queue drains quickly even during a fast drag, rather than relying on
// cancellation that doesn't exist.
import { useEffect, useRef, useState } from "react";
import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput } from "@/engine/types";
import type { UseEngineWorkerResult } from "./useEngineWorker";

export interface UseLiveLayoutOptions {
  boundary: BNGPolygon;
  entrance: BNGPoint | null;
  /**
   * Mix/parking/garden/etc inputs — everything EXCEPT `quality` and
   * `previousTopologyHint`, which this hook manages itself. Must be
   * referentially stable across renders that shouldn't trigger a
   * recalculation (e.g. via useMemo) — it's used as a raw effect
   * dependency.
   */
  inputs: Omit<EngineInputs, "quality" | "previousTopologyHint">;
  /** true while the user is actively dragging a vertex/entrance — runs at draft quality for responsiveness. Any change while false runs at full quality. */
  isDragging?: boolean;
}

export interface UseLiveLayoutResult {
  output: EngineOutput | null;
  isComputing: boolean;
  error: string | null;
}

export function useLiveLayout(worker: UseEngineWorkerResult, opts: UseLiveLayoutOptions): UseLiveLayoutResult {
  const { boundary, entrance, inputs, isDragging = false } = opts;
  const [output, setOutput] = useState<EngineOutput | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestSeqRef = useRef(0);
  const topologyHintRef = useRef<EngineInputs["previousTopologyHint"]>(undefined);
  const isValid = boundary.length >= 3 && entrance !== null;

  useEffect(() => {
    if (!isValid) {
      // Nothing to compute — bump the sequence so any in-flight request's
      // result gets discarded as stale, and reset hysteresis. The
      // output/isComputing/error returned below are overridden to
      // null/false/null directly (see the return statement) rather than
      // via setState here, so an invalid input never causes a render-
      // triggered state update inside this effect.
      latestSeqRef.current++;
      topologyHintRef.current = undefined;
      return;
    }

    const seq = ++latestSeqRef.current;
    // Standard "effect kicks off an async fetch, flip a loading flag
    // first" pattern — this stricter lint rule flags any synchronous
    // setState in an effect body on principle, but there's no React-
    // idiomatic way to show a loading state for an effect-triggered
    // async request without one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsComputing(true);

    const fullInputs: EngineInputs = {
      ...inputs,
      quality: isDragging ? "draft" : "full",
      previousTopologyHint: topologyHintRef.current,
    };

    worker
      .requestLayout(boundary, entrance, fullInputs)
      .then((result) => {
        if (seq !== latestSeqRef.current) return; // superseded by a newer request — discard
        // The hint only ever steers the estate-road left/right tie-break
        // (see generateLayout.ts) — "none" and "frontage-ribbon" are both
        // not a side to remember.
        const used = result.metrics.topologyUsed;
        topologyHintRef.current = used === "double" || used === "single-left" || used === "single-right" ? used : undefined;
        setOutput(result);
        setIsComputing(false);
        setError(null);
      })
      .catch((err: Error) => {
        if (seq !== latestSeqRef.current) return;
        setIsComputing(false);
        setError(err.message);
      });
  }, [isValid, boundary, entrance, inputs, isDragging, worker]);

  if (!isValid) {
    return { output: null, isComputing: false, error: null };
  }
  return { output, isComputing, error };
}
