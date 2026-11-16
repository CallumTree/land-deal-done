"use client";

// Low-level transport hook: owns a single engine Web Worker instance and
// exposes promise-based request/response calls over it. No debouncing,
// no latest-wins logic here — that's the job of the hooks built on top
// (useLiveLayout, useOptimizer), which know what "latest" means for
// their own use case. This hook only knows how to talk to the worker.

import { useCallback, useEffect, useRef } from "react";
import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput } from "@/engine/types";
import type { OptimizerResult } from "@/engine/optimizer";
import type { WorkerRequestMessage, WorkerResponseMessage } from "@/engine/workerProtocol";

let requestCounter = 0;
function nextRequestId(): string {
  requestCounter += 1;
  return `req-${requestCounter}`;
}

interface PendingEntry {
  resolve: (value: EngineOutput | OptimizerResult) => void;
  reject: (reason: Error) => void;
}

export interface UseEngineWorkerResult {
  /** Runs a full layout generation on the worker. Rejects if the engine itself throws (e.g. a malformed boundary). */
  requestLayout(boundary: BNGPolygon, entrance: BNGPoint, inputs: EngineInputs): Promise<EngineOutput>;
  /** Runs the mix optimiser on the worker. Rejects only on an unexpected engine throw — "no compliant mix found" is a normal OptimizerResult, not a rejection. */
  requestOptimize(boundary: BNGPolygon, entrance: BNGPoint, inputs: EngineInputs, timeBudgetMs?: number): Promise<OptimizerResult>;
}

export function useEngineWorker(): UseEngineWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingEntry>>(new Map());

  useEffect(() => {
    const worker = new Worker(new URL("../engine/worker-entry.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<WorkerResponseMessage>) => {
      const msg = e.data;
      const pending = pendingRef.current.get(msg.requestId);
      if (!pending) return; // response for a request nobody's waiting on (unmounted, or genuinely stale) — drop it
      pendingRef.current.delete(msg.requestId);
      if (msg.kind === "layout") {
        if (msg.ok) pending.resolve(msg.output);
        else pending.reject(new Error(msg.error));
      } else {
        if (msg.ok) pending.resolve(msg.result);
        else pending.reject(new Error(msg.error));
      }
    };
    worker.onerror = (e) => {
      // A worker-level error (e.g. a syntax/load failure) has no requestId
      // to route to — reject everything outstanding so no caller hangs.
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error(e.message || "Engine worker error"));
      }
      pendingRef.current.clear();
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
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

  return { requestLayout, requestOptimize };
}
