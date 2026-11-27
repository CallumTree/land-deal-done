# Plot Line (working name)

UK generative site-planning & feasibility. See `CLAUDE.md` for mission, stage, stack and operating rules.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Apply `supabase/migrations/` against the existing Supabase project (anonymous sign-in must be enabled under Authentication → Settings for the app to get a session).

## Jurisdiction rules (planning + appraisal)

Hard planning rules and viability-appraisal defaults are layered: a
**National baseline** (`src/rules/jurisdictions/national.ts`) that applies
everywhere, overridden per site by a **Local pack** for its council
(currently only `pembrokeshire.ts`). `resolveJurisdiction(localAuthority)`
in `src/rules/jurisdictions/index.ts` merges the two; adding a new council
is one new file plus one line in that resolver — no engine changes.

Every figure in both files carries a `source` comment (document,
paragraph/appendix) via a `Sourced<T> = { value, source }` wrapper. A
figure with `source === "unsourced default"` (the `UNSOURCED` constant in
`types.ts`) means no genuine source was found for it at national level —
by design, this is true for almost every national £/m² appraisal figure
(sales price, build cost, land value), because there's no such thing as a
real "national" one; only a local pack has real numbers. The UI should
surface that string, not hide it.

**Pembrokeshire pack — sourcing status.** Built from two documents saved
unmodified at `/docs/evidence/pembrokeshire/`:

- **Pembrokeshire Deposit LDP2 (2017-2033), 13-page extract.** ⚠️ **This is
  a Deposit Plan — out for public consultation, NOT YET ADOPTED.**
  Confirmed by the document's own header on every page and by its
  Glossary's definition of "Deposit Plan". Every LDP2-sourced planning
  figure in `pembrokeshire.ts` (density 30/23 dph, 20% Lifetime Homes,
  NDSS-as-evidence-basis) is Deposit-stage evidence, not confirmed adopted
  policy, and should be shown as such wherever it reaches a user.
- **Burrows-Hutchinson Ltd Financial Viability Report for Deposit LDP-2**,
  July 2024. Every appraisal figure in `pembrokeshire.ts` (sales £/m² by
  band, build cost/fees/finance-rate/profit-%/external-works/s.106 by
  scheme size, land value by band, affordable-housing % by band×size,
  transfer-value basis, tenure split) was read directly from this
  document's Section 5 and Appendices A-F, independently verified against
  the PDF — not taken from any prior summary of its contents.

Two genuine inconsistencies found in the Viability Report itself (not
introduced or resolved by this codebase — flagged in code comments at the
exact field, and here):

1. **s.106 for 6-9-unit sites.** Appendix D's main numeric table implies
   £0 s.106-alone for this band (its combined "s.106 & SuDS/dwelling"
   figure, £1,500, equals the flat SuDS rate alone, with nothing left over
   for s.106). The separate, explicitly-labelled breakout table at the
   bottom-left of the same Appendix D states £2,500/dwelling as the 2024
   s.106 allowance for 6-9-unit sites. `pembrokeshire.ts` uses the
   explicit £2,500 figure and documents the inconsistency inline, rather
   than silently picking one.
2. **Legal cost per dwelling.** The narrative text (§5.33(c)) states
   £600/dwelling "on both open market and affordable homes". The worked
   example model printed at Appendix E uses £650/dwelling instead.
   `pembrokeshire.ts` uses £600 (the explicit policy paragraph) and flags
   the £650 discrepancy inline.

**ACG (not a source inconsistency — a confirmed gap, actively researched).**
Welsh social-rent transfer values are properly a % of **ACG** (Acceptable
Cost Guidance, a Welsh Government mechanism) including land —
Pembrokeshire uses 55% of ACG, vs. ~42% typical elsewhere in Wales (FVR
§5.11). This codebase does not have a published 2021 ACG-including-land
rate table, and specifically checked for one rather than assuming it
doesn't exist:

- Welsh Government's current public ACG guidance (the 2023-07 "Costs
  included in Social Housing Grant" document) defines ACG as Works
  Cost/m² plus on-costs and **explicitly excludes site acquisition/land
  cost** — i.e. the "including land" 2021 series FVR §5.11 refers to was
  a separate, since-discontinued WG publication, not something still
  published today.
- Three Welsh councils' own supplementary guidance documents each derive
  their social-rent transfer values as a stated % of "2021 Band 1 ACG
  figures", uplifted annually by the WG social-rent-cap inflation
  factor: Blaenau Gwent CBC (42%) and Bro Morgannwg/Vale of Glamorgan
  (42%) corroborate Pembrokeshire's own "~42% typical elsewhere"
  claim; an earlier Monmouthshire document instead cites 58%. **None of
  the three publishes the underlying raw 2021 ACG-including-land table**
  — only their own already-discounted result, each in their own
  council's regional band, which wouldn't be valid for Pembrokeshire's
  bands even if it were the raw figure.
