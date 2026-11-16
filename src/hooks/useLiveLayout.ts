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

  useEffect(() => {
    if (boundary.length < 3 || !entrance) {
      setOutput(null);
      setIsComputing(false);
      setError(null);
      topologyHintRef.current = undefined;
      return;
    }

    const seq = ++latestSeqRef.current;
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
        topologyHintRef.current = result.metrics.topologyUsed === "none" ? undefined : result.metrics.topologyUsed;
        setOutput(result);
        setIsComputing(false);
        setError(null);
      })
      .catch((err: Error) => {
        if (seq !== latestSeqRef.current) return;
        setIsComputing(false);
        setError(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary, entrance, inputs, isDragging, worker]);

  return { output, isComputing, error };
}
