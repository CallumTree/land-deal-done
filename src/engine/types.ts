// Plot Line layout engine — shared types.
//
// Pure TypeScript, no React/DOM/Supabase imports anywhere in src/engine.
// Must stay callable from a plain Node script (scripts/run-fixtures.ts)
// and later from a Web Worker, unchanged.

import type { MarketBand } from "../rules/jurisdictions/types";
import type { SizeTier } from "./sizeTiers";

/** A point in British National Grid (EPSG:27700) metres: [easting, northing]. */
export type BNGPoint = [number, number];

/** Closed or open ring of BNG points describing a polygon boundary. */
export type BNGPolygon = BNGPoint[];

/** "hard": nothing may be built inside it, enforced by the engine. "soft": recorded and shown, but NOT YET enforced — a future pass may add partial/discretionary handling; for now a soft restriction has zero effect on placement. */
export type RestrictionHardness = "hard" | "soft";

/**
 * What a hard restriction actually keeps out:
 * "buildings" — only a house footprint/garage may not stand inside it.
 * Roads, turning heads, driveways, gardens and open space may freely
 * cross or run along it — the right model for a sewer/drain easement,
 * where the legal/physical requirement is "don't build ON it," not
 * "don't go near it at all." The UI's plain-English choice for this is
 * "No homes here" and it's the default.
 * "everything" — nothing may be built or placed inside it at all (no
 * plot, no road, no turning head) — the right model for trees, an
 * ecology buffer, or a flood zone, where the land itself is excluded,
 * not just its buildings. The UI's plain-English choice for this is
 * "Nothing here".
 */
export type RestrictionBars = "buildings" | "everything";

/**
 * Why this land is set aside, for the UI's plain-English framing and for
 * anyone auditing a layout later — never used by the engine to decide
 * enforcement (hardness alone decides that):
 * "law" — a statutory easement/corridor (e.g. a sewer/drain easement).
 * "physical" — can't literally build there (e.g. a watercourse, a steep bank).
 * "policy" — a planning-policy buffer (e.g. an ecology/landscape buffer).
 * "choice" — the user drew it themselves: land they're choosing to set
 * aside, with no external legal/physical/policy requirement behind it.
 */
export type RestrictionReason = "law" | "physical" | "policy" | "choice";

/**
 * A generic "keep clear" zone — land a layout must not build on (hard) or
 * should ideally avoid (soft, not yet enforced). Deliberately typology-
 * agnostic: nothing here or in how the engine enforces it names a house
 * type, a plot, a garden, or any other housing concept — a non-
 * residential typology built on the same core would reuse this
 * unchanged (see the engine/appraise split's own typology-plug-in note).
 *
 * Geometry is assumed CONVEX for the overlap/containment checks the
 * engine runs against it (geometry.ts's SAT-based
 * convexPolygonsOverlap/convexPolygonFullyInside) — a non-convex
 * restriction polygon isn't guaranteed to be caught correctly by those
 * checks. Real easements/buffers/corridors/open-space parcels are
 * overwhelmingly simple convex strips or rectangles, so this is a known,
 * stated limitation, not a silent assumption likely to bite in practice.
 */
export interface Restriction {
  /** BNG polygon, same coordinate frame as the site boundary. */
  polygon: BNGPolygon;
  /** Plain-English label shown to the user, e.g. "Keep clear: sewer easement". */
  label: string;
  hardness: RestrictionHardness;
  reason: RestrictionReason;
  /**
   * What this restriction keeps out — see RestrictionBars' own doc
   * comment. Defaults to "everything" when omitted (the stricter,
   * previously-only behaviour — any Restriction written before this
   * field existed is read exactly as before: nothing may be placed
   * inside it at all), so this field is additive, not a breaking change.
   */
  bars?: RestrictionBars;
  /** Optional citation/evidence for where this restriction comes from (a drawing, a planning condition, a survey). */
  source?: string;
}

/**
 * Every HouseTypeId the engine can actually place. User-facing UI should
 * not expose this list directly — see src/engine/sizeTiers.ts for the
 * simplified Small/Medium/Large/XL (+ bungalow toggle) view the user
 * actually picks from; the engine chooses which of these real types to
 * build. "Pro view" means showing this full breakdown (Metrics.mix),
 * one level deeper than the simplified tiers.
 */