- No FOI/ATISN request was made (plausible next step, not attempted).

Conclusion: the 2021 ACG-including-land table was circulated directly to
local authorities/RSLs, not published — there's nothing citable to use
for Pembrokeshire specifically. **The approximation stands** (ACG ≈ OMV
for the transfer-value calculation), but every metric it touches is now
flagged, not silently assumed:
- `Metrics.affordableValueOverstated` is `true` whenever the scheme has
  any affordable units under this pack (GDV, developer profit and
  residual land value are all overstated when it's true).
- A compliance entry (`id: "acg-approximation"`) reports `warn`, not
  `pass`, whenever it applies.
- The stage-3 UI shows an explicit amber banner and marks the
  "Social-rent transfer value" provenance row "approximated", not
  "sourced", with the full research trail above revealed on click.

**What the engine does and doesn't model yet.** `finalize()` in
`src/engine/generateLayout.ts` computes a genuine multi-line-item residual
appraisal (GDV incl. affordable transfer values, build cost, external
works, SuDS, s.106, design fees, contingency, marketing, legal, a
simplified one-off finance charge, target developer profit, residual land
value) using the resolved jurisdiction and the scheme's size/market bands.
It does **not** yet: run a real month-by-month cash flow (finance cost is
a single simplified charge, not the source documents' full DVM/RVM cash
flow); tag any specific physical plot as "affordable" (the affordable %
is a financial overlay on the whole scheme's GIA, apportioned by unit
count, not a per-plot flag); or model an off-site affordable-housing
commuted sum for sites where the source table says "off-site contribution
expected" rather than giving an on-site % (treated as 0% on-site, which is
honest about what v0 delivers, not a claim that 0% is the real policy
position for that site).

## Simplified housing mix, live recalculation and the auto mix optimiser

Engine-side work only — no UI wiring yet (the product UI waits on a
visual style decision).

**Size tiers** (`src/engine/sizeTiers.ts`): the user-facing mix is meant
to simplify to four sizes — Small (2-bed), Medium (3-bed), Large (4-bed),
XL (5-bed) — plus a single bungalow on/off toggle, with the engine
choosing terrace/semi/detached itself. To make that a genuine engine
decision rather than a UI illusion, `HouseTypeId` now has a real type for
every realistic bedroom-count × attachment-form combination (11 total,
up from 4) — NDSS doesn't vary by attachment form, only by bedroom/bed-
space/storey count (DCLG NDSS, March 2015, Table 1), so every new form
reuses its bedroom count's existing sourced GIA citation rather than
inventing a new figure per form. **Exception, flagged rather than
silently treated as equally confident:** the new 5-bed/7-person figure
(119 m², 2-storey) is **secondary-sourced only** — a WebSearch surfaced
it from a Cambridgeshire Insight page, but two attempts to confirm it
against the primary gov.uk document were blocked by this session's own
tool-permission classifier (not a network/host-allowlist problem —
`www.gov.uk` was added to the environment's network allowlist first,
specifically for this). XL (5-bed) offers a detached form only — 5-bed
terrace/semi variants aren't modelled, since there's no real scheme or
published convention behind such a figure and fabricating one would be
exactly the kind of invented number this project rules out.

The bungalow toggle applies to the **Medium (3-bed)** tier specifically,
not Small — the only sourced bungalow house type this engine has
(`3-bed-bungalow`, from the fern-rise-neyland fixture) is 3-bed; the
council's own dwelling-mix evidence has a bungalow row too, but it's
2-bed, a bedroom count this engine has no bungalow NDSS figure for at
all. Applying the toggle to Small would have meant inventing one.

**"Auto" mix** is no longer an arbitrary equal split — it's the resolved
jurisdiction's own sourced dwelling-mix evidence (`defaultAutoSizeMixPercent`
in `pembrokeshire.ts`, from FVR §4.19's starting mix table, with the
table's 1-bed row excluded — this engine has no 1-bed type — and the
remaining 90% renormalized). Precedence, highest first: an explicit
`EngineInputs.mix` (pro/advanced, exact real types) → `sizeMix` (the
simplified tiers) → Auto. `Metrics.mix` always reports the full 11-type
breakdown regardless of which input mode was used — that's the "pro
view, one level deeper" the brief asked for; no separate field was needed.

**Layout stability.** `EngineInputs.previousTopologyHint` lets a caller
doing interactive dragging feed back the previous call's
`Metrics.topologyUsed`, so that when double-loaded fails and single-left
vs single-right come out close, the engine prefers whichever matches the
hint rather than flip-flopping on an arbitrary tie-break. **Honestly
unvalidated by this session's fixtures**: none of the 7 fixtures, nor 400
randomly-generated trapezoidal test shapes, ever actually landed in the
single-sided-tie regime while being dragged — on every one of them the
topology is either comfortably "double" throughout or "none" throughout.
The tie-break code was reviewed carefully but couldn't be exercised
end-to-end through a real boundary this session; flagged rather than
claimed as "fixed and measured."

