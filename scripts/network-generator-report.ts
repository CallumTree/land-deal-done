// Network-generator topology (EngineInputs.networkGenerator): engine vs
// real, for every REAL scheme fixture in test-sites/ (excludes the
// purely synthetic "flat 30 dph sense-check" shapes used for invariant/
// fuzz robustness only — those were never a real scheme to compare
// against). Reports, per scheme: the real sourced count, what today's
// engine (flag OFF — unchanged default behaviour) gets and which
// topology it picks, and what the SAME engine gets with the network
// generator switched on, plus which topology wins once it's offered as
// a candidate. Ends with an explicit kill-test readout for Pond Bridge
// and Slade Lane (does the network generator reach the real count on
// either).
//
// Read-only: never writes scorecard-baseline.json, never mutates a
// fixture. "Beaconing Fields" is not a fixture in this repo and is not
// opened or referenced here.
//
// Run with: npx tsx scripts/network-generator-report.ts

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLayout } from "../src/engine";
import type { BNGPoint, BNGPolygon, EngineInputs } from "../src/engine/types";

const FIXTURES_DIR = join(process.cwd(), "test-sites");

interface Fixture {
  id: string;
  boundaryBng: BNGPolygon;
  entranceBng: BNGPoint;
  expectedUnits: number;
  expectedUnitsMethod?: string;
  confidence: "sense_check" | "approved_unit_count";
  inputs?: EngineInputs;
  holdout?: boolean;
  nonComparable?: boolean;
}

function loadRealSchemeFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8")) as Fixture)
    // The synthetic stress/robustness shapes all say so plainly in their
    // own expectedUnitsMethod — "flat 30 dph net density sense-check,
    // NOT an architect-approved scheme." Everything else in test-sites/
    // is a real, named UK site with a sourced count.
    .filter((fx) => !(fx.expectedUnitsMethod ?? "").includes("NOT an architect-approved scheme"));
}

function fmtPct(engine: number, real: number): string {
  if (real <= 0) return "n/a";
  return `${(((engine - real) / real) * 100).toFixed(0)}%`;
}

function main() {
  const fixtures = loadRealSchemeFixtures();

  interface Row {
    id: string;
    real: number;
    note: string;
    offUnits: number;
    offTopology: string;
    onUnits: number;
    onTopology: string;
  }
  const rows: Row[] = [];

  for (const fx of fixtures) {
    const baseInputs = fx.inputs ?? {};
    const off = generateLayout(fx.boundaryBng, fx.entranceBng, baseInputs);
    const on = generateLayout(fx.boundaryBng, fx.entranceBng, { ...baseInputs, networkGenerator: true });
    const note = [
      fx.holdout ? "hold-out (never tuned on)" : null,
      fx.nonComparable ? "non-comparable (approximate position)" : null,
      fx.confidence === "sense_check" ? "applicant's proposed figure, not LPA-approved" : null,
    ]
      .filter(Boolean)
      .join("; ");
    rows.push({
      id: fx.id,
      real: fx.expectedUnits,
      note,
      offUnits: off.metrics.totalUnits,
      offTopology: off.metrics.topologyUsed,
      onUnits: on.metrics.totalUnits,
      onTopology: on.metrics.topologyUsed,
    });
  }

  console.log("\n=== Network generator vs real: every REAL scheme fixture in test-sites/ ===\n");
  console.log(
    "FIXTURE".padEnd(34),
    "REAL".padStart(5),
    "FLAG-OFF".padStart(9),
    "TOPOLOGY(off)".padStart(16),
    "FLAG-ON".padStart(8),
    "TOPOLOGY(on)".padStart(18),
    "CHANGED?".padStart(9),
    "ERR% vs real (on)".padStart(19)
  );
  for (const r of rows) {
    const changed = r.onUnits !== r.offUnits ? "YES" : "no";
    console.log(
      r.id.padEnd(34),
      String(r.real).padStart(5),
      String(r.offUnits).padStart(9),
      r.offTopology.padStart(16),
      String(r.onUnits).padStart(8),
      r.onTopology.padStart(18),
      changed.padStart(9),
      fmtPct(r.onUnits, r.real).padStart(19)
    );
  }
  console.log();
  for (const r of rows) {
    if (r.note) console.log(`  ${r.id}: ${r.note}`);
  }

  console.log("\n=== Kill test: does the network generator reach the real count on Pond Bridge and Slade Lane? ===\n");
  for (const id of ["pond-bridge-johnston", "slade-lane-haverfordwest"]) {
    const r = rows.find((row) => row.id === id);
    if (!r) {
      console.log(`  ${id}: NOT FOUND in test-sites/ — cannot run the kill test.`);
      continue;
    }
    const reached = r.onUnits >= r.real;
    const wonOverOldBest = r.onTopology === "network-generator";
    console.log(
      `  ${id}: real=${r.real}, flag-on engine=${r.onUnits} (${r.onTopology}), flag-off engine=${r.offUnits} (${r.offTopology}) -> ` +
        `${reached ? "REACHES" : "does NOT reach"} the real count` +
        `${wonOverOldBest && !reached ? " (network generator DID win over the old best topology here, but still falls short of the real count)" : ""}` +
        `${!wonOverOldBest && r.onUnits === r.offUnits ? " (network generator did not change the result — the old topology still wins)" : ""}.`
    );
  }
  console.log(
    "\nHonesty note: the network generator is a value-driven GREEDY heuristic, not an exhaustive search — it is not guaranteed to find the same (or a better) layout than a fixed-formula topology on every site, and is not tuned to hit any specific site's real count. Where it falls short of the real count, that is the honest result of a bounded, principled growth rule applied to real, irregular site geometry, not a fit to any one scheme."
  );
}

main();
