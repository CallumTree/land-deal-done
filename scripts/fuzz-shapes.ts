// Shape-robustness fuzz harness: generates a large, reproducible set of
// random-but-realistic UK site boundaries, runs each through the full
// engine (Auto mix, default inputs — exactly what a first-time developer
// gets with no overrides), and reports how often the engine places at
// least one home, how often an independently-checked layout breaks an
// invariant (must be 0 — the one true hard-fail signal), and, for every
// zero-home result, WHY (grouped by the engine's own zeroHomesCause —
// see generateLayout.ts's "never a silent zero" rule).
//
// Run with: npx tsx scripts/fuzz-shapes.ts [--seed N] [--count N] [--ci]
// --ci prints a compact, CI-log-friendly summary (see scripts/fuzz-ci.ts
// for the non-blocking wrapper this feeds).

import { generateLayout } from "../src/engine";
import { checkInvariants } from "./invariants";
import type { BNGPoint, BNGPolygon, EngineOutput, Metrics } from "../src/engine/types";

// --- Seeded PRNG (same mulberry32 construction already used in
// src/engine/optimizer.ts — duplicated here rather than exported from
// there, since it's a 6-line generic utility, not engine logic this
// script has any business importing from). ---
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GeneratedShape {
  id: string;
  category: string;
  boundaryBng: BNGPolygon;
  entranceBng: BNGPoint;
  areaHectares: number;
}

const ORIGIN: BNGPoint = [330000, 220000]; // arbitrary BNG origin, clear of any real test-sites fixture

function rotatePoint([x, y]: BNGPoint, angle: number): BNGPoint {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
}

function translateAll(pts: BNGPoint[], dx: number, dy: number): BNGPolygon {
  return pts.map(([x, y]) => [x + dx, y + dy]);
}