**Performance — fixed, not just measured.** The first pass found
pond-bridge-johnston (123-unit, multi-loop site) taking ~159ms/
recalculation unthrottled and over 1s at a throttled mid-range-phone
approximation — too slow to feel "live." Profiled before changing
anything (`node --prof`, 20 repeated calls), fixed three real root
causes in order, re-profiling after each to confirm the diagnosis:

1. **`Math.hypot` instead of a plain `sqrt`** (`geometry.ts`'s `length()`)
   was ~28% of total CPU time on its own — `Math.hypot` guards against
   overflow/underflow that genuinely can't happen at BNG-metre magnitudes,
   and that guard makes it several times slower than
   `Math.sqrt(x*x+y*y)` in V8. Swapped; same result, much cheaper.
2. **`pointInPolygon` (called via `convexPolygonFullyInside`) was ~45%
   of CPU time on its own** once (1) was fixed — it's called on every
   corner of every candidate plot, and pond-bridge's eroded boundary has
   ~18 vertices, so each call is O(18) ray-cast iterations repeated many
   thousands of times. Added a bounding-box pre-filter (cached per
   polygon, since the eroded boundary doesn't change within one
   `generateLayout` call): a candidate whose bbox isn't fully inside the
   polygon's bbox cannot possibly be fully inside the polygon, so it's
   rejected in 4 comparisons instead of running the full test. Never
   changes the answer, only skips the expensive check for candidates
   that were always going to fail it.
3. **`computePlotSpec(houseType)` — pure given a houseType, but was
   recomputed on every single candidate check** (hundreds of thousands
   of times, once per type per position per block-size attempt), each
   time touching several `rules.ts` lookup objects keyed by a dynamic
   string. With 11 house types instead of 4, V8's inline cache for those
   lookups went "megamorphic" (its own profiler term for "too many
   distinct shapes to stay fast"), showing up as ~26% of CPU time on its
   own. Memoized per house type (computed once, reused) — this was the
   single biggest win.

Result, same 15-step dragged-vertex simulation as before, Node.js/V8,
unthrottled mean ms/recalculation:

| fixture | before | after |
|---|---|---|
| rectangle-infill | 0.7 | 0.5 |
| l-shaped | 1.4 | 0.9 |
| larger-greenfield | 3.2 | 3.0 |
| fern-rise-neyland | 4.9 | 3.6 |
| cul-de-sac | 7.8 | 7.3 |
| narrow-frontage | 24.9 | 4.8 |
| pond-bridge-johnston | **159.4** | **13.1** |

Browser (Chromium/CDP, same technique Lighthouse uses for "mid-tier
mobile" scoring — ad hoc, not committed, since it needed esbuild as a
one-off bundler), pond-bridge-johnston specifically:

| | before | after | target |
|---|---|---|---|
| unthrottled | 212.9ms | **22.7ms** (max 31.5ms) | <50ms |
| 4× throttle | 1083.5ms | **107.5ms** | — |
| 6× throttle | 1547.0ms | **171.8ms** (max 251.5ms) | ~300ms |

Both targets met with margin, on the hardest fixture in the set, from
genuine root-cause fixes — nothing about the search's correctness or
any hard rule changed (every fixture's unit counts and invariant
results are identical before and after; verified, not assumed).
narrow-frontage's "slow because it fails" problem (flagged, not fixed,
in the first pass) was resolved as a side effect of the bbox pre-filter
— it no longer needs to run the expensive exact check for positions
that were never going to work.

Final profile (after all three fixes) shows no single remaining
hotspot — `tryPlaceOnSide`, `convexPolygonFullyInside`, `pointInPolygon`
and the remaining dynamic-key lookups are each in the 5-13% range,
which is what a reasonably-optimized hot path is expected to look like,
not a sign of more low-hanging fruit.

Form-level churn (which exact form — terrace/semi/detached — lands at a
given position) is low in practice (0.00-0.21 mismatches per step across
fixtures with 10-70 plots) even without any dedicated fix for it — the
existing preferred-type-first-with-fallback search already happens to be
fairly stable session to session; this is an observation, not a
guarantee for shapes not in this fixture set.

**Draft quality mode** (`EngineInputs.quality: "draft" | "full"`,
default `"full"`): draft uses a coarser 2m position-search step (vs
0.5m) and skips the "try every other house type" fallback — only the
mix cycle's own preferred type is attempted at each position, still
with that type's normal block-size fallback. Draft is a strict SUBSET
of what full searches, so it can only place fewer units, never an
invalid one — every unit draft places passes the exact same hard-rule
checks as full (NDSS, garden depth, back-to-back, frontage, overlap,
block rules). Verified with a dedicated script
(`scripts/draft-mode-report.ts`) that runs the SAME independent
invariant checker the main harness uses against draft-mode output on
every fixture, not just trusting the engine's own compliance claims:

| fixture | full units | draft units | yield given up | full ms | draft ms |
|---|---|---|---|---|---|
| cul-de-sac | 14 | 14 | 0.0% | 26.0 | 3.7 |
| fern-rise-neyland | 15 | 10 | 33.3% | 10.1 | 1.3 |
| l-shaped | 13 | 13 | 0.0% | 2.9 | 2.1 |
| larger-greenfield | 31 | 31 | 0.0% | 6.4 | 4.9 |
| pond-bridge-johnston | 28 | 28 | 0.0% | 16.1 | 3.9 |
| rectangle-infill | 12 | 12 | 0.0% | 0.6 | 1.0 |

Draft invariants hold on every fixture (narrow-frontage is the one
exception, and it's the same pre-existing "zero plots, genuinely
infeasible" case full mode also hits — not a draft-mode regression).
Draft gives up real yield on exactly one fixture (fern-rise-neyland,
-33.3%) — a small, low-density, single-house-type site where the
coarser 2m step misses finer gaps the 0.5m step would have found;
everywhere else draft matches full exactly while being 2-7× faster.
Intended use: draft while a vertex/entrance is being dragged, one final
full recalculation on release.

**Worker-ready entry point** (`src/engine/worker.ts`): a thin, pure
`handleWorkerRequest(request) → response` contract (requestId in, echoed
back out, `{ok:true,output}` or `{ok:false,error}`) — smoke-tested
directly (success and thrown-error paths both verified). Not yet wired
into an actual `self.onmessage`/`postMessage` Worker or a bundler entry
point — that's the "UI wiring" (cancellation-on-stale-request state
lives on the main-thread/React side) deferred until a visual style is
picked.

**Auto mix optimiser** (`src/engine/optimizer.ts`,
`scripts/optimizer-report.ts`): searches a fixed, deterministic candidate
list (Auto, each pure single tier, 24 permutations of skewed weights,
plus 40 seeded "extra coverage" candidates — 71 total) within a time
budget (default 1000ms), discards any candidate with a hard-rule
compliance `fail`, and ranks the rest three ways — Most homes
(`totalUnits`), Most value (`residualLandValue`), Balanced (an
even-weighted normalized blend, explicitly a modelling choice, not a
sourced figure). "Layout parameters such as road side/orientation" from
the brief aren't an independent search dimension in this v0 engine —
topology is fully determined by the boundary shape and the mix, not a
free input `generateLayout` takes, so only the mix itself is searched;
stated explicitly rather than silently skipped.

**Adaptive search.** Even after the performance fix above,
pond-bridge-johnston alone couldn't finish the full 71-candidate list
at full quality within the 1s budget (each candidate still costs
~15-20ms on this fixture, and 71 of them don't fit). Rather than the
search simply timing out partway through the list (as it did at first —
only 39/71 tried, reported earlier in this session), it now adapts: it
tracks a running average cost-per-candidate, and once the projected cost
of finishing the rest of the list at full quality would exceed the
remaining budget, it switches the REMAINING candidates to draft quality
instead (with a safety margin, and only after a few full-quality
samples to make that projection on). On a fast site this never
triggers — the whole list runs at full quality, identical to a
non-adaptive search (confirmed: results for every fixture except
pond-bridge are byte-identical to before this change). On
pond-bridge-johnston, all 71 candidates now complete within budget
(621ms, no timeout), 50 of them at draft quality once the projection
kicked in.

*(An earlier version of this adaptive idea — a coarse draft-quality
sweep over the whole list first, then refining only the apparent
leaders at full quality — was tried and discarded: it caused a real
regression on fern-rise-neyland, where a mix that looked compliant at
draft quality turned out to be checking against a shorter (and
therefore turning-head-compliant) road than the longer road full
quality's more thorough placement actually needs — i.e. "draft-compliant"
does not reliably imply "full-compliant" for the same mix once more
units get placed. Kept here as a recorded dead end, not silently
dropped, since it's a real and non-obvious failure mode of the
coarse-then-refine pattern.)*

Measured on all 7 fixtures, run twice each: **deterministic on every
fixture** (identical winners both times). Candidates tried: all 71 on
every fixture (no more partial lists/timeouts on any fixture). narrow-
frontage and pond-bridge-johnston both correctly report "nothing
compliant" with a plain-English reason (quoting the most common failing
check) rather than silently returning an empty result — pond-bridge's
reason, "Turning head at road end," is a genuine site-geometry finding
(the same v0 topology limitation the fixture is explicitly a stress
test for), not a search artefact.
