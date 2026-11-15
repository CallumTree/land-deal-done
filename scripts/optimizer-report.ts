// Reports the Auto Mix Optimiser's behaviour on every fixture: candidates
// tried, time taken, and whether its results are deterministic (same
// inputs → same winners, run twice). Run with: npx tsx scripts/optimizer-report.ts

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { optimizeMix } from "../src/engine";
import type { BNGPoint, BNGPolygon, EngineInputs } from "../src/engine/types";

const FIXTURES_DIR = join(process.cwd(), "test-sites");

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

function summarizeWinner(r: ReturnType<typeof optimizeMix>, key: "mostHomes" | "mostValue" | "balanced"): string {
  const w = r[key];
  if (!w) return "—";
  return `${w.candidate.label} (${w.output.metrics.totalUnits}u, RLV £${Math.round(w.output.metrics.residualLandValue).toLocaleString()})`;
}

function main() {
  const fixtures = loadFixtures();

  for (const fx of fixtures) {
    const run1 = optimizeMix(fx.boundaryBng, fx.entranceBng, fx.inputs ?? {}, { timeBudgetMs: 1000 });
    const run2 = optimizeMix(fx.boundaryBng, fx.entranceBng, fx.inputs ?? {}, { timeBudgetMs: 1000 });

    const deterministic =
      run1.compliantCount === run2.compliantCount &&
      run1.mostHomes?.candidate.label === run2.mostHomes?.candidate.label &&
      run1.mostValue?.candidate.label === run2.mostValue?.candidate.label &&
      run1.balanced?.candidate.label === run2.balanced?.candidate.label;

    console.log(`\n=== ${fx.id} ===`);
    console.log(`Candidates tried: ${run1.candidatesTried}  Compliant: ${run1.compliantCount}  Elapsed: ${run1.elapsedMs.toFixed(0)}ms  Timed out: ${run1.timedOut}`);
    if (run1.failureExplanation) {
      console.log(`Nothing compliant: ${run1.failureExplanation}`);
    } else {
      console.log(`Most homes:  ${summarizeWinner(run1, "mostHomes")}`);
      console.log(`Most value:  ${summarizeWinner(run1, "mostValue")}`);
      console.log(`Balanced:    ${summarizeWinner(run1, "balanced")}`);
    }
    console.log(`Deterministic across two runs: ${deterministic ? "YES" : "NO — see below"}`);
    if (!deterministic) {
      console.log(`  run1: homes=${run1.mostHomes?.candidate.label} value=${run1.mostValue?.candidate.label} balanced=${run1.balanced?.candidate.label}`);
      console.log(`  run2: homes=${run2.mostHomes?.candidate.label} value=${run2.mostValue?.candidate.label} balanced=${run2.balanced?.candidate.label}`);
    }
  }
}

main();