function polygonArea(pts: BNGPolygon): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** A point `t` (0..1) along edge i->i+1 of `pts`, plus which edge it's on. */
function pointOnEdge(pts: BNGPolygon, edgeIndex: number, t: number): BNGPoint {
  const a = pts[edgeIndex];
  const b = pts[(edgeIndex + 1) % pts.length];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Picks an entrance point: a random edge, a random position along it — sometimes near a corner (t close to 0/1), sometimes mid-edge, per the brief's "a variety of entrance positions." */
function pickEntrance(rand: () => number, pts: BNGPolygon): BNGPoint {
  const edgeIndex = Math.floor(rand() * pts.length);
  const nearCorner = rand() < 0.3;
  const t = nearCorner ? (rand() < 0.5 ? 0.02 + rand() * 0.08 : 0.9 + rand() * 0.08) : 0.15 + rand() * 0.7;
  return pointOnEdge(pts, edgeIndex, t);
}

function finalizeShape(id: string, category: string, local: BNGPolygon, rand: () => number): GeneratedShape {
  const angle = rand() * Math.PI * 2;
  const rotated = local.map((p) => rotatePoint(p, angle));
  const dx = ORIGIN[0] + (rand() - 0.5) * 2000;
  const dy = ORIGIN[1] + (rand() - 0.5) * 2000;
  const boundaryBng = translateAll(rotated, dx, dy);
  const entranceBng = pickEntrance(rand, boundaryBng);
  return { id, category, boundaryBng, entranceBng, areaHectares: polygonArea(boundaryBng) / 10000 };
}

function randomAreaM2(rand: () => number): number {
  // 0.1ha to 6ha, log-uniform so small sites aren't drowned out by the
  // much larger numeric range of big ones.
  const minHa = 0.1;
  const maxHa = 6;
  const ha = Math.exp(Math.log(minHa) + rand() * (Math.log(maxHa) - Math.log(minHa)));
  return ha * 10000;
}

function genRectangle(rand: () => number, aspectMin: number, aspectMax: number): BNGPolygon {
  const areaM2 = randomAreaM2(rand);
  const aspect = aspectMin + rand() * (aspectMax - aspectMin);
  const width = Math.sqrt(areaM2 / aspect);
  const height = width * aspect;
  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
}

function genLShape(rand: () => number): BNGPolygon {
  const base = genRectangle(rand, 1, 2.5);
  const width = base[1][0];
  const height = base[2][1];
  const notchW = width * (0.2 + rand() * 0.4);
  const notchH = height * (0.2 + rand() * 0.4);
  // Cut a notch from the top-right corner.
  return [
    [0, 0],
    [width, 0],
    [width, height - notchH],
    [width - notchW, height - notchH],
    [width - notchW, height],
    [0, height],
  ];
}

function genTrapezoid(rand: () => number): BNGPolygon {
  const areaM2 = randomAreaM2(rand);
  const height = Math.sqrt(areaM2) * (0.6 + rand() * 0.8);
  // Solve for average width from area/height, then split unevenly between
  // top and bottom so the two parallel sides genuinely differ.
  const avgWidth = areaM2 / height;
  const ratio = 0.4 + rand() * 0.8; // top/bottom width ratio, skewed away from 1
  const wBottom = (2 * avgWidth) / (1 + ratio);
  const wTop = wBottom * ratio;
  const skew = (rand() - 0.5) * wBottom * 0.5;
  return [
    [0, 0],
    [wBottom, 0],
    [wBottom * 0.5 + wTop * 0.5 + skew + wTop / 2 - wTop, height],
    [wBottom * 0.5 - wTop * 0.5 + skew, height],
  ];
}

function genLopsidedQuad(rand: () => number): BNGPolygon {
  const base = genRectangle(rand, 1, 2);
  const width = base[1][0];
  const height = base[2][1];
  const jitter = (v: number, scale: number) => v + (rand() - 0.5) * scale;
  const jx = Math.min(width, height) * 0.3;
  // Jitter each corner outward/inward, keeping angular order around the
  // centroid so the result stays a simple (non-self-intersecting) quad.
  return [
    [jitter(0, jx), jitter(0, jx)],
    [jitter(width, jx), jitter(0, jx)],
    [jitter(width, jx), jitter(height, jx)],
    [jitter(0, jx), jitter(height, jx)],
  ];
}

/** Star-shaped (from the centroid) irregular N-gon — connecting vertices in strictly increasing angular order around a common center always yields a simple polygon, regardless of how much the radius varies. */
function genIrregular(rand: () => number, minSides: number, maxSides: number): BNGPolygon {
  const areaM2 = randomAreaM2(rand);
  const n = minSides + Math.floor(rand() * (maxSides - minSides + 1));
  const nominalR = Math.sqrt(areaM2 / Math.PI);
  const pts: BNGPoint[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + (rand() - 0.5) * ((Math.PI * 2) / n) * 0.6;
    const r = nominalR * (0.55 + rand() * 0.75);
    pts.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return pts;
}

function genNarrowStrip(rand: () => number): BNGPolygon {
  return genRectangle(rand, 8, 20);
}

export function generateShapes(seed: number, count: number): GeneratedShape[] {
  const rand = mulberry32(seed);
  const shapes: GeneratedShape[] = [];
  const categories: { name: string; weight: number; gen: (r: () => number) => BNGPolygon }[] = [
    { name: "rectangle", weight: 0.2, gen: (r) => genRectangle(r, 1, 8) },
    { name: "l-shape", weight: 0.17, gen: genLShape },
    { name: "trapezoid", weight: 0.13, gen: genTrapezoid },
    { name: "lopsided-quad", weight: 0.13, gen: genLopsidedQuad },
    { name: "irregular-5-8", weight: 0.2, gen: (r) => genIrregular(r, 5, 8) },
    { name: "narrow-strip", weight: 0.17, gen: genNarrowStrip },
  ];
  for (const cat of categories) {
    const n = Math.round(count * cat.weight);
    for (let k = 0; k < n; k++) {
      shapes.push(finalizeShape(`${cat.name}-${k + 1}`, cat.name, cat.gen(rand), rand));
    }
  }
  return shapes;
}

interface ShapeResult {
  shape: GeneratedShape;
  output: EngineOutput | null;
  error: string | null;
  ms: number;
  invariantsPass: boolean;
  invariantFailDetail: string | null;
  zeroHomesCause: Metrics["zeroHomesCause"] | "engine-error" | null;
  zeroHomesReason: string | null;
}

function runShape(shape: GeneratedShape): ShapeResult {
  const t0 = performance.now();
  try {
    const output = generateLayout(shape.boundaryBng, shape.entranceBng, {});
    const ms = performance.now() - t0;
    const invariants = checkInvariants(output, shape.boundaryBng, shape.entranceBng, {});
    const failing = invariants.filter((inv) => !inv.pass);
    return {
      shape,
      output,
      error: null,
      ms,
      invariantsPass: failing.length === 0,
      invariantFailDetail: failing.length > 0 ? failing.map((f) => `${f.label}: ${f.detail}`).join("; ") : null,
      zeroHomesCause: output.metrics.totalUnits === 0 ? output.metrics.zeroHomesCause : null,
      zeroHomesReason: output.metrics.zeroHomesReason,
    };
  } catch (e) {
    return {
      shape,
      output: null,
      error: e instanceof Error ? e.message : String(e),
      ms: performance.now() - t0,
      invariantsPass: false,
      invariantFailDetail: `Engine threw: ${e instanceof Error ? e.message : String(e)}`,
      zeroHomesCause: "engine-error",
      zeroHomesReason: null,
    };
  }
}

/** For zero-home shapes, probes a couple of alternate entrance points on the SAME boundary to see whether entrance choice alone would have changed the outcome — the "entrance placement" cause bucket, derived rather than engine-classified (see module header). */
function probeEntranceSensitivity(shape: GeneratedShape, rand: () => number): boolean {
  for (let attempt = 0; attempt < 3; attempt++) {
    const altEntrance = pickEntrance(rand, shape.boundaryBng);
    try {
      const out = generateLayout(shape.boundaryBng, altEntrance, {});
      if (out.metrics.totalUnits > 0) return true;
    } catch {
      // A probe entrance throwing isn't a success — keep trying.
    }
  }
  return false;
}

function main() {
  const args = process.argv.slice(2);
  const seedArg = args.indexOf("--seed");
  const countArg = args.indexOf("--count");
  const ciMode = args.includes("--ci");
  const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : 42;
  const count = countArg >= 0 ? Number(args[countArg + 1]) : 300;

  const shapes = generateShapes(seed, count);
  const results = shapes.map(runShape);
  const probeRand = mulberry32(seed + 1); // separate stream from shape generation

  const withHomes = results.filter((r) => (r.output?.metrics.totalUnits ?? 0) > 0);
  const zeroHome = results.filter((r) => (r.output?.metrics.totalUnits ?? 0) === 0);
  const invariantFails = results.filter((r) => !r.invariantsPass);
  // A zero-home result is only an invariant failure of the OLD "silent
  // zero" kind if it has no reason — with the engine's zeroHomesReason
  // always populated now, checkInvariants (updated alongside this
  // harness) treats a REASONED zero as a pass. Any invariantFails left
  // here are either a real geometric violation on a non-zero layout, or
  // a zero-home result the engine still failed to explain — both are
  // real bugs worth seeing, never papered over.

  const causeCounts = new Map<string, number>();
  for (const r of zeroHome) {
    const key = r.zeroHomesCause ?? "unclassified";
    causeCounts.set(key, (causeCounts.get(key) ?? 0) + 1);
  }

  let entranceSensitiveCount = 0;
  for (const r of zeroHome) {
    if (probeEntranceSensitivity(r.shape, probeRand)) entranceSensitiveCount++;
  }

  const pctHomes = ((withHomes.length / results.length) * 100).toFixed(1);
  const pctInvariantFail = ((invariantFails.length / results.length) * 100).toFixed(1);

  if (ciMode) {
    console.log(`FUZZ-SHAPES seed=${seed} n=${results.length} pctWithHomes=${pctHomes}% pctInvariantFail=${pctInvariantFail}% zeroHome=${zeroHome.length}`);
    for (const [cause, n] of [...causeCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  cause ${cause}: ${n} (${((n / results.length) * 100).toFixed(1)}%)`);
    }
    console.log(`  entrance-sensitive (alt entrance on same boundary succeeds): ${entranceSensitiveCount}/${zeroHome.length}`);
    if (invariantFails.length > 0) {
      console.log(`INVARIANT FAILURES (${invariantFails.length}):`);
      for (const r of invariantFails.slice(0, 20)) {
        console.log(`  ${r.shape.id}: ${r.invariantFailDetail}`);
      }
    }
    process.exit(invariantFails.length > 0 ? 1 : 0);
  }

  console.log(`\n=== FUZZ-SHAPES: ${results.length} shapes, seed=${seed} ===\n`);
  console.log(`Shapes with >=1 home: ${withHomes.length}/${results.length} (${pctHomes}%)`);
  console.log(`Shapes with an invariant failure: ${invariantFails.length}/${results.length} (${pctInvariantFail}%) — must be 0`);
  console.log(`\nZero-home causes (${zeroHome.length} shapes):`);
  for (const [cause, n] of [...causeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cause.padEnd(22)} ${String(n).padStart(4)}  (${((n / results.length) * 100).toFixed(1)}% of all shapes, ${((n / Math.max(1, zeroHome.length)) * 100).toFixed(1)}% of zero-home)`);
  }
  console.log(`  entrance-sensitive: ${entranceSensitiveCount}/${zeroHome.length} of zero-home shapes succeed with a different entrance on the SAME boundary`);

  console.log(`\nBy category:`);
  const byCat = new Map<string, { total: number; withHomes: number }>();
  for (const r of results) {
    const c = byCat.get(r.shape.category) ?? { total: 0, withHomes: 0 };
    c.total++;
    if ((r.output?.metrics.totalUnits ?? 0) > 0) c.withHomes++;
    byCat.set(r.shape.category, c);
  }
  for (const [cat, c] of byCat) {
    console.log(`  ${cat.padEnd(16)} ${c.withHomes}/${c.total} (${((c.withHomes / c.total) * 100).toFixed(0)}%)`);
  }

  const msValues = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = msValues[Math.floor(msValues.length * 0.5)];
  const p95 = msValues[Math.floor(msValues.length * 0.95)];
  console.log(`\nSolve time: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${msValues[msValues.length - 1].toFixed(1)}ms`);

  console.log(`\n=== 5 worked zero-home examples ===`);
  const worked = zeroHome.slice(0, 5);
  for (const r of worked) {
    console.log(`\n${r.shape.id} [${r.shape.category}], ${r.shape.areaHectares.toFixed(2)}ha, cause=${r.zeroHomesCause}`);
    console.log(`  reason: ${r.zeroHomesReason}`);
    console.log(`  entranceBng: [${r.shape.entranceBng[0].toFixed(1)}, ${r.shape.entranceBng[1].toFixed(1)}]`);
    console.log(`  boundaryBng: ${JSON.stringify(r.shape.boundaryBng.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]))}`);
  }

  if (invariantFails.length > 0) {
    console.log(`\n=== INVARIANT FAILURES (${invariantFails.length}) — must be 0 ===`);
    for (const r of invariantFails) {
      console.log(`  ${r.shape.id} [${r.shape.category}]: ${r.invariantFailDetail}`);
    }
  }

  console.log(`\n${invariantFails.length === 0 ? "PASS" : "FAIL"}: ${invariantFails.length === 0 ? "no invariant failures on any returned layout." : `${invariantFails.length} invariant failure(s) found.`}`);
  process.exit(invariantFails.length > 0 ? 1 : 0);
}

// Only run when executed directly (`npx tsx scripts/fuzz-shapes.ts`) —
// generateShapes/runShape are also imported by other scripts/tooling.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
