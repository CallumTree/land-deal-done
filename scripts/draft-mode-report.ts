// Verifies EngineInputs.quality="draft" on every fixture: runs the SAME
// independent invariant checks the main harness uses (not just trusting
// the engine's own compliance claims), and reports how much yield draft
// gives up relative to full. Run with: npx tsx scripts/draft-mode-report.ts

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLayout } from "../src/engine";
import type { BNGPoint, BNGPolygon, EngineInputs } from "../src/engine/types";
import { checkInvariants } from "./invariants";

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

function main() {
  const fixtures = loadFixtures();
  console.log("FIXTURE".padEnd(22), "FULL_UNITS".padStart(11), "DRAFT_UNITS".padStart(12), "YIELD_GIVEN_UP".padStart(16), "FULL_MS".padStart(9), "DRAFT_MS".padStart(9), "DRAFT_INVARIANTS");

  let anyDraftInvariantFail = false;

  for (const fx of fixtures) {
    const baseInputs = fx.inputs ?? {};

    const t0 = performance.now();
    const fullOut = generateLayout(fx.boundaryBng, fx.entranceBng, { ...baseInputs, quality: "full" });
    const fullMs = performance.now() - t0;
    const fullInvariants = checkInvariants(fullOut, fx.boundaryBng, fx.entranceBng, { ...baseInputs, quality: "full" });

    const t1 = performance.now();
    const draftOut = generateLayout(fx.boundaryBng, fx.entranceBng, { ...baseInputs, quality: "draft" });
    const draftMs = performance.now() - t1;
    const draftInvariants = checkInvariants(draftOut, fx.boundaryBng, fx.entranceBng, { ...baseInputs, quality: "draft" });

    const draftOk = draftInvariants.every((inv) => inv.pass);
    const fullOk = fullInvariants.every((inv) => inv.pass);
    if (!draftOk) anyDraftInvariantFail = true;

    const fullUnits = fullOut.metrics.totalUnits;
    const draftUnits = draftOut.metrics.totalUnits;
    const yieldGivenUpPct = fullUnits > 0 ? (((fullUnits - draftUnits) / fullUnits) * 100).toFixed(1) + "%" : "—";

    console.log(
      fx.id.padEnd(22),
      String(fullUnits).padStart(11),
      String(draftUnits).padStart(12),
      yieldGivenUpPct.padStart(16),
      fullMs.toFixed(2).padStart(9),
      draftMs.toFixed(2).padStart(9),
      draftOk ? "PASS" : "FAIL (see below)"
    );
    if (!draftOk) {
      for (const inv of draftInvariants.filter((i) => !i.pass)) {
        console.log(`    FAIL  ${inv.label} — ${inv.detail}`);
      }
    }
    if (!fullOk) {
      console.log(`  (note: full mode also has pre-existing invariant fails on this fixture, unrelated to draft mode)`);
    }
  }

  console.log(
    `\n${anyDraftInvariantFail ? "FAIL" : "PASS"}: draft-mode invariants ${anyDraftInvariantFail ? "failed on at least one fixture" : "held on every fixture"}.`
  );
}

main();
