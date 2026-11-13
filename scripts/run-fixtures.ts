// Test harness for the layout engine — Priority 1, stage 1.
//
// Loads every fixture in /test-sites, calls the engine, measures wall-clock
// time per fixture, compares totalUnits against each fixture's
// expectedUnits within a tolerance band, and prints a pass/fail table.
//
// Run with: npm run test:fixtures
//
// Expected right now: every fixture FAILS, because generateLayout() is a
// stub that throws (engine v0 is stage 2, not built yet). That's the
// correct, honest result for this stage — the harness itself is what's
// being proven here, not the engine.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLayout, type BNGPoint, type BNGPolygon } from "../src/engine";

const FIXTURES_DIR = join(process.cwd(), "test-sites");
const TOLERANCE = 0.15; // arbitrary for this stage — see test-sites/README.md
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

interface Row {
  id: string;
  confidence: string;
  expected: number;
  actual: number | null;
  diffPct: number | null;
  ms: number;
  pass: boolean;
  error: string | null;
}

function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8")) as Fixture);
}

function runFixture(fx: Fixture): Row {
  const start = performance.now();
  let actual: number | null = null;
  let error: string | null = null;

  try {
    const result = generateLayout(fx.boundaryBng, fx.entranceBng, {});
    actual = result.metrics.totalUnits;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const ms = performance.now() - start;
  const diffPct = actual != null ? Math.abs(actual - fx.expectedUnits) / fx.expectedUnits : null;
  const withinTolerance = diffPct != null && diffPct <= TOLERANCE;
  const withinBudget = ms < PERF_BUDGET_MS;
  const pass = actual != null && withinTolerance && withinBudget;

  return {
    id: fx.id,
    confidence: fx.confidence,
    expected: fx.expectedUnits,
    actual,
    diffPct,
    ms: Math.round(ms * 100) / 100,
    pass,
    error,
  };
}

function printTable(rows: Row[]) {
  const header = ["FIXTURE", "CONFIDENCE", "EXPECTED", "ACTUAL", "DIFF%", "MS", "RESULT"];
  const lines: string[][] = [header];

  for (const r of rows) {
    lines.push([
      r.id,
      r.confidence,
      String(r.expected),
      r.actual === null ? "—" : String(r.actual),
      r.diffPct === null ? "—" : `${Math.round(r.diffPct * 1000) / 10}%`,
      String(r.ms),
      r.pass ? "PASS" : "FAIL",
    ]);
  }

  const widths = header.map((_, i) => Math.max(...lines.map((l) => l[i].length)));
  for (const line of lines) {
    console.log(line.map((cell, i) => cell.padEnd(widths[i])).join("  "));
  }

  console.log("");
  for (const r of rows) {
    if (r.error) {
      console.log(`${r.id}: ${r.error}`);
    }
  }
}

function main() {
  const fixtures = loadFixtures();
  const rows = fixtures.map(runFixture);

  console.log(
    `Ran ${rows.length} fixture(s). All are confidence="sense_check" — see test-sites/README.md before reading a PASS as validation.\n`
  );
  printTable(rows);

  const anyFail = rows.some((r) => !r.pass);
  process.exit(anyFail ? 1 : 0);
}

main();
