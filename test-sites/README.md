# Test sites

Fixtures for the layout engine's pass/fail harness (`scripts/run-fixtures.ts`,
run via `npm run test:fixtures`).

## Honesty flag — read this first

Two fixtures are real, LPA-approved schemes: **pond-bridge-johnston** and
**fern-rise-neyland**, `confidence: "approved_unit_count"`. Their
`expectedUnits` come from the planning decision documents themselves, not
a guess — see "Real benchmark fixtures" below for exactly where each
number comes from and the tracing method/error margin for each boundary.

The other 5 are synthetic BNG polygons covering 5 shape categories (clean
rectangle, cul-de-sac neck, L-shaped/notched, narrow-frontage ribbon,
larger greenfield), with `expectedUnits` derived from a single flat
density assumption (30 dwellings/hectare net), not from an approved
scheme. `confidence` is `"sense_check"` on every one of these — a "pass"
only means "the engine's output is in the same ballpark as a flat density
guess for this shape," not validation that the engine is right.

In both cases: don't read more into a pass than the confidence level
supports, and never tune the engine or a fixture's boundary/inputs to
make a number hit — that's cheating the fixtures, not meeting the brief.
A FAIL on an `approved_unit_count` fixture, including the
`stress_test_known_to_exceed_v0_topology` one, is reported as a real,
specific finding, not fixed by loosening the fixture.

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
  "category": "stress_test_known_to_exceed_v0_topology",
  // Optional. Engine inputs for this fixture, e.g. a real scheme built
  // entirely of one house type: { "mix": { "3-bed-bungalow": 1 } }.
  // Omitted fixtures get the engine's own default mix.
  "inputs": { "mix": { "3-bed-bungalow": 1 } }
}
```

## Real benchmark fixtures

Source documents are in `/test-sites/source/pond-bridge/` and
`/test-sites/source/fern-rise/` — scanned planning application PDFs,
unmodified, as submitted to Pembrokeshire County Council.

### pond-bridge-johnston

123 dwellings, Pond Bridge, Johnston, Pembrokeshire. Reserved matters
approval 04/0070/PA (decided 30/09/2005), varied by 24/0052/PA
(decided 13/06/2024) for a turning head and extra parking to a handful
of plots — the unit count and site haven't changed between those.

- **Unit count (123):** read directly off the 24/0052/PA application
  form's own description field: *"Submission of Approval of Reserved
  Matters Application for the construction of 123 residential dwellings
  - land at O.S. 5400, to the rear of filling station, Pond Bridge,
  Johnston, Haverfordwest, Pembrokeshire."* Not a density estimate.
- **Entrance (west, off the A40):** confirmed in the 24/0052/PA
  delegated report: *"Existing dwellings are located to the north and
  south of the site, with the access located to the west, which links
  with the A40(T)."* Matches the roundabout/filling-station junction
  visible on both the location and block plans.
- **Grid reference anchor (E193540, N210950):** this is not an estimate
  — it's the exact "Description of site location" easting/northing the
  applicant's agent entered on the 24/0052/PA application form itself.
  Applied here to the entrance point, since the form's accompanying
  description ties it to "the rear of the filling station," i.e. the
  access side, not the site's centroid.
- **Boundary tracing method:** the 1:2500 location plan's red line
  (`PA-Planning_Site_Location_Plan-19042024.pdf`) gives the correct
  *shape* — a composite, two-lobed site served by the Green Lane /
  Bracken Way loop roads off the roundabout, matching the loops and
  courtyards visible on the 1:500 block plan
  (`PA-Planning_Block_Plan-19042024.pdf`). Neither drawing could be
  pixel-measured in this session (no scale ruler tool against the
  rendered page, and the 1:2500 sheet has no printed graphic scale bar,
  only the stated ratio). The *shape* was read by eye from the location
  plan; the *absolute size* was cross-checked against a plausible
  density range for 123 units of this house type/era (~25-35 dph
  gross, typical for a 2000s mixed terrace/semi Welsh estate) rather
  than trusted from eyeballed proportions alone, because an initial
  direct proportion-read gave a site roughly 60% smaller than that range
  supports — a real example of "the scale isn't verifiable," not a
  precision claim.
- **Error margin: large, and stated as such rather than hidden.** Shape
  (multi-loop, not a single ribbon) is confident. Absolute area
  (4.549ha here) could plausibly be off by **±25-30%**; individual
  vertex positions should be treated as indicative, not surveyed, each
  potentially off by tens of metres. This doesn't undermine the
  fixture's purpose — it's a stress test for a known topology gap, not
  a precision benchmark — but it does mean the 78% unit-count shortfall
  the engine currently produces shouldn't be read as a tight, repeatable
  number; read it as "a large majority of this scheme's capacity, not
  caught by v0's topology," which would hold under a wide range of
  equally-plausible re-traces.

### fern-rise-neyland

9 detached 3-bed bungalows with garages, Fern Rise, Honeyborough Road,
Neyland, Pembrokeshire. Ref 04/0235/PA, decided 17/08/2004.

- **Unit count (9):** confirmed three independent ways in the source
  documents — the decision notice's own title ("9 No. Residential
  Bungalows & Garages"), the 2004 application form's plot list (Plots
  14, 16, 18, 19, 20, 21, 22, 23 & 24 — nine numbers), and a direct count
  of the numbered footprints inside the red line on the 1:500 site plan
  (page 5 of `PA-Plans_general-15092008.pdf`).
- **House type correction:** the engine's `rules.ts` originally guessed
  "2-bed" as a provisional placeholder. Reading the actual dimensioned
  floor plans (Plots 14, 16, 18 & 24, further into the same PDF) showed
  Bedroom 1/2/3 clearly labelled on every plan — these are **3-bed**
  bungalows, single storey, with an integral garage under the same
  roofline (confirmed from the elevations too, not a separate
  structure). `rules.ts` now uses NDSS's 3-bed/5-person single-storey
  figure (86m²) with the real plans cited, and `HouseTypeId`'s
  "2-bed-bungalow" was renamed to "3-bed-bungalow" throughout. This
  fixture's `inputs` field sets `mix: { "3-bed-bungalow": 1 }` so the
  engine actually builds that type, not its default terrace/semi/
  detached mix.
- **Boundary tracing method:** the 1:500 site plan has a printed graphic
  scale bar (0-40m, read directly, not estimated from paper size) and a
  clean red boundary line enclosing exactly the 9 numbered plots. The
  boundary was traced by eye against that scale bar and the visible
  plot/building footprints (each bungalow's real floor-plan dimensions,
  read from the individual house-type drawings, gave an independent
  cross-check on plot scale). No grid reference was given or found in
  the 2004-era paper application (unlike Pond Bridge's 2024 digital
  form) — the BNG anchor used (E196300, N205600) is an **unverified
  approximate estimate** for Honeyborough/Neyland's general location,
  not looked up against an authoritative source.
- **Error margin:** shape and relative dimensions (traced against a real
  printed scale bar, cross-checked against real floor-plan sizes) are
  the most confident tracing in this fixture set — estimated **±10-15%**
  on area, better on the overall proportions. The **absolute position**
  on the real BNG grid is far less certain (plausibly wrong by hundreds
  of metres to a kilometre) since the anchor itself is an estimate, not
  a sourced figure — this doesn't affect the engine's output at all
  (BNG coordinates just need to be large, realistic numbers; relative
  geometry is what the engine actually uses), but it would matter for
  anyone trying to locate this fixture on a real map.
- **Current engine result: 15 units built vs 9 approved (66.7% over).**
  Not a tracing-error artifact — even at the low end of this fixture's
  area error margin there's room for the overshoot. The specific,
  identified reason: `rules.SIDE_GAP_M` (1m) is sourced as a minimum
  fire-separation gap between unattached buildings, not a realistic
  side-garden allowance for standalone bungalow plots, which in reality
  are usually several metres wider apart for privacy/visual separation.
  v0 packs detached units far closer together than this real low-density
  scheme does. Left unfixed deliberately — changing `SIDE_GAP_M` now,
  specifically to make this fixture land near 9, would be tuning a rule
  to flatter one fixture's number, which the brief explicitly rules out.
  A real fix (a wider, possibly house-type-specific side gap for
  detached/bungalow plots) belongs in a future stage as a general
  capability improvement, justified on its own terms — not as a reaction
  to this one result.

## Pass/fail tolerance

The harness treats a fixture's unit count as a pass if the engine's
`totalUnits` is within ±15% of `expectedUnits`, **and** the layout took
under 1 second to generate (the performance budget). ±15% is an
arbitrary band for `sense_check` fixtures; for `approved_unit_count`
fixtures it's a real (if still somewhat arbitrary) tolerance — read the
actual percentage reported, not just pass/fail, since the point of these
two fixtures is the real number, not a binary.
