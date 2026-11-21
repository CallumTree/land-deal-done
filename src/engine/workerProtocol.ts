// Message protocol between the main thread and the engine's Web Worker.
// Pure data types only — no DOM/Worker globals referenced here, so this
// file can be imported from both the main thread (React hooks) and the
// worker entry point itself without pulling in "webworker" lib types on
// the main-thread side.

import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput } from "./types";
import type { OptimizerResult } from "./optimizer";
import type { EntranceSuggestion } from "./autoEntrance";

export type WorkerRequestMessage =
  | { kind: "layout"; requestId: string; boundary: BNGPolygon; entrance: BNGPoint; inputs: EngineInputs }
  | { kind: "optimize"; requestId: string; boundary: BNGPolygon; entrance: BNGPoint; inputs: EngineInputs; timeBudgetMs?: number }
  | { kind: "suggestEntrance"; requestId: string; boundary: BNGPolygon; inputs: EngineInputs; maxCandidates?: number };

export type WorkerResponseMessage =
  | { kind: "layout"; requestId: string; ok: true; output: EngineOutput }
  | { kind: "layout"; requestId: string; ok: false; error: string }
  | { kind: "optimize"; requestId: string; ok: true; result: OptimizerResult }
  | { kind: "optimize"; requestId: string; ok: false; error: string }
  | { kind: "suggestEntrance"; requestId: string; ok: true; result: EntranceSuggestion }
  | { kind: "suggestEntrance"; requestId: string; ok: false; error: string };