export type HouseTypeId =
  | "2-bed-terrace"
  | "2-bed-semi"
  | "2-bed-detached"
  | "3-bed-terrace"
  | "3-bed-semi"
  | "3-bed-detached"
  | "3-bed-bungalow"
  | "4-bed-terrace"
  | "4-bed-semi"
  | "4-bed-detached"
  | "5-bed-detached";

export interface EngineInputs {
  /**
   * Pro/advanced override: relative weight per REAL house type, e.g.
   * { "2-bed-terrace": 1, "3-bed-semi": 1, "4-bed-detached": 1 }. Missing
   * types default to 0. Takes priority over `sizeMix` when both are
   * given — this is the "pick the exact form yourself" escape hatch.
   */
  mix?: Partial<Record<HouseTypeId, number>>;
  /**
   * User-facing simplified mix: relative weight per SIZE TIER (Small=2-
   * bed .. XL=5-bed — see sizeTiers.ts). The engine distributes each
   * tier's weight across its candidate forms (terrace/semi/detached) and
   * then picks whichever form actually fits at each position. Ignored if
   * `mix` is also given.
   */
  sizeMix?: Partial<Record<SizeTier, number>>;
  /** The single bungalow on/off switch — applies to the Medium (3-bed) tier only; see sizeTiers.ts BUNGALOW_TIER for why. Defaults to false. */
  includeBungalows?: boolean;
  /** Off-street parking spaces required per unit. Overrides rules.ts default. */
  parkingRatioPerUnit?: number;
  /** Minimum private garden depth in metres. Overrides rules.ts default. */
  minGardenDepthM?: number;
  /** Minimum distance between facing habitable room windows. Overrides rules.ts default. */
  backToBackM?: number;
  /** Minimum NDSS GIA per house type, m². Overrides rules.ts defaults. */
  ndssMinGiaM2?: Partial<Record<HouseTypeId, number>>;
  /**
   * Scheme tenure — gates whether the resolved jurisdiction's
   * typicalMarketSizeUpliftPercent is applied at all. "market" (the
   * default when unset): the uplift applies, since it's sourced from
   * market-sale schemes. "social": every house type is built at its
   * bare NDSS minimum GIA regardless of the jurisdiction's uplift
   * evidence — an RSL/affordable scheme typically builds at or close to
   * the space-standard floor to manage cost, not above it; applying a
   * market-scheme uplift here would be a real sourcing error, not just
   * an approximation. Only set "social" when there's real evidence the
   * scheme is RSL-led/100% affordable (e.g. the applicant is a
   * registered social landlord) — never guessed from unit count or
   * density alone.
   */
  tenure?: "market" | "social";
  /** Which council's local rules pack to resolve against (src/rules/jurisdictions). Defaults to "pembrokeshire" — the only pack implemented so far. Unknown/unset councils fall back to the national baseline alone. */
  localAuthority?: string;
  /** Local market value band (1=lowest..4=highest), a council-specific concept (see src/rules/jurisdictions/types.ts). Defaults to the resolved local pack's own defaultMarketBand. */
  marketBand?: MarketBand;
  /**
   * Settlement tier for the resolved jurisdiction's minimum-density policy
   * (LocalPlanningRules.minGrossDensityDphByTier — e.g. "town",
   * "service centre", "service village" for Pembrokeshire). NOT the same
   * concept as a house-size tier (see sizeTiers.ts). Left unset by
   * default: the engine has no settlement-tier lookup of its own, so an
   * unset tier produces a plain-English "couldn't check" compliance
   * warning rather than silently skipping the rule or guessing a tier.
   */
  settlementTier?: string;
  /** £ per m² used to estimate open-market GDV, overriding the resolved jurisdiction's own sourced default for this market band. */
  gdvPerSqm?: number;
  /** £ per m² used to estimate build cost, overriding the resolved jurisdiction's own sourced default for this scheme-size band. */
  buildCostPerSqm?: number;
  /**
   * Stability hint for interactive dragging: the previous call's chosen
   * road-topology side ("double" | "single-left" | "single-right"), if
   * known. When the current input is ambiguous between equally-valid
   * topologies, the engine prefers whichever matches this hint, to avoid
   * the whole layout flipping/reshuffling on a small pointer move. Purely
   * a preference tie-breaker — a hard rule or a clearly better fit still
   * wins over matching the hint. See generateLayout.ts's topology search.
   */
  previousTopologyHint?: "double" | "single-left" | "single-right";
  /**
   * "full" (default): search every candidate position at the normal
   * 0.5m step, trying every house type's fallback cascade at each one —
   * the best layout this engine can find. "draft": a coarser, faster
   * search for use WHILE the user is actively dragging a vertex/entrance
   * (a bigger position step, and no fallback-to-other-types search — only
   * the mix cycle's preferred type is tried at each position, with that
   * type's own block-size fallback only). Draft can therefore place
   * FEWER units than full (it's a strict subset of what full would try),
   * but every unit it DOES place passes the exact same hard-rule checks
   * (NDSS, garden depth, back-to-back, frontage, overlap, block rules) —
   * draft is never less correct, only less exhaustive. Intended use:
   * draft while dragging, one final full recalculation on release.
   */
  quality?: "draft" | "full";
  /**
   * Plain-English "design standard" control for the gap between
   * separate blocks (terrace run / semi pair / detached) along the
   * street — see rules.ts's SIDE_GAP_TIER_M for sourcing. Defaults to
   * "tighter", i.e. today's existing SIDE_GAP_M — omitting this field
   * entirely reproduces identical behaviour to before it existed.
   * Never relaxes a hard rule: all three tiers only ever widen the gap,
   * never narrow it below the sourced ~1m minimum.
   */
  sideGapTier?: "tighter" | "typical" | "roomier";
  /**
   * "Keep clear" zones — see Restriction's own doc comment. Only
   * `hardness: "hard"` entries are enforced (plots, road corridors and
   * turning heads must not overlap them, in every topology); "soft"
   * entries are stored on the output for display/audit but have no
   * effect on placement yet. Omit or leave empty for no restrictions at
   * all — identical behaviour to before this field existed.
   */
  restrictions?: Restriction[];
}

