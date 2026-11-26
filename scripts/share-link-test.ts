// Share link / auto-save test: a shared link must reproduce the sender's
// home count EXACTLY, flood-zone switches included, and every older link
// format must still decode.
//
// Runs offline: the flood zones come from a recorded /api/site-layers
// response (test-sites/site-layers/haverfordwest-riverside.json), and
// the engine inputs are built by the same siteEngineInputs() the live
// page uses, so this checks what a recipient's browser would really run.
//
// Run with: npm run test:share-link   (exits 1 on any failure)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateLayout, suggestEntrance } from "../src/engine";
import type { BNGPoint, BNGPolygon } from "../src/engine/types";
import {
  decodeHashToSiteState,
  decodeStoredSiteState,
  encodeSiteStateToHash,
  encodeStoredSiteState,
  quantizePoint,
  type SiteState,
} from "../src/components/plot-line/siteState";
import { siteEngineInputs } from "../src/lib/siteEngineInputs";
import type { SiteLayers } from "../src/lib/siteLayers/types";

const recorded = JSON.parse(readFileSync(join(process.cwd(), "test-sites/site-layers/haverfordwest-riverside.json"), "utf8")) as {
  boundary: BNGPolygon;
  response: SiteLayers;
};
const zones = recorded.response.flood.zones;
const MARKET_BAND = 2 as const;

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (err) {
    console.log(`FAIL  ${name}`);
    console.log(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Runs the engine exactly as a browser holding `state` would, once its site layers have loaded. */
function homes(state: SiteState) {
  assert.ok(state.entrance, "state must carry an entrance (share links pin it)");
  const inputs = siteEngineInputs(state, zones, MARKET_BAND);
  return generateLayout(state.boundary, state.entrance, { ...inputs, quality: "full" });
}

// The sender, built the way the UI builds it: raw float map clicks,
// snapped as they're placed (quantizePoint), then the auto-suggested
// entrance, also snapped, which the share link pins.
const rawClicks: BNGPoint[] = [
  [195220.0371, 215840.0449],
  [195339.9612, 215840.0123],
  [195340.0388, 215929.9551],
  [195219.9617, 215930.0302],
];
function senderState(floodOverrides: SiteState["floodOverrides"]): SiteState {
  const base: SiteState = {
    boundary: rawClicks.map(quantizePoint),
    entrance: null,
    mixMode: "auto",
    sizeMix: { Small: 1, Medium: 1, Large: 1, XL: 1 },
    includeBungalows: false,
    restrictions: [
      {
        polygon: [[195230.04, 215900.01], [195245.02, 215900.03], [195245.01, 215915.04], [195230.03, 215915.02]].map((p) => quantizePoint(p as BNGPoint)),
        label: "No homes here",
        hardness: "hard",
        reason: "choice",
        bars: "buildings",
      },
    ],
    floodOverrides,
  };
  const inputs = siteEngineInputs(base, zones, MARKET_BAND);
  const suggested = suggestEntrance(base.boundary, { ...inputs, quality: "full" });
  return { ...base, entrance: quantizePoint(suggested.entrance) };
}

// Rivers Zone 3 opened to homes, Rivers Zone 2 and surface water blocked:
// every kind of override, both directions.
const OVERRIDES = { "rivers-3": false, "rivers-2": true, "surface-2": true } as const;

test("v5 link round-trips the sender's state exactly, flood switches included", () => {
  const sender = senderState(OVERRIDES);
  assert.deepStrictEqual(decodeHashToSiteState(encodeSiteStateToHash(sender)), sender);
});

test("auto-save round-trips the sender's state exactly, flood switches included", () => {
  const sender = senderState(OVERRIDES);
  assert.deepStrictEqual(decodeStoredSiteState(encodeStoredSiteState(sender)), sender);
});

test("a shared link reproduces the sender's home count and layout exactly", () => {
  const sender = senderState(OVERRIDES);
  const recipient = decodeHashToSiteState(encodeSiteStateToHash(sender));
  assert.ok(recipient);
  const a = homes(sender);
  const b = homes(recipient);
  assert.equal(b.metrics.totalUnits, a.metrics.totalUnits);
  assert.equal(JSON.stringify(b.layout), JSON.stringify(a.layout));
  console.log(`      sender ${a.metrics.totalUnits} homes, recipient ${b.metrics.totalUnits} homes`);
});

test("the switches matter: same site on default switches gives a different count (so the test above isn't vacuous)", () => {
  const withOverrides = homes(senderState(OVERRIDES)).metrics.totalUnits;
  const defaults = homes(senderState({})).metrics.totalUnits;
  assert.notEqual(withOverrides, defaults);
  console.log(`      overrides ${withOverrides} homes vs defaults ${defaults} homes`);
});

test("unsnapped coordinates are why points are snapped: the link stores 0.1m", () => {
  const unsnapped: SiteState = { ...senderState(OVERRIDES), boundary: rawClicks };
  const decoded = decodeHashToSiteState(encodeSiteStateToHash(unsnapped));
  assert.ok(decoded);
  assert.notDeepStrictEqual(decoded.boundary, rawClicks);
  assert.deepStrictEqual(decoded.boundary, rawClicks.map(quantizePoint));
});

// --- Older formats still decode, with every flood zone on its default ---

const V1_PAYLOAD = [1, 0, 0, 1, 1, 1, 0, 4, 1952200, 2158400, 1200, 0, 0, 900, -1200, 0, 600, 0];

test("v1 (unversioned) link decodes, no flood overrides", () => {
  const s = decodeHashToSiteState(b64url(JSON.stringify(V1_PAYLOAD)));
  assert.ok(s);
  assert.deepStrictEqual(s.boundary, [[195220, 215840], [195340, 215840], [195340, 215930], [195220, 215930]]);
  assert.deepStrictEqual(s.entrance, [195280, 215840]);
  assert.deepStrictEqual(s.floodOverrides, {});
});

test("v4 link (zones with bars, no flood tail) decodes, no flood overrides", () => {
  const zone = [4, 0, 1952300, 2159000, 150, 0, 0, 150, -150, 0];
  const s = decodeHashToSiteState(b64url(JSON.stringify([-1, 4, ...V1_PAYLOAD, 1, ...zone])));
  assert.ok(s);
  assert.equal(s.restrictions.length, 1);
  assert.equal(s.restrictions[0].bars, "buildings");
  assert.deepStrictEqual(s.floodOverrides, {});
});

test("v4-era auto-save (no flood tail) decodes, no flood overrides", () => {
  const s = decodeStoredSiteState(JSON.stringify([...V1_PAYLOAD, 0]));
  assert.ok(s);
  assert.deepStrictEqual(s.floodOverrides, {});
});

test("v5 link with an unknown flood zone code is rejected, not misread", () => {
  assert.equal(decodeHashToSiteState(b64url(JSON.stringify([-1, 5, ...V1_PAYLOAD, 0, 1, 99, 1]))), null);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}.`);
