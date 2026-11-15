# Test sites

Fixtures for the layout engine's pass/fail harness (`scripts/run-fixtures.ts`,
run via `npm run test:fixtures`).

## Honesty flag — read this first

**None of these are real sites.** They're 5 synthetic BNG polygons covering
5 shape categories (clean rectangle, cul-de-sac neck, L-shaped/notched,
narrow-frontage ribbon, larger greenfield), with `expectedUnits` derived from
a single flat density assumption (30 dwellings/hectare net), not from an
architect-approved scheme. `confidence` is set to `"sense_check"` on every
fixture for that reason.

The commander has said he'll supply real benchmark sites with known,
architect-approved yields. When one lands, add it here with
`"confidence": "architect_verified"` and a real `expectedUnits`. Until then,
a "pass" on these fixtures only means "the engine's output is in the same
ballpark as a flat density guess for this shape" — it is not validation
that the engine is right. Don't read more into a pass than that, and don't
tune the engine to make these particular numbers hit — that's cheating the
fixtures, not meeting the brief.

## Fixture schema

```jsonc
{
  "id": "string, matches filename",
  "description": "what this shape is testing",
  "boundaryBng": [[easting, northing], ...],   // closed ring, EPSG:27700 metres
  "entranceBng": [easting, northing],           // one point on the boundary
  "areaHectares": 0.3,
  "expectedUnits": 9,
  "expectedUnitsMethod": "how expectedUnits was derived — always say so plainly",
  "confidence": "sense_check" | "approved_unit_count",
  // Optional. Present on real-benchmark fixtures where a mismatch with
  // v0 is expected for a known structural reason — e.g. v0 only builds a
  // single dead-end ribbon, so a scheme with loops/courtyards WILL miss,
  // and that's the point of including it: the gap must show up here, not
  // be tuned away.
  "category": "stress_test_known_to_exceed_v0_topology"
}
```

### Real benchmark fixtures — pending

Two real, LPA-approved schemes are due to be added here, sourced from
scanned planning documents the commander is adding under
`/test-sites/source/` (not yet present in this checkout as of this
commit):

- **pond-bridge-johnston** — 123 dwellings (ref 04/0070/PA, varied
  24/0052/PA). `confidence: "approved_unit_count"`,
  `category: "stress_test_known_to_exceed_v0_topology"` — this scheme has
  loops and courtyards; v0 only builds one dead-end ribbon, so a miss is
  the expected, correct result here, not a bug to chase.
- **fern-rise-neyland** — 9 bungalows with garages (ref 04/0235/PA,
  2004). `confidence: "approved_unit_count"`.

Boundaries must be traced from the source drawings (location plan /
site plan), not estimated — see "Tracing method" below once added. Unit
counts come from the planning documents only, never adjusted to make the
engine pass.

### Tracing method and error margin

*(To be filled in once the source PDFs are available and each boundary
is actually traced — this section must name the method used per
fixture, e.g. scale-ruler-against-the-plan's printed bar scale vs. a
stated grid-reference anchor, and an honest error-margin estimate, not
a blanket "believed accurate" claim.)*

## Pass/fail tolerance

The harness treats a fixture as a pass if the engine's `totalUnits` is
within ±15% of `expectedUnits`, **and** the layout took under 1 second to
generate (the stage-1/2 performance budget). ±15% is an arbitrary band
chosen for this stage — tightening it is reasonable once real
`architect_verified` fixtures exist.
