# Test sites

Fixtures for the layout engine's pass/fail harness (`scripts/run-fixtures.ts`,
run via `npm run test:fixtures`).

## Honesty flag — read this first

Three fixtures are real, LPA-approved schemes: **pond-bridge-johnston**,
**fern-rise-neyland** and **meads-priory-road-milford-haven**,
`confidence: "approved_unit_count"`. Their `expectedUnits` come from the
planning decision documents themselves, not a guess — see "Real benchmark
fixtures" below for exactly where each number comes from and the tracing
method/error margin for each boundary.

The other fixtures are synthetic BNG polygons covering several shape
categories (clean rectangle, cul-de-sac neck, L-shaped/notched,
narrow-frontage ribbon, larger greenfield, frontage-ribbon infill), with
`expectedUnits` derived from a single flat density assumption (30
dwellings/hectare net), not from an approved scheme. `confidence` is
`"sense_check"` on every one of these — a "pass" only means "the engine's
output is in the same ballpark as a flat density guess for this shape,"
not validation that the engine is right.

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
  // Optional. true on a fixture with a real, sourced proposed/applied-for
  // unit count that is deliberately NEVER used to tune any engine
  // parameter — see scripts/scorecard.ts's own "HOLD-OUT" table, printed
  // separately from the approved_unit_count calibration set.
  "holdout": true,
  // Optional. true on a fixture with a real, sourced unit count where the
  // engine-vs-real comparison still isn't on fair footing (e.g. a
  // restriction zone standing in for something the source drawings don't
  // let us position precisely) — see scripts/scorecard.ts's own
  // "NON-COMPARABLE" table. Not a structural "can't model this" gap:
  // read that fixture's own "notes" for exactly what's missing to lift
  // this. Its number is still tracked for drift, never chased by tuning.
  "nonComparable": true,
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

### meads-priory-road-milford-haven

89 dwellings, Land south of the Meads, Priory Road, Milford Haven, SA73
2BS. Reserved matters approval 25/0074/PA (decided 02/07/2026), under
outline permission 12/0685/PA (granted 08/11/2013, varied twice since:
16/0409/PA 2018, 24/0665/PA 2026). Applicant ateb (a registered social
landlord, 100% affordable scheme). Source documents are in
`/test-sites/source/meads-priory-road/` — the delegated decision report
and scanned decision notice in full, plus the two drawings used for
boundary tracing, saved as rendered images rather than their original
PDFs to keep this repo's size down (the other ~7 consultation-response/
amendment/superseded-document PDFs reviewed for this fixture were not
committed — none of them added boundary or unit-count information beyond
what's in the two documents that are).

- **Unit count (89 total; 59 is what this fixture tests against):**
  read directly off the 25/0074/PA delegated decision report's own §8.2
  mix breakdown: 30 one-bed flats (2-3 storey blocks) + 4 one-bed
  bungalows + 6 two-bed bungalows + 27 two-bed houses + 18 three-bed
  houses + 2 four-bed houses + 2 five-bed houses = 89. `expectedUnits` is
  set to **59** (the houses/bungalows only), not 89 — v0's engine has no
  flat-block topology at all, so scoring it against the full 89 would
  misreport a structural scope gap ("this engine can't do flats yet") as
  an accuracy failure. The scorecard/fixture harness's "ERROR%" for this
  fixture should always be read as "engine houses-only vs approved
  houses-only," never against the scheme's real total.
- **Entrance (north-east, off Priory Road):** confirmed in the delegated
  report's Highways section — "access is proposed from the C3107 known
  as Priory Road... to the north east of the site" and "both [estate
  roads] link with 'road 1' which provides access directly from Priory
  Road to the north east of the site." Placed at the midpoint of the
  traced boundary's two north-easternmost vertices.
