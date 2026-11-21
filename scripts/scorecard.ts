// Scorecard: engine unit count vs the REAL, LPA-approved unit count, for
// every fixture that actually has one (confidence === "approved_unit_count"
// in test-sites/, currently pond-bridge-johnston and fern-rise-neyland —
// see test-sites/README.md's "Real benchmark fixtures"). Deliberately
// separate from run-fixtures.ts's own invariant harness: that script's
// unit-count table mixes these real benchmarks in with 5 synthetic
// "sense_check" shapes (a flat-density guess, not a real scheme) under
// one combined table. This script only ever looks at the real ones, so
// a reader never has to mentally filter sense_check rows out to see
// actual accuracy.
//
// --check compares today's engine count for each fixture against the
// committed baseline (scorecard-baseline.json) and exits 1 on ANY
// mismatch (better or worse) — the engine is deterministic given a fixed
// fixture, so a changed count means something in the engine changed.
// That's not inherently wrong (an intentional fix should change these
// numbers), but it must be a DELIBERATE baseline update in the same
// commit, not a silent side effect — see test-sites/README.md's "never
// tune the engine or a fixture... to make a number hit."
//
// Run with: npx tsx scripts/scorecard.ts [--check]

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateLayout } from "../src/engine";
import type { BNGPoint, BNGPolygon, EngineInputs } from "../src/engine/types";

const FIXTURES_DIR = join(process.cwd(), "test-sites");
const BASELINE_PATH = join(process.cwd(), "scripts", "scorecard-baseline.json");

interface Fixture {
  id: string;
  boundaryBng: BNGPolygon;
  entranceBng: BNGPoint;
  expectedUnits: number;
  confidence: "sense_check" | "approved_unit_count";
  category?: string;
  inputs?: EngineInputs;
}

interface ScorecardRow {
  id: string;
  approvedUnits: number;
  engineUnits: number;
  errorPercent: number;
  knownGap: boolean;
}

function loadApprovedFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8")) as Fixture)
    .filter((fx) => fx.confidence === "approved_unit_count");
}

function buildScorecard(fixtures: Fixture[]): ScorecardRow[] {
  return fixtures.map((fx) => {
    const output = generateLayout(fx.boundaryBng, fx.entranceBng, fx.inputs ?? {});
    const engineUnits = output.metrics.totalUnits;
    const errorPercent = fx.expectedUnits > 0 ? (Math.abs(engineUnits - fx.expectedUnits) / fx.expectedUnits) * 100 : engineUnits === 0 ? 0 : 100;
    return {
      id: fx.id,
      approvedUnits: fx.expectedUnits,
      engineUnits,
      errorPercent,
      knownGap: fx.category === "stress_test_known_to_exceed_v0_topology",
    };
  });
}

function printScorecard(rows: ScorecardRow[]) {
  console.log("\n=== SCORECARD: engine vs real, LPA-approved unit counts ===\n");
  console.log("FIXTURE".padEnd(22), "APPROVED".padStart(9), "ENGINE".padStart(7), "ERROR%".padStart(8), "NOTE");
  for (const r of rows) {
    console.log(
      r.id.padEnd(22),
      String(r.approvedUnits).padStart(9),
      String(r.engineUnits).padStart(7),
      r.errorPercent.toFixed(1).padStart(8),
      r.knownGap ? "known v0 topology gap — not a surprise" : ""
    );
  }
  console.log(`\n${rows.length} approved-unit-count fixture(s). This is a real accuracy signal, not a ballpark guess — see test-sites/README.md.`);
}

function runCheck(rows: ScorecardRow[]) {
  let baseline: Record<string, number>;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.error(`No baseline at ${BASELINE_PATH} — run "npx tsx scripts/scorecard.ts --write-baseline" once to create it.`);
    process.exit(1);
  }

  const mismatches = rows.filter((r) => baseline[r.id] !== undefined && baseline[r.id] !== r.engineUnits);
  const missingFromBaseline = rows.filter((r) => baseline[r.id] === undefined);

  if (mismatches.length === 0 && missingFromBaseline.length === 0) {
    console.log("\nScorecard check: PASS — every approved-unit-count fixture matches its committed baseline exactly.");
    return;
  }

  console.error("\nScorecard check: FAIL");
  for (const r of mismatches) {
    console.error(`  ${r.id}: engine now gives ${r.engineUnits} units, baseline says ${baseline[r.id]}. If this change is intentional, run "npx tsx scripts/scorecard.ts --write-baseline" and commit the updated baseline alongside the engine change.`);
  }
  for (const r of missingFromBaseline) {
    console.error(`  ${r.id}: no baseline entry — run "npx tsx scripts/scorecard.ts --write-baseline" and commit it.`);
  }
  process.exit(1);
}

// JSON has no comment syntax, so the "this isn't an accuracy claim"
// warning lives as an ordinary "_comment" string key instead of an actual
// header. Every reader of this file (runCheck's `baseline[r.id]` lookups,
// its missingFromBaseline/mismatches filters, both keyed by fixture id)
// only ever indexes by a real fixture id, never iterates Object.keys —
// "_comment" is invisible to all of that and never collides with a real
// id (test-sites/ ids are all lowercase-hyphenated, never underscore-led).
const BASELINE_COMMENT =
  "Regression guard only — NOT an accuracy claim. This records whatever the engine outputs today for each approved_unit_count fixture, so an UNINTENDED change gets caught. A number matching this baseline says nothing about how close it is to the real scheme's approved count (see the ERROR% column scorecard.ts itself prints, and test-sites/README.md's honest accounting of it) — only that nothing changed since the last deliberate, explained update.";

function writeBaseline(rows: ScorecardRow[]) {
  const baseline = { _comment: BASELINE_COMMENT, ...Object.fromEntries(rows.map((r) => [r.id, r.engineUnits])) };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`Wrote ${BASELINE_PATH} with ${rows.length} fixture(s).`);
}

function main() {
  const rows = buildScorecard(loadApprovedFixtures());
  printScorecard(rows);

  if (process.argv.includes("--write-baseline")) {
    writeBaseline(rows);
  } else if (process.argv.includes("--check")) {
    runCheck(rows);
  }
}

main();
