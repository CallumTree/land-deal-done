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
  "confidence": "sense_check" | "architect_verified"
}
```

## Pass/fail tolerance

The harness treats a fixture as a pass if the engine's `totalUnits` is
within ±15% of `expectedUnits`, **and** the layout took under 1 second to
generate (the stage-1/2 performance budget). ±15% is an arbitrary band
chosen for this stage — tightening it is reasonable once real
`architect_verified` fixtures exist.