- **Boundary tracing method:** no standalone dimensioned site-location
  plan was available among the documents reviewed (the decision notice's
  approved-plans list names "S-01 — Topo site plan & OS map location
  plan" and "P02A — Proposed Site Plan," but neither was present in what
  was reviewed for this fixture). The *shape* was instead traced from
  the red boundary line on a geotechnical "Exploratory Hole Location
  Plan" (Listers Geo, drawn against a real OS base map but marked "NTS —
  Not To Scale," i.e. no usable scale bar) — see
  `boundary-tracing-source_ListersGeo_exploratory-hole-plan.png`. The
  red line was isolated programmatically (colour-threshold + connected-
  component filtering to separate it from the trial-pit markers
  overlaid on it) and its vertices read off by eye from the isolated
  trace, cross-checked for overall shape and access-road position
  against the Hydrock drainage strategy plan (P02, the version actually
  approved per the decision notice — `approved_P02_Hydrock_drainage-
  strategy-plan.png`) and an earlier Roger Casey Associates drainage
  plan, both of which show the same elongated shape with a zigzag
  notch where the site boundary runs along Priory Lodge Close. Because
  nothing in the reviewed documents gave a verifiable scale, the traced
  shape was scaled uniformly (preserving all angles and proportions) so
  its area matches the delegated report's own stated **2.93ha** exactly
  — the *shape* is a real trace, the *absolute size* is pinned to a
  sourced figure, not to a ruler read against an unscaled drawing.
  Orientation is assumed north-up (standard UK drawing convention); no
  legible compass symbol was confirmed on the geotechnical plan at the
  resolution available.
- **Grid reference anchor:** postcodes.io's own BNG easting/northing for
  the (terminated, 2016) postcode SA73 2BS — E190251, N206514 — applied
  as the traced polygon's centroid. This is the postcode's own area
  centroid, not a surveyed site corner; a cross-check against a live
  nearby postcode (SA73 2AA, admin ward "Milford: Central") landed
  about 520m away, consistent with both being in the same small part of
  Milford Haven.
- **Error margin: large on absolute position and area, better on
  relative shape.** The same honesty applied to pond-bridge-johnston's
  tracing applies here, probably more so (no scale bar at all, vs a
  stated-but-unverifiable ratio there): treat vertex positions as
  indicative, each potentially off by tens of metres, and the whole
  site's real-world position as approximate (anchored to a postcode
  centroid, not a survey point). The *shape* — elongated, narrow access
  neck at the north-east, the zigzag southern notch against Priory
  Lodge Close — is corroborated across three independent source
  drawings and is the most confident part of this trace.
- **Current engine result: 102 units built vs 59 approved houses/
  bungalows (72.9% OVER, not under).** Not a tracing-error artifact in
  the direction that would matter here — v0's Auto mix defaults to the
  cheapest-to-pack type (2-bed-terrace) and places every one of its 102
  units as that single type, wall-to-wall along a double-loaded estate
  road, with no bungalows, no larger house types and no flats at all.
  The real scheme's mix (bungalows, varied house sizes, 30 flats this
  engine can't model) uses the site far less densely per net
  developable m² than a maximum-pack terrace run does. Same root cause
  already documented for fern-rise-neyland (`SIDE_GAP_M`/packing
  tighter than a real varied-mix scheme), now showing up at a much
  larger scale. Left unfixed here for the same reason: tuning packing
  rules to chase one fixture's number isn't in scope for this check.
- **Gross density vs Pembrokeshire's GN.26/GN13 minimum:** the approved
  scheme is 2.93ha at 89 dwellings = 30.3 dph gross, just above the
  council's stated 30 dph minimum for Towns. The engine's own output
  here (102 houses-only, no flats, same 2.93ha) comes out at 34.8 dph
  gross — also above the minimum, so this specific fixture's own result
  doesn't exercise the WARN path of the new density-minimum compliance
  check (see the main report for how that was verified separately,
  since it wasn't exercised by this fixture's own numbers). `inputs`
  sets `settlementTier: "town"`, sourced from the delegated report's own
  description of the site as being subject to the "Towns" density rate.
