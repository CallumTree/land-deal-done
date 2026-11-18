"use client";

// Runs the auto mix optimiser (src/engine/optimizer.ts) on demand via the
// engine worker — a one-shot "Run" action, not something driven live off
// every input change like useLiveLayout. Exposes the single best-mix
// result plus the plain-English failure case.

import { useCallback, useMemo, useRef, useState } from "react";
import type { BNGPoint, BNGPolygon, EngineInputs } from "@/engine/types";
import type { OptimizerResult } from "@/engine/optimizer";
import type { UseEngineWorkerResult } from "./useEngineWorker";

export interface UseOptimizerResult {
  result: OptimizerResult | null;
  isRunning: boolean;
  error: string | null;
  run(boundary: BNGPolygon, entrance: BNGPoint, inputs: EngineInputs, timeBudgetMs?: number): void;
}

export function useOptimizer(worker: UseEngineWorkerResult): UseOptimizerResult {
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const run = useCallback(
    (boundary: BNGPolygon, entrance: BNGPoint, inputs: EngineInputs, timeBudgetMs?: number) => {
      const seq = ++seqRef.current;
      setIsRunning(true);
      setError(null);
      worker
        .requestOptimize(boundary, entrance, inputs, timeBudgetMs)
        .then((r) => {
          if (seq !== seqRef.current) return; // superseded by a newer run — discard
          setResult(r);
          setIsRunning(false);
        })
        .catch((err: Error) => {
          if (seq !== seqRef.current) return;
          setIsRunning(false);
          setError(err.message);
        });
    },
    [worker]
  );

  // Memoized for the same reason as useEngineWorker's and useMixState's
  // return values — see their comments. Not currently wired into another
  // hook's effect dependencies, but keeping the same contract (stable
  // reference unless the actual contents changed) across all of these
  // hooks avoids reintroducing the same class of bug the moment one is.
  return useMemo(() => ({ result, isRunning, error, run }), [result, isRunning, error, run]);
}