export interface PlacedPlot {
  id: string;
  houseType: HouseTypeId;
  /** Whole plot boundary (driveway/parking + house footprint + garden), BNG polygon. */
  plotBng: BNGPolygon;
  /** House footprint, BNG polygon. */
  footprintBng: BNGPolygon;
  /** Private garden area, BNG polygon, or null if none could be fitted. */
  gardenBng: BNGPolygon | null;
  /** Gross internal area, m². */
  giaM2: number;
  /** Id shared by every unit placed in the same attached block (terrace run, semi pair, or a lone detached unit). */
  blockId: string;
  /** This plot's position within its block, 0-indexed from the block's first unit. */
  blockPosition: number;
  /** Total number of units in this plot's block. */
  blockSize: number;
}

export interface RoadSegment {
  id: string;
  centerlineBng: BNGPoint[];
  widthM: number;
}

export interface LayoutResult {
  plots: PlacedPlot[];
  roads: RoadSegment[];
  parkingSpacesBng: BNGPoint[];
}

export interface Metrics {
  totalUnits: number;
  mix: Record<HouseTypeId, number>;
  /** Dwellings per hectare over the developable (net) area — excludes roads/open space. */
  netDensityDph: number;
  /** Dwellings per hectare over the whole site boundary. */
  grossDensityDph: number;
  totalGiaM2: number;
  gdv: number;
  buildCost: number;
  /** Target developer profit deducted in arriving at residualLandValue (not a cash cost line, but shown for transparency). */
  developerProfit: number;
  residualLandValue: number;
  /** Number of the totalUnits notionally treated as affordable, per the resolved jurisdiction's affordable-housing-% table. Note: v0's layout doesn't tag any specific physical plot as "affordable" — this is a financial overlay on the whole scheme, not a per-plot flag. */
  affordableUnits: number;
  /** The % actually used (0 if the resolved table had no on-site figure for this band/size, e.g. because the source says "off-site contribution" instead — see jurisdiction pack comments). */
  affordablePercentOnSite: number;
  /** Which council's rules were actually resolved and used for this calculation. */
  localAuthority: string;
  /** Which market band was actually used (input, or the local pack's own default). */
  marketBand: MarketBand;
  /** true when affordableUnits > 0 and the resolved jurisdiction approximates ACG (Acceptable Cost Guidance) as equal to OMV for the social-rent transfer value — this OVERSTATES gdv, developerProfit and residualLandValue, since real ACG rates are materially below OMV. Surface prominently in the UI whenever true; never hide it. */
  affordableValueOverstated: boolean;
  /** residualLandValue is always a simplified, single-point calculation (no real cash-flow model) — present so the UI doesn't need to hardcode that fact; always true in v0. */
  residualLandValueIndicative: true;
  /**
   * Which road/plot topology this call actually used. Feed back as the
   * NEXT call's EngineInputs.previousTopologyHint during interactive
   * dragging, to reduce flip-flopping between single-left/single-right
   * when the site is near the double-loaded/single-sided boundary.
   * "frontage-ribbon": no NEW estate road at all — plots front directly
   * onto the existing boundary edge the entrance sits on, tried as a
   * fallback whenever the estate-road topologies (double/single-left/
   * single-right) place zero homes. See generateLayout.ts's
   * tryFrontageRibbon for when this applies and why.
   * "branching-spurs": a central spine road with spur cul-de-sacs
   * branching off it, each ending in its own turning head — tried
   * ALONGSIDE the ribbon and frontage-ribbon topologies (not just as a
   * last-resort fallback), and used whenever it places more homes than
   * either. See generateLayout.ts's tryBranchingSpurs.
   */
  topologyUsed: "double" | "single-left" | "single-right" | "frontage-ribbon" | "branching-spurs" | "none";
  /**
   * Set WHENEVER totalUnits === 0 — a plain-English, one-line reason this
   * boundary/entrance placed nothing, in the exact style "Frontage is 9m:
   * a road and one plot need about 14m." Null whenever totalUnits > 0.
   * The engine never returns a silent zero: every zero-unit result comes
   * with this filled in, computed from the same numbers the "topology"
   * and "boundary-offset" ComplianceCheck entries already report in more
   * technical detail — this is the plain-English summary of the same
   * finding, not a separate guess.
   */
  zeroHomesReason: string | null;
  /**
   * Machine-readable version of zeroHomesReason, for grouping/reporting
   * (see scripts/fuzz-shapes.ts) rather than string-matching the prose.
   * Null whenever zeroHomesReason is null.
   */
  zeroHomesCause: "boundary-too-complex" | "turning-head-no-fit" | "frontage-too-narrow" | "area-too-small" | "restriction-blocks-road" | null;
  /**
   * % of the gross site area set aside as a non-housing reserve (open
   * space, drainage/SuDS, landscape buffers) before any plot was placed,
   * sized from the resolved jurisdiction's own net-to-gross evidence by
   * scheme size. 0 when no local appraisal pack is resolved at all (there's
   * nothing jurisdiction-specific to size it from) — never a silent
   * assumption, just genuinely nothing applied. See generateLayout.ts's
   * reserve computation, right after the boundary erosion, for exactly
   * how the scheme-size band is estimated and the source cited.
   */
  nonHousingReservePercent: number;
  /** Where nonHousingReservePercent's underlying ratio came from — null iff nonHousingReservePercent is 0. */
  nonHousingReserveSource: string | null;
}

export interface ComplianceCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  /** Where the rule comes from — a citation, not a magic number. */
  ruleRef: string;
  detail: string;
  /**
   * Set ONLY by checks that are genuinely per-plot (a specific home's
   * own GIA/garden/parking is under the minimum) rather than scheme-
   * structural (road/topology/turning-head) — the ids of PlacedPlot
   * entries this specific check actually failed for. Lets the UI report
   * a real "N homes affected" count instead of inventing one; absent
   * entirely on checks where "which plot" doesn't apply.
   */
  affectedPlotIds?: string[];
}

export interface EngineOutput {
  layout: LayoutResult;
  metrics: Metrics;
  compliance: ComplianceCheck[];
}
