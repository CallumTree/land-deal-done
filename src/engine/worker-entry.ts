/// <reference lib="webworker" />
// The actual Worker entry point — this file, and only this file, runs
// inside the Web Worker, not the main thread. Instantiate it from a
// client component with:
//
//   new Worker(new URL("../engine/worker-entry.ts", import.meta.url))
//
// Everything it calls (generateLayout, optimizeMix) is unchanged, pure
// engine code — the engine itself needed no changes to run here, per
// its own doc comment in types.ts. This file is only the thin
// self.onmessage glue.

import { generateLayout } from "./generateLayout";
import { optimizeMix } from "./optimizer";
import { suggestEntrance } from "./autoEntrance";
import type { WorkerRequestMessage, WorkerResponseMessage } from "./workerProtocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WorkerRequestMessage>) => {
  const msg = e.data;
  if (msg.kind === "layout") {
    let response: WorkerResponseMessage;
    try {
      const output = generateLayout(msg.boundary, msg.entrance, msg.inputs);
      response = { kind: "layout", requestId: msg.requestId, ok: true, output };
    } catch (err) {
      response = { kind: "layout", requestId: msg.requestId, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    ctx.postMessage(response);
  } else if (msg.kind === "optimize") {
    let response: WorkerResponseMessage;
    try {
      const result = optimizeMix(msg.boundary, msg.entrance, msg.inputs, { timeBudgetMs: msg.timeBudgetMs });
      response = { kind: "optimize", requestId: msg.requestId, ok: true, result };
    } catch (err) {
      response = { kind: "optimize", requestId: msg.requestId, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    ctx.postMessage(response);
  } else {
    let response: WorkerResponseMessage;
    try {
      const result = suggestEntrance(msg.boundary, msg.inputs, { maxCandidates: msg.maxCandidates });
      response = { kind: "suggestEntrance", requestId: msg.requestId, ok: true, result };
    } catch (err) {
      response = { kind: "suggestEntrance", requestId: msg.requestId, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    ctx.postMessage(response);
  }
};
