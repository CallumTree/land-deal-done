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

One simplification, not a source inconsistency: Welsh social-rent
transfer values are properly a % of **ACG** (Acceptable Cost Guidance, a
Welsh Government mechanism) including land — Pembrokeshire uses 55% of
ACG, vs. ~42% typical elsewhere in Wales (FVR §5.11). No published ACG
rate table (separate from open-market value) was available to this
codebase, so ACG is approximated as equal to OMV for the engine's
transfer-value calculation. Flagged in `generateLayout.ts`'s `finalize()`
and in `pembrokeshire.ts`, not silently assumed.

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
