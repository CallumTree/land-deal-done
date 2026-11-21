// Measures two things requested for the "live, fluid recalculation" work:
//   1. ms per recalculation, simulating a user dragging one boundary
//      vertex in small steps (the interactive case a Web Worker + live
//      recompute needs to feel fluid for).
//   2. frame-to-frame layout churn while dragging — how much the
//      finished layout visibly changes between consecutive steps, beyond
//      what the shape change alone would justify. Measured as the number
//      of houseType mismatches, position-by-position, between each
//      side's plot sequence on consecutive steps (not plot IDs, which
//      are regenerated every call and don't mean anything across calls).
//
// This is unthrottled Node.js V8 timing — real and precise, but NOT the
// same engine as a phone's. A CPU-throttled, browser-based comparison
// (Chromium + CDP Emulation.setCPUThrottlingRate, the same technique
// Lighthouse uses for "mid-tier mobile" scoring) was run ad hoc for the
// same fixtures and is reported in chat, not committed here — it needed
// esbuild as a one-off bundler, which isn't worth adding as a permanent
// devDependency for a single measurement. Re-run that manually if this
// script's numbers need a throttled cross-check again.
//
// Run with: npx tsx scripts/perf-stability.ts

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLayout } from "../src/engine";
import type { BNGPoint, BNGPolygon, EngineInputs, HouseTypeId } from "../src/engine/types";

const FIXTURES_DIR = join(process.cwd(), "test-sites");
const DRAG_STEPS = 15;
const STEP_DX = 0.3;
const STEP_DY = 0.15;

interface Fixture {
  id: string;
  boundaryBng: BNGPolygon;
  entranceBng: BNGPoint;
  inputs?: EngineInputs;
}

function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8")) as Fixture);
}

function perturb(boundary: BNGPolygon, idx: number, dx: number, dy: number): BNGPolygon {
  return boundary.map((p, i) => (i === idx ? ([p[0] + dx, p[1] + dy] as BNGPoint) : [...p]));
}

function sideSequence(plots: { houseType: HouseTypeId; gardenBng: BNGPolygon | null }[], side: "left" | "right"): HouseTypeId[] {
  return plots
    .filter((p) => {
      const g = p.gardenBng ?? [];
      const avgX = g.reduce((s, pt) => s + pt[0], 0) / (g.length || 1);
      return side === "left" ? avgX < 0 : avgX >= 0;
    })
    .map((p) => p.houseType);
}

function seqChurn(a: HouseTypeId[], b: HouseTypeId[]): number {
  const len = Math.max(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

function main() {
  const fixtures = loadFixtures();
  console.log("Simulating a dragged (non-entrance) boundary vertex, 15 steps of ~0.33m each, per fixture.\n");
  console.log(
    "FIXTURE".padEnd(22),
    "MEAN_MS".padStart(8),
    "MIN_MS".padStart(8),
    "MAX_MS".padStart(8),
    "TOPOLOGY_FLIPS".padStart(15),
    "AVG_CHURN/STEP".padStart(16)
  );

  for (const fx of fixtures) {
    const idx = Math.floor(fx.boundaryBng.length / 2); // away from the entrance's own edge
    const times: number[] = [];
    const topologies: string[] = [];
    let prevLeftSeq: HouseTypeId[] = [];
    let prevRightSeq: HouseTypeId[] = [];
    let totalChurn = 0;
    let prevTopologyHint: EngineInputs["previousTopologyHint"] = undefined;

    for (let i = 0; i < DRAG_STEPS; i++) {
      const boundary = perturb(fx.boundaryBng, idx, i * STEP_DX, i * STEP_DY);
      const inputs: EngineInputs = { ...(fx.inputs ?? {}), previousTopologyHint: prevTopologyHint };
      const t0 = performance.now();
      const out = generateLayout(boundary, fx.entranceBng, inputs);
      const ms = performance.now() - t0;
      times.push(ms);
      topologies.push(out.metrics.topologyUsed);
      prevTopologyHint = out.metrics.topologyUsed === "double" ? undefined : (out.metrics.topologyUsed as "single-left" | "single-right");

      const leftSeq = sideSequence(out.layout.plots, "left");
      const rightSeq = sideSequence(out.layout.plots, "right");
      if (i > 0) totalChurn += seqChurn(prevLeftSeq, leftSeq) + seqChurn(prevRightSeq, rightSeq);
      prevLeftSeq = leftSeq;
      prevRightSeq = rightSeq;
    }

    const flips = topologies.slice(1).filter((t, i) => t !== topologies[i]).length;
    const meanMs = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(
      fx.id.padEnd(22),
      meanMs.toFixed(2).padStart(8),
      Math.min(...times).toFixed(2).padStart(8),
      Math.max(...times).toFixed(2).padStart(8),
      `${flips}/${DRAG_STEPS - 1}`.padStart(15),
      (totalChurn / (DRAG_STEPS - 1)).toFixed(2).padStart(16)
    );
  }
}

main();
