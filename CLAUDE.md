# Plot Line (working name) — UK generative site-planning & feasibility

## Mission
The UK's answer to TestFit. Drop in a site boundary, get compliant, buildable housing layouts with live yield, cost and viability numbers. UK first, housing first. TestFit is US-only and enterprise-priced — the wedge is being the affordable alternative that works for a solo first-time developer and a volume architect/consultant/housebuilder alike.

## Stage
Pre-product. **Priority 1, the only one right now: prove the layout engine.** Riskiest assumption — we can auto-generate a credible, buildable housing layout on an arbitrary UK site polygon, fast enough to feel live as inputs change. Everything else (full persistence, auth flows, monetization, data ingestion) is deliberately deferred until that's proven.

A prior build of this product existed under a different design (Vite + React, WGS84 lng/lat local-plane geometry, a 12-type house catalogue, SaaS dashboard/pricing/subscription scaffolding). That app code has been reset — preserved at the `pre-reset` branch/tag, not deleted history — so a fresh frontend and layout engine could be built without the old architecture dictating the new one. The Supabase backend (auth, Postgres) is retained.

## Users
Two audiences, one tool, priced accessibly for both:
- First-time / solo UK property developers doing their own feasibility.
- Architects, land promoters/consultants, and housebuilders running feasibility at volume.

## Stack
- **Frontend**: Next.js + TypeScript, deployed to Vercel.
- **Backend**: existing Supabase project (Postgres + Auth). No Stripe, no PostGIS, no storage buckets currently — add only when a real need earns it.
- **Layout generation runs client-side** — must be fast enough to regenerate live as inputs change, not a server round-trip per edit.
- Coordinates: **British National Grid (EPSG:27700) metres**, not lat/lng — a UK site boundary should never need equirectangular reprojection or suffer latitude distortion; BNG is already a flat metric plane.

## Operating rules
- First principles. Don't copy TestFit — strip each problem to physical, legal and economic truths and rebuild from there.
- Simplest tool that works. A new dependency needs a one-line justification, every time.
- Best part is no part, best step is no step. Challenge every screen and every click before building it.
- Visual style: neutral base, a few purposeful accents, colour carries meaning (e.g. compliance shown as colour — green/amber/red — never as text alone). Clean, restrained, futuristic.
- Default view dead simple. Assumptions and overrides are one click away, never in the way.
- No destructive DB operations (drops, resets, truncates, migration rewrites) without explicit sign-off. Schema changes go through new migrations only, additive by default.

## UK hard constraints the engine must encode (no shortcuts)
- **NDSS** (Nationally Described Space Standards) minimum GIA per house type.
- **21m back-to-back** distance and **10m garden depth** — editable defaults, not hardcoded.
- **Parking ratio** — editable.
- **Road width, turning head, fire/refuse access** — basic Manual-for-Streets-level checks.
- **Boundary offsets and no-build zones** — a layout must respect them, not just the outer boundary.
- House types for the first pass: 2-bed terrace, 3-bed semi, 4-bed detached (expand later; don't start from the old 12-type catalogue's names/assumptions).
- Live outputs on every input change: unit count, mix, net/gross dph, total GIA, rough GDV (£/sq ft input), build cost (£/sq ft input), residual land value.
- Compliance is shown as colour, not paragraphs of text.
