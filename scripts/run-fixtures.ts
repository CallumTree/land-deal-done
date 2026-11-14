// Test harness for the layout engine — Priority 1, stages 1 & 2.
//
// Loads every fixture in /test-sites, calls the engine, and reports two
// SEPARATE things per the brief:
//   1. Invariants — geometric/compliance facts that must hold regardless
//      of unit count (fully inside boundary, no overlaps, every plot has
//      frontage, road reaches the entrance, NDSS/garden/back-to-back met,
//      and no compliance "green" on a rule violation). ANY invariant
//      failure is a hard FAIL for that fixture, independent of #2.
//   2. Unit count vs expectedUnits — a sense-check comparison, only
//      meaningful for confidence="architect_verified" fixtures. Currently
//      ALL fixtures are "sense_check" (synthetic, not real sites), so
//      this number is not validation — see test-sites/README.md.
//
// Run with: npm run test:fixtures

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLayout } from "../src/engine";
import type { BNGPoint, BNGPolygon } from "../src/engine/types";
import { checkInvariants, type InvariantResult } from "./invariants";

const FIXTURES_DIR = join(process.cwd(), "test-sites");
const UNIT_COUNT_TOLERANCE = 0.15; // arbitrary for this stage — see test-sites/README.md
const PERF_BUDGET_MS = 1000;

interface Fixture {
  id: string;
  description: string;
  boundaryBng: BNGPolygon;
  entranceBng: BNGPoint;
  areaHectares: number;
  expectedUnits: number;
  expectedUnitsMethod: string;
  confidence: "sense_check" | "architect_verified";
}

interface FixtureResult {
  fixture: Fixture;
  ms: number;
  totalUnits: number | null;
  error: string | null;
  invariants: InvariantResult[];
  invariantsPass: boolean;
  unitDiffPct: number | null;
  unitCountPass: boolean;
  overallPass: boolean;
}

function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8")) as Fixture);
}

function runFixture(fx: Fixture): FixtureResult {
  const start = performance.now();
  let totalUnits: number | null = null;
  let error: string | null = null;
  let invariants: InvariantResult[] = [];

  try {
    const result = generateLayout(fx.boundaryBng, fx.entranceBng, {});
    totalUnits = result.metrics.totalUnits;
    invariants = checkInvariants(result, fx.boundaryBng, fx.entranceBng, {});
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const ms = performance.now() - start;
  const withinBudget = ms < PERF_BUDGET_MS;
  const invariantsPass = error === null && withinBudget && invariants.every((inv) => inv.pass);

  const unitDiffPct =
    totalUnits != null ? Math.abs(totalUnits - fx.expectedUnits) / fx.expectedUnits : null;
  const unitCountPass = unitDiffPct != null && unitDiffPct <= UNIT_COUNT_TOLERANCE;

  return {
    fixture: fx,
    ms: Math.round(ms * 100) / 100,
    totalUnits,
    error,
    invariants,
    invariantsPass,
    unitDiffPct,
    unitCountPass,
    overallPass: invariantsPass && unitCountPass,
  };
}

function printInvariantsTable(results: FixtureResult[]) {
  console.log("=== INVARIANTS (hard pass/fail, independent of unit count) ===\n");
  for (const r of results) {
    const status = r.error ? "ERROR" : r.invariantsPass ? "PASS" : "FAIL";
    console.log(`${r.fixture.id} [${r.fixture.confidence}] — ${status} (${r.ms}ms)`);
    if (r.error) {
      console.log(`  engine error: ${r.error}`);
      continue;
    }
    for (const inv of r.invariants) {
      console.log(`  ${inv.pass ? "pass" : "FAIL"}  ${inv.label} — ${inv.detail}`);
    }
    console.log("");
  }
}

function printUnitCountTable(results: FixtureResult[]) {
  console.log("=== UNIT COUNT vs expectedUnits (sense-check comparison, NOT validation unless architect_verified) ===\n");
  const header = ["FIXTURE", "CONFIDENCE", "EXPECTED", "ACTUAL", "DIFF%", "RESULT"];
  const rows = [header];
  for (const r of results) {
    rows.push([
      r.fixture.id,
      r.fixture.confidence,
      String(r.fixture.expectedUnits),
      r.totalUnits === null ? "—" : String(r.totalUnits),
      r.unitDiffPct === null ? "—" : `${Math.round(r.unitDiffPct * 1000) / 10}%`,
      r.unitCountPass ? "PASS" : "FAIL",
    ]);
  }
  const widths = header.map((_, i) => Math.max(...rows.map((row) => row[i].length)));
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join("  "));
  }
  const anyArchitectVerified = results.some((r) => r.fixture.confidence === "architect_verified");
  console.log(
    anyArchitectVerified
      ? "\nAt least one fixture is architect_verified — its PASS/FAIL above is a real validation signal."
      : "\nAll fixtures are confidence=\"sense_check\" — none of the PASS/FAIL above is a validation signal, only a ballpark check against a flat density guess."
  );
}

function main() {
  const fixtures = loadFixtures();
  const results = fixtures.map(runFixture);

  printInvariantsTable(results);
  printUnitCountTable(results);

  const anyInvariantFail = results.some((r) => !r.invariantsPass);
  console.log(
    `\n${anyInvariantFail ? "FAIL" : "PASS"}: invariants ${anyInvariantFail ? "failed on at least one fixture" : "held on every fixture"}.`
  );

  process.exit(anyInvariantFail ? 1 : 0);
}

main();
