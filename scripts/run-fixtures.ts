// Test harness for the layout engine — Priority 1, stages 1 & 2.
//
// Loads every fixture in /test-sites, calls the engine, and reports two
// SEPARATE things per the brief:
//   1. Invariants — geometric/compliance facts that must hold regardless
//      of unit count (fully inside boundary, no overlaps, every plot has
//      frontage, road reaches the entrance, NDSS/garden/back-to-back met,
//      and no compliance "green" on a rule violation). ANY invariant
//      failure is a hard FAIL for that fixture, independent of #2.
//   2. Unit count vs expectedUnits — a real signal for
//      confidence="approved_unit_count" fixtures (real LPA-approved
//      schemes), a sense-check only (not validation) for "sense_check"
//      ones (synthetic shapes) — see test-sites/README.md.
//
// Run with: npm run test:fixtures

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLayout } from "../src/engine";
import type { BNGPoint, BNGPolygon, EngineInputs } from "../src/engine/types";
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
  confidence: "sense_check" | "approved_unit_count";
  category?: string;
  // Optional engine inputs for this fixture — e.g. fern-rise-neyland needs
  // { mix: { "3-bed-bungalow": 1 } } to build the house type the real
  // scheme actually used. Omitted fixtures get the engine's own default
  // mix (equal terrace/semi/detached), same as before this field existed.
  inputs?: EngineInputs;
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
    const inputs = fx.inputs ?? {};
    const result = generateLayout(fx.boundaryBng, fx.entranceBng, inputs);
    totalUnits = result.metrics.totalUnits;
    invariants = checkInvariants(result, fx.boundaryBng, fx.entranceBng, inputs);
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
  console.log("=== UNIT COUNT vs expectedUnits (sense-check for sense_check fixtures; real signal for approved_unit_count ones) ===\n");
  const header = ["FIXTURE", "CONFIDENCE", "CATEGORY", "EXPECTED", "ACTUAL", "DIFF%", "RESULT"];
  const rows = [header];
  for (const r of results) {
    rows.push([
      r.fixture.id,
      r.fixture.confidence,
      r.fixture.category ?? "—",
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
  const approvedFixtures = results.filter((r) => r.fixture.confidence === "approved_unit_count");
  if (approvedFixtures.length > 0) {
    console.log(
      `\n${approvedFixtures.length} fixture(s) are confidence="approved_unit_count" (real LPA-approved unit counts) — their PASS/FAIL above is a real signal, not a ballpark guess. A FAIL on one tagged stress_test_known_to_exceed_v0_topology is the expected, honest result of v0's topology limits, not a surprise to chase.`
    );
  }
  const senseCheckOnly = results.length - approvedFixtures.length;
  if (senseCheckOnly > 0) {
    console.log(
      `The remaining ${senseCheckOnly} fixture(s) are confidence="sense_check" — their PASS/FAIL is only a ballpark check against a flat density guess, not validation.`
    );
  }
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
