"use client";

// Low-level transport hook: owns a single engine Web Worker instance and
// exposes promise-based request/response calls over it. No debouncing,
// no latest-wins logic here — that's the job of the hooks built on top
// (useLiveLayout, useOptimizer), which know what "latest" means for
// their own use case. This hook only knows how to talk to the worker.

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput } from "@/engine/types";
import type { OptimizerResult } from "@/engine/optimizer";
import type { EntranceSuggestion } from "@/engine/autoEntrance";
import type { WorkerRequestMessage, WorkerResponseMessage } from "@/engine/workerProtocol";

let requestCounter = 0;
function nextRequestId(): string {
  requestCounter += 1;
  return `req-${requestCounter}`;
}

interface PendingEntry {
  resolve: (value: EngineOutput | OptimizerResult | EntranceSuggestion) => void;
  reject: (reason: Error) => void;
}

export interface UseEngineWorkerResult {
  /** Runs a full layout generation on the worker. Rejects if the engine itself throws (e.g. a malformed boundary). */
  requestLayout(boundary: BNGPolygon, entrance: BNGPoint, inputs: EngineInputs): Promise<EngineOutput>;
  /** Runs the mix optimiser on the worker. Rejects only on an unexpected engine throw — "no compliant mix found" is a normal OptimizerResult, not a rejection. */
  requestOptimize(boundary: BNGPolygon, entrance: BNGPoint, inputs: EngineInputs, timeBudgetMs?: number): Promise<OptimizerResult>;
  /** Suggests an entrance point on the worker — see autoEntrance.ts. Rejects only on an unexpected engine throw. */
  requestSuggestEntrance(boundary: BNGPolygon, inputs: EngineInputs, maxCandidates?: number): Promise<EntranceSuggestion>;
}

export function useEngineWorker(): UseEngineWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingEntry>>(new Map());

  useEffect(() => {
    const worker = new Worker(new URL("../engine/worker-entry.ts", import.meta.url));
    const pending = pendingRef.current; // captured once — always the same Map instance for this hook's lifetime
    worker.onmessage = (e: MessageEvent<WorkerResponseMessage>) => {
      const msg = e.data;
      const entry = pending.get(msg.requestId);
      if (!entry) return; // response for a request nobody's waiting on (unmounted, or genuinely stale) — drop it
      pending.delete(msg.requestId);
      if (msg.kind === "layout") {
        if (msg.ok) entry.resolve(msg.output);
        else entry.reject(new Error(msg.error));
      } else {
        if (msg.ok) entry.resolve(msg.result);
        else entry.reject(new Error(msg.error));
      }
      // (optimize and suggestEntrance both carry `result` + `ok`, so the branch above handles both — kept as one `else` rather than a third branch for exactly that reason.)
    };
    worker.onerror = (e) => {
      // A worker-level error (e.g. a syntax/load failure) has no requestId
      // to route to — reject everything outstanding so no caller hangs.
      for (const entry of pending.values()) {
        entry.reject(new Error(e.message || "Engine worker error"));
      }
      pending.clear();
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.clear();
    };
  }, []);

  const requestLayout = useCallback(
    (boundary: BNGPolygon, entrance: BNGPoint, inputs: EngineInputs): Promise<EngineOutput> => {
      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error("Engine worker not ready"));
          return;
        }
        const requestId = nextRequestId();
        pendingRef.current.set(requestId, { resolve: resolve as PendingEntry["resolve"], reject });
        const msg: WorkerRequestMessage = { kind: "layout", requestId, boundary, entrance, inputs };
        worker.postMessage(msg);
      });
    },
    []
  );

  const requestOptimize = useCallback(
    (boundary: BNGPolygon, entrance: BNGPoint, inputs: EngineInputs, timeBudgetMs?: number): Promise<OptimizerResult> => {
      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error("Engine worker not ready"));
          return;
        }
        const requestId = nextRequestId();
        pendingRef.current.set(requestId, { resolve: resolve as PendingEntry["resolve"], reject });
        const msg: WorkerRequestMessage = { kind: "optimize", requestId, boundary, entrance, inputs, timeBudgetMs };
        worker.postMessage(msg);
      });
    },
    []
  );

  const requestSuggestEntrance = useCallback(
    (boundary: BNGPolygon, inputs: EngineInputs, maxCandidates?: number): Promise<EntranceSuggestion> => {
      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error("Engine worker not ready"));
          return;
        }
        const requestId = nextRequestId();
        pendingRef.current.set(requestId, { resolve: resolve as PendingEntry["resolve"], reject });
        const msg: WorkerRequestMessage = { kind: "suggestEntrance", requestId, boundary, inputs, maxCandidates };
        worker.postMessage(msg);
      });
    },
    []
  );

  // Memoized: requestLayout/requestOptimize/requestSuggestEntrance are
  // individually stable (useCallback, empty deps), but without this the
  // WRAPPING object would still be a fresh literal every render — and
  // useLiveLayout's effect takes this whole object as a dependency, so
  // an unstable reference here would retrigger it on every render of
  // whatever consumes this hook, with no real input change behind it.
  // Found via the same infinite-recompute-loop browser test that caught
  // useMixState's identical issue — this was the OTHER half of it.
  return useMemo(
    () => ({ requestLayout, requestOptimize, requestSuggestEntrance }),
    [requestLayout, requestOptimize, requestSuggestEntrance]
  );
}
