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

**Performance (`scripts/perf-stability.ts`)**, simulating a dragged
boundary vertex, 15 steps, Node.js/V8, unthrottled:

| fixture | mean ms/recalc | topology flips | avg form-level churn/step |
|---|---|---|---|
| rectangle-infill | 0.7 | 0/14 | 0.00 |
| l-shaped | 1.4 | 0/14 | 0.07 |
| larger-greenfield | 3.2 | 0/14 | 0.21 |
| fern-rise-neyland | 4.9 | 0/14 | 0.14 |
| cul-de-sac | 7.8 | 0/14 | 0.14 |
| narrow-frontage | 24.9 | 0/14 | 0.00 |
| pond-bridge-johnston | **159.4** | 0/14 | 0.00 |

A separate ad-hoc Chromium/CDP run (`Emulation.setCPUThrottlingRate`, the
same technique Lighthouse uses for "mid-tier mobile" scoring — not
committed to the repo, since it needed esbuild as a one-off bundler) gave,
at a 4×/6× throttle: pond-bridge-johnston **1.08s / 1.55s** per
recalculation; narrow-frontage 0.16s / 0.25s; every other fixture stayed
under 30ms even at 6×.

**Two honest findings, not hidden:**
1. **pond-bridge-johnston (123-unit, multi-loop site) is a real
   performance hotspot** — over 1 second per recalculation on a throttled
   mid-range-phone approximation, which would not feel "live and fluid"
   while dragging. Root cause: the placement search is
   O(positions × house types × block sizes) per side, and this fixture
   has both a long frontage AND, now, 11 house types to probe at every
   position instead of 4. Not fixed this session — flagged as the clear
   next performance target before Web Worker wiring ships, since a
   worker moves the cost off the main thread but doesn't reduce it.
2. **narrow-frontage is slow precisely because it fails** — the search
   still probes the entire site at the 0.5m step size, trying every
   house type and block size, before concluding nothing fits. A real
   "give up early" heuristic (e.g. bail out once the eroded width can't
   fit even the smallest type at all) would help both this case and
   every other infeasible site; not implemented this session.

Form-level churn (which exact form — terrace/semi/detached — lands at a
given position) is low in practice (0.00-0.21 mismatches per step across
fixtures with 10-70 plots) even without any dedicated fix for it — the
existing preferred-type-first-with-fallback search already happens to be
fairly stable session to session; this is an observation, not a
guarantee for shapes not in this fixture set.

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
plus 40 seeded "extra coverage" candidates) within a time budget
(default 1000ms), discards any candidate with a hard-rule compliance
`fail`, and ranks the rest three ways — Most homes (`totalUnits`), Most
value (`residualLandValue`), Balanced (an even-weighted normalized
blend, explicitly a modelling choice, not a sourced figure). "Layout
parameters such as road side/orientation" from the brief aren't an
independent search dimension in this v0 engine — topology is fully
determined by the boundary shape and the mix, not a free input
`generateLayout` takes, so only the mix itself is searched; stated
explicitly rather than silently skipped.

Measured on all 7 fixtures, run twice each: **deterministic on every
fixture** (identical winners both times). Candidates tried ranged from
2 (pond-bridge-johnston — each candidate is slow enough on this fixture
that only 2 fit in the 1s budget, the same performance hotspot flagged
above) to 71 (every other fixture, i.e. the full fixed list, well inside
budget). narrow-frontage and pond-bridge-johnston both correctly
report "nothing compliant" with a plain-English reason (quoting the most
common failing check) rather than silently returning an empty result.
