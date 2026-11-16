"use client";

// Runs the auto mix optimiser (src/engine/optimizer.ts) on demand via the
// engine worker — a one-shot "Run" action, not something driven live off
// every input change like useLiveLayout. Exposes the three ranked cards
// (mostHomes/mostValue/balanced) plus the plain-English failure case.

import { useCallback, useRef, useState } from "react";
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

  return { result, isRunning, error, run };
}
