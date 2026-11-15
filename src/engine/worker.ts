// Worker-ready message protocol for the engine. The engine itself needed
// no changes to run in a Web Worker — it's already pure TS with no DOM
// access (see the header comment on types.ts) — so this file is only the
// thin request/response contract a real Worker wrapper will use.
//
// Deliberately NOT wired up to an actual `self.onmessage`/`postMessage`
// Worker here — that's UI/integration work (which bundler entry point,
// how the page cancels a stale in-flight request, etc.) that waits until
// a visual style is picked, per the brief. What's here is the pure,
// synchronous request→response function any Worker wrapper (or, for that
// matter, a plain synchronous call on the main thread) can use unchanged;
// it's covered by scripts/worker-protocol-check.ts rather than left
// unverified.
//
// A real wrapper, once UI work resumes, looks like:
//
//   // worker entry (runs inside the Worker):
//   import { handleWorkerRequest } from "./worker";
//   self.onmessage = (e: MessageEvent<WorkerRequest>) => {
//     self.postMessage(handleWorkerRequest(e.data));
//   };
//
//   // main-thread side: new Worker(new URL("./worker-entry.ts", import.meta.url)),
//   // tagging each request with an id and dropping any response whose id
//   // isn't the latest one sent — "latest-wins" cancellation, per the brief.

import { generateLayout } from "./generateLayout";
import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput } from "./types";

export interface WorkerRequest {
  /** Caller-assigned id, echoed back unchanged — lets the caller implement "latest request wins" by ignoring any response whose id isn't the most recent one it sent. */
  requestId: string;
  boundary: BNGPolygon;
  entrance: BNGPoint;
  inputs: EngineInputs;
}

export type WorkerResponse =
  | { requestId: string; ok: true; output: EngineOutput }
  | { requestId: string; ok: false; error: string };

export function handleWorkerRequest(request: WorkerRequest): WorkerResponse {
  try {
    const output = generateLayout(request.boundary, request.entrance, request.inputs);
    return { requestId: request.requestId, ok: true, output };
  } catch (e) {
    return { requestId: request.requestId, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
