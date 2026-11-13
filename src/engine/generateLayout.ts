import type { BNGPoint, BNGPolygon, EngineInputs, EngineOutput } from "./types";

/**
 * Engine v0 — not yet implemented. This is Priority 1, stage 2.
 *
 * Signature is final: boundary polygon + one entrance point (BNG metres)
 * + inputs in, layout + metrics + compliance out. Pure function — no
 * React/DOM/Supabase imports anywhere in this file or its dependents,
 * so it stays runnable from a plain Node script (scripts/run-fixtures.ts)
 * and movable to a Web Worker unchanged.
 */
export function generateLayout(
  _boundary: BNGPolygon,
  _entrance: BNGPoint,
  _inputs: EngineInputs = {}
): EngineOutput {
  throw new Error(
    "generateLayout: engine v0 not yet implemented (Priority 1, stage 2)"
  );
}