- **UPDATE — now `nonComparable: true`, current result 73 vs 59 (23.7%
  over):** the 102-vs-59 figure above predates two later changes to this
  fixture — `tenure: "social"` (so the engine stops applying the
  jurisdiction's market-size GIA uplift, since ateb is a 100% affordable
  registered social landlord) and the 4 flat-block/parking-court
  restriction zones described in this fixture's own `notes` field. Both
  moved the number; 73 is today's actual houses-only count. But those 4
  zones are explicitly POSITION-APPROXIMATE — this fixture's own boundary
  was shape-matched to a stated hectare figure (see above), never
  georeferenced, so there's no verified coordinate correspondence to
  place the real flat blocks precisely against it. A 73-vs-59 PASS/FAIL
  read under that condition looks more precise than the underlying data
  supports, so this fixture is marked `nonComparable: true`
  (`scripts/scorecard.ts`'s own "NON-COMPARABLE" table, and
  `scripts/run-fixtures.ts` prints "NON-COMPARABLE" in place of PASS/
  FAIL for it) rather than counted as a real accuracy signal either way.
  **What's missing to lift this:** a scaled, coordinate-bearing source
  for the site boundary — an OS-grid-referenced site plan, or any
  drawing with at least two identifiable control points against the real
  OS map (Priory Road's own kerb line, a building corner visible on both
  an aerial photo and the drawing) — so the boundary (and the flat-block/
  parking-court footprints already sourced from the Hydrock drainage
  plan and the delegated report's own text) can be positioned with a
  real coordinate transform instead of a best-effort approximation. Its
  number is still tracked in the committed baseline for drift detection,
  exactly like the approved and hold-out sets — it must never be chased
  by tuning anything, same as them.

### gibbas-way-pembroke

A phase of 50 houses/bungalows (no flats) on Land North of Gibbas Way,
Upper Lamphey Road, Pembroke SA71 5JA — an infill phase of the Lords
Meadow Farm development, applicant South Meadow Homes. Source documents
are in `/test-sites/source/gibbas-way/`.

- **Unit count (50): applicant's proposed total, NOT a confirmed
  approval.** Read from the submitted Green Infrastructure Statement
  (October 2026): "A phase of 50 homes with a public open space." No
  decision notice was found among the documents reviewed this session —
  `confidence` is `"sense_check"`, not `"approved_unit_count"`, for
  exactly that reason. Treat this fixture's engine-vs-50 comparison as a
  second data point alongside Meads, not a validated benchmark.
- **Boundary tracing method — materially better than Meads or Pond
  Bridge: a real topographical survey with printed BNG grid references,
  not an eyeballed trace.** Two station markers (9011, 9012) give exact
  `E`/`N` coordinates directly on both the topo survey and the "Existing
  Site Plan 1:500" (Pembroke Design Ltd). Their pixel positions (read
  from a high-resolution render) and known BNG coordinates were used to
  derive an exact similarity transform (scale + rotation) between pixel
  space and BNG, cross-checked: the transform's implied scale (0.0873
  m/px at 150dpi) matches the drawing's own stated 1:500 scale almost
  exactly. The boundary itself was then traced by eye against that
  transform — still a manual trace, but position/scale error here is
  genuinely small (centimetres from the transform itself; a few metres
  from where-exactly-is-the-fence-line eyeballing), not the "could be
  off by tens of metres" caveat the other fixtures carry. Sanity check:
  the traced 2.704ha for a stated "50 homes" phase implies 18.5 dph
  gross — plausible for a bungalow-heavy, "informal and traditional"
  low-density scheme (the Green Infrastructure Statement's own words),
  not a red flag.
- **Entrance:** placed at the midpoint of the southern boundary edge,
  facing Gibbas Way — matches where the drainage strategy and existing
  site plan both show the development's spine road meeting the existing
  road.
- **Drainage easement (6m each side, per the user's instruction) —
  recorded as data, NOT enforced by the engine.** The planning
  statement's paragraph 5.15 (the source the easement width was given
  from) was not located among the documents reviewed this session. The
  corridor's position was instead built from the survey's own manhole
  coordinates (the user's own fallback instruction), spanning only the
  two manholes actually identified on the drawings (~99m) — not
  extrapolated further, since nothing reviewed confirms the pipe's path
  beyond those two points. Stored on the fixture as
  `noBuildCorridorBng_notEnforcedByEngine`. v0's engine has no internal
  no-build-zone / multi-polygon-boundary support (see the keep-clear-
  zones design note from the Meads request) — the fixture's
  `boundaryBng` is the full site, un-clipped. A boundary-clipping hack
  was deliberately NOT used: the corridor only crosses the middle ~99m
  of a ~235m-wide site, so clipping would either leave both edges
  unprotected or require extrapolating the pipe's route far beyond what
  was actually surveyed — neither is honest. This is a real, open gap,
  not a silently-accepted one.
- **Real house sizes, printed directly on the submitted drawings — used
  in the yield-honesty home-size comparison below.** TYPE F / TYPE FS: 3
  bed detached bungalow, 85.4m². TYPE E1A.2: 3 bed detached bungalow,
  106.3m² (Plot 5). TYPE E2.1: 3 bed detached bungalow, 116.3m² (Plots
  2, 45, 48). TYPE D: 3 bed detached dormer house, 136.3m².
- **Current engine result: 36 houses vs 50 proposed (28% UNDER, not
  over) — the opposite direction from Meads/Fern Rise.** `turning-head`
  compliance genuinely fails partway up the site (the 16m turning circle
  doesn't fit before the road runs out of usable frontage) — a real,
  honestly-reported structural shortfall of v0's single-ribbon topology
  on this elongated, irregular shape, not a tracing artifact. Invariants:
  0 failures.

### sageston-hays-lane

A phase of 12 detached 3-bed market houses on land off Hays Lane (the old
school paddock), Sageston, Tenby — applicant Carew Castle Estate, agent
Harries Planning Design Management. **Held-out fixture**: added and run
once, after the restriction bars-semantics fix (`Restriction.bars`:
`"buildings"` | `"everything"`), with no engine parameter changed to
chase its own number. Source documents are in
`/test-sites/source/sageston/`.

- **Unit count (12): applicant's proposed total, NOT a confirmed
  approval.** Read from the Planning, Design and Access Statement (18
  May 2026): "a full application for the development of 12 residential
  units." No decision notice was reviewed — `confidence` is
  `"sense_check"`, not `"approved_unit_count"`, for exactly the same
  reason as gibbas-way-pembroke.
- **File-naming trap caught and worked around:** the Drive file actually
  named "PA-Planning Block Plan-25062026" turned out, on inspection, to
  be Drawing 07 Rev A, "EXISTING SITE PLAN" — the pre-development
  topographical survey, with no proposed layout on it at all. The real
  1:200 proposed block plan (house footprints, road, SuDS basin) is
  "Figure 5 – Proposed Block Plan", embedded inside the Planning, Design
  and Access Statement — one of the files already in scope, so used
  directly rather than opening a fourth file.
- **Boundary tracing method — same family as Meads, worse than Gibbas
  Way:** neither block-plan drawing carries OS grid references or a
  legible printed dimension, only "Scale - 1:200". The boundary (7
  vertices) and the SuDS basin (4 vertices) were pixel-traced from a
  400dpi render of Figure 5, then uniformly scaled (shape/angles
  preserved, no rotation fitted to anything) so the traced area matches
  the Application Form's own stated site area exactly — 0.65ha (Q20 and
  Q22 both give 0.65). An early trace of the NW corner and left edge was
  caught as wrong (off by several metres) via an overlay sanity check
  and corrected before use — see the fixture's own `notes` field. Net
  effect: the shape is a genuine hand trace with a sourced, exact area,
  but absolute position/scale/orientation are not independently
  verified against any surveyed coordinate.
- **SuDS infiltration basin (north strip) — `bars: "everything"`
  ("Nothing here"), enforced.** Traced from the same drawing's own
  hatched basin annotation and corroborated by the Statement's text
  ("a large portion of the north of the site has been used to create a
  SuDS feature").
- **Mains sewer and electrical utilities — NOT modelled, stated
  plainly.** The Statement confirms a mains sewer crosses "the northern
  part of the site" (reducing the applicant's own usable area to
  4167m²) and that the site has electric/telephone connections, but no
  document reviewed gives either service's actual route, width or
  depth. Modelling an undimensioned corridor on top of the SuDS basin
  would be inventing a position the source material doesn't support —
  left out rather than guessed, same approach as Meads' own un-locatable
  sewer easement.
- **Current engine result: 8 houses vs 12 proposed (33% under).**
  Invariants: 0 failures. `holdout: true` — tracked in
  `scripts/scorecard-baseline.json` for drift detection and printed in
  `scripts/scorecard.ts`'s own "HOLD-OUT" table, but never used to tune
  any engine parameter.
- **The -33% gap is INFORMED, not an unexplained structural mismatch —
  same mechanism as Gibbas Way.** With the SuDS restriction removed
  entirely, the same boundary gives 13 units vs real 12 (+8.3%, well
  inside the ±15% tolerance): this site's underlying topology match is
  actually good. The committed result's gap is overwhelmingly caused by
  the SuDS basin restriction's interaction with the `double` topology's
  placement search — it costs 5 of 13 units (38%) despite being only
  ~4% of the eroded buildable area, the same disproportionate,
  topology-level effect measured on Gibbas Way (see that fixture's own
  entry above), not a generic "v0 under-packs small linear single-road
  sites" finding. The "held-out, never tuned on" methodology is
  unchanged — only the explanation for its own gap is now informed by
  measurement.

## Drive "X-Plot" folder index — hold-out pool, NOT opened/traced

A snapshot index of the Google Drive "X-Plot" folder's own case-study
library (`Case study library - Planning Examples`), taken 2026-11-22 by
listing folder/file names and dates only — no scheme file was opened or
traced to compile this, per instruction. One line per scheme found;
anything marked "unknown — not opened" genuinely isn't known yet, not
glossed over. Re-check this list (it's a live Drive folder, not a
snapshot this repo controls) before treating it as current.

| Drive subfolder | Files | Dates | This repo's fixture | Council | Real homes | Area | Status | Boundary/layout file | Used here? |
|---|---|---|---|---|---|---|---|---|---|
| Sageston | 36 PDFs | Jun–Aug 2026 | `sageston-hays-lane` | Pembrokeshire | 12 (proposed) | 0.65ha | proposed, undetermined | `PA-Planning Block Plan-25062026.PDF` (1:200) + `PA-Planning Application Forms-21072026.PDF` | **Yes** — traced, holdout |
| Gibbas way | 10 PDFs | Nov 2026 (3rd/10th/13th/16th) | `gibbas-way-pembroke` | Pembrokeshire | 50 (proposed) | — | proposed_not_confirmed_approved | one of the `PA-Plans general-...PDF` files (no file individually named "Block Plan" in this folder) | **Yes** — traced in an earlier session |
| **Gibbas way V2** | 24 PDFs | same Nov 2026 date range as "Gibbas way", but 11 separate `PA-Plans general-...PDF` files (numbered (1)–(10) plus the base) vs only 1 in the plain "Gibbas way" folder | — | unknown — not opened | unknown — not opened | unknown — not opened | unknown — not opened | unknown — not opened | **No — FLAGGED.** A second, larger plans set for what looks like the same site and date range as the already-traced "Gibbas way" folder. Could be an amended/resubmitted set of drawings that supersedes what `gibbas-way-pembroke.json` was traced from, or a different, bigger application entirely — not established, not opened. Worth checking (which plans the current trace actually used, and whether V2 changes anything) before any further Gibbas Way work, not before. |
| Land south of Meads | 10 PDFs | Jan–Jul 2026 | `meads-priory-road-milford-haven` | Pembrokeshire | 89 total (59 houses/bungalows + 30 flats), approved | 2.93ha | approved (25/0074/PA, reserved matters, decided 02/07/2026) | `PA-Planning Delegated Report-02072026.PDF` (+ the Hydrock drainage plan already in `test-sites/source/meads-priory-road/`, which lives outside this Drive folder) | **Yes** — traced, now `nonComparable: true` |
| Pond Bridge | 9 PDFs | Apr–Jun 2024 | `pond-bridge-johnston` | Pembrokeshire | 123, approved | — | approved (reserved matters 04/0070/PA, varied 24/0052/PA) | `PA-Planning Block Plan-19042024.pdf` + `PA-Planning Site Location Plan-19042024.pdf` | **Yes** — traced, approved_unit_count |
| *(loose in the library's own root, no subfolder)* | 4 items: 1 `.zip` + 3 PDFs | 15 Sep 2008 | — | unknown — not opened | unknown — not opened | unknown — not opened | unknown — not opened | `PA-Plans general-15092008.PDF` (by name only) | **No — FLAGGED.** No scheme name or subfolder of its own, and dated years before every other folder here (2008 vs 2024–2026) — genuinely unidentified until opened. |

Not in this Drive folder at all: `fern-rise-neyland` — sourced separately (its own PDFs are committed under `test-sites/source/fern-rise/`), not part of "X-Plot".

**Two flagged, untouched hold-outs going forward: "Gibbas way V2" and the unlabeled 2008 set.** Neither has been opened; both stay in the hold-out pool until a future task asks for them by name.

## Pass/fail tolerance

The harness treats a fixture's unit count as a pass if the engine's
`totalUnits` is within ±15% of `expectedUnits`, **and** the layout took
under 1 second to generate (the performance budget). ±15% is an
arbitrary band for `sense_check` fixtures; for `approved_unit_count`
fixtures it's a real (if still somewhat arbitrary) tolerance — read the
actual percentage reported, not just pass/fail, since the point of these
two fixtures is the real number, not a binary.
