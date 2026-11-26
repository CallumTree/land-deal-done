// Every default the engine applies, in one place, each with where it comes
// from. Nothing in generateLayout.ts/compliance.ts should hardcode a number
// that isn't read from here (or from EngineInputs, which overrides these).
//
// If a figure below isn't genuinely sourced, that's a bug — flag it rather
// than trust the comment.
//
// Hard planning-rule figures (NDSS, back-to-back, garden depth, parking,
// road width, turning head, fire access) now live in the layered
// jurisdiction rules system (src/rules/jurisdictions/national.ts) and are
// re-exported below unwrapped (plain numbers, not Sourced<T>) so existing
// call sites don't need to change. See national.ts for the actual source
// citations. Only v0's own engineering-modelling assumptions (footprint
// depth, storeys, side gap, block size caps, boundary offset) stay local
// to this file, since those aren't planning-rule figures a local authority
// could override — they're how this specific engine turns a GIA number
// into a footprint rectangle.

import type { HouseTypeId } from "./types";
import * as national from "../rules/jurisdictions/national";

export const NDSS_MIN_GIA_M2: Record<HouseTypeId, number> = {
  "2-bed-terrace": national.NDSS_MIN_GIA_M2["2-bed-terrace"].value,
  "2-bed-semi": national.NDSS_MIN_GIA_M2["2-bed-semi"].value,
  "2-bed-detached": national.NDSS_MIN_GIA_M2["2-bed-detached"].value,
  "3-bed-terrace": national.NDSS_MIN_GIA_M2["3-bed-terrace"].value,
  "3-bed-semi": national.NDSS_MIN_GIA_M2["3-bed-semi"].value,
  "3-bed-detached": national.NDSS_MIN_GIA_M2["3-bed-detached"].value,
  "3-bed-bungalow": national.NDSS_MIN_GIA_M2["3-bed-bungalow"].value,
  "4-bed-terrace": national.NDSS_MIN_GIA_M2["4-bed-terrace"].value,
  "4-bed-semi": national.NDSS_MIN_GIA_M2["4-bed-semi"].value,
  "4-bed-detached": national.NDSS_MIN_GIA_M2["4-bed-detached"].value,
  "5-bed-detached": national.NDSS_MIN_GIA_M2["5-bed-detached"].value,
};

/** Storeys assumed per house type, for footprint = GIA / storeys. Bungalow is single-storey by definition (confirmed from Fern Rise's own elevations); every other type is fixed at 2 for v0. */
export const STOREYS: Record<HouseTypeId, number> = {
  "2-bed-terrace": 2,
  "2-bed-semi": 2,
  "2-bed-detached": 2,
  "3-bed-terrace": 2,
  "3-bed-semi": 2,
  "3-bed-detached": 2,
  "3-bed-bungalow": 1,
  "4-bed-terrace": 2,
  "4-bed-semi": 2,
  "4-bed-detached": 2,
  "5-bed-detached": 2,
};

/**
 * Footprint depth, m, assumed per house type — a typical UK volume-
 * housebuilder plan depth for a house of this size. This is a
 * modelling assumption (footprint width is then derived as
 * footprint area ÷ this depth), not a published standard — flagged as
 * such rather than presented as a citation.
 *
 * Bungalow depth is set at 8m, informed by (not equal to) Fern Rise's
 * real dimensioned plans, which show an overall building envelope of
 * roughly 14.2-14.35m wide x 8.3-9.4m deep INCLUDING the integral
 * garage. Since v0's footprint here represents only the habitable area
 * (NDSS minimum, garage excluded — see NDSS_MIN_GIA_M2's comment), 8m
 * is a deliberately slightly-shallower depth than the real overall
 * envelope, not a direct transcription of it.
 *
 * Every form of a given bedroom count (terrace/semi/detached) shares the
 * same assumed depth — attachment form isn't modelled as changing plan
 * depth in v0, only width (derived from GIA/storeys/depth). 5-bed is a
 * new, slightly deeper assumption (10m) than 4-bed's 9m, same honest
 * "modelling assumption, not a citation" status as the rest.
 */
export const ASSUMED_FOOTPRINT_DEPTH_M: Record<HouseTypeId, number> = {
  "2-bed-terrace": 7.5,
  "2-bed-semi": 7.5,
  "2-bed-detached": 7.5,
  "3-bed-terrace": 8,
  "3-bed-semi": 8,
  "3-bed-detached": 8,
  "3-bed-bungalow": 8,
  "4-bed-terrace": 9,
  "4-bed-semi": 9,
  "4-bed-detached": 9,
  "5-bed-detached": 10,
};

/** Minimum distance between facing habitable-room windows on opposing plots. See national.ts for source. Editable via EngineInputs. */
export const BACK_TO_BACK_M = national.BACK_TO_BACK_M.value;

/** Minimum private garden (rear amenity space) depth. See national.ts for source. Editable via EngineInputs. */
export const MIN_GARDEN_DEPTH_M = national.MIN_GARDEN_DEPTH_M.value;

/** Off-street parking spaces required per dwelling. See national.ts for source — explicitly not a national standard, always check the local pack. Editable via EngineInputs. */
export const PARKING_SPACES_PER_UNIT = national.PARKING_SPACES_PER_UNIT.value;

/** Plan dimensions of a single on-plot parking space, m. See national.ts for source. */
export const PARKING_SPACE_WIDTH_M = national.PARKING_SPACE_WIDTH_M.value;
export const PARKING_SPACE_DEPTH_M = national.PARKING_SPACE_DEPTH_M.value;

/** Minimum carriageway width for a short access road serving housing. See national.ts for source. */
export const ROAD_WIDTH_M = national.ROAD_WIDTH_M.value;

/** Turning head diameter for a dead-end road. See national.ts for source. */
export const TURNING_HEAD_DIAMETER_M = national.TURNING_HEAD_DIAMETER_M.value;

/** Maximum distance from a fire appliance's pumping position to a dwelling's entrance. See national.ts for source. */
export const MAX_FIRE_ACCESS_DISTANCE_M = national.MAX_FIRE_ACCESS_DISTANCE_M.value;

/**
 * Inward setback from the site boundary within which nothing may be
 * built (building footprints and private amenity space only — the
 * access road is allowed to meet the boundary at the entrance, since
 * that's definitionally where access is taken). This is a nominal v0
 * default, not a specific published standard — real schemes take this
 * from the site's actual boundary treatment (fences, retaining
 * structures, party-wall agreements). Editable via EngineInputs would be
 * a sensible future addition (not yet wired up).
 */
export const BOUNDARY_OFFSET_M = 1;

/**
 * Minimum gap between separate buildings/blocks (i.e. between the last
 * unit of one terrace/semi/detached block and the first unit of the
 * next). Source: a nominal fire/visual-separation convention — Approved
 * Document B and most UK design guides expect SOME clear gap between
 * unattached external walls, commonly around 1m minimum. This is
 * distinct from BACK_TO_BACK_M (rear-to-rear) and MIN_GARDEN_DEPTH_M
 * (front-to-back) — this is side-to-side, between blocks along the
 * street.
 *
 * Default (unchanged from before the tiers below existed). Kept as its
 * own export, still used directly by anything that doesn't pass
 * EngineInputs.sideGapTier — see SIDE_GAP_TIER_M for the editable
 * version.
 */
export const SIDE_GAP_M = 1;

/**
 * User-facing design-standard tiers for the side gap between blocks —
 * the real lever behind the plain-English "Tighter / Typical / Roomier"
 * control (see EngineInputs.sideGapTier). Resolved via
 * resolveSideGapM() in generateLayout.ts, never used to go BELOW the
 * sourced minimum above — "roomier" only ever widens.
 *
 * - tighter: exactly SIDE_GAP_M (1m) — today's existing default,
 *   unchanged, and the floor this engine will ever build at. This is
 *   already at the documented ~1m fire/visual-separation convention;
 *   nothing here goes any tighter than that sourced minimum.
 * - typical: 2m. A step up with no specific citation — flagged
 *   honestly as this engine's own modelling choice (same status as the
 *   "Generous (+20%)" NDSS toggle elsewhere), not a second sourced
 *   standard.
 * - roomier: 4m. Estimated BY EYE from the real Fern Rise, Neyland
 *   site plan (test-sites/source/fern-rise/PA-Plans_general-
 *   15092008.pdf, page 5, the 1:500 "Site Plan" sheet) against its own
 *   printed graphic scale bar — the gap between adjacent detached
 *   bungalow plots (e.g. plots 20/22, 14/16) reads as roughly 3-5m on
 *   that drawing, not pixel-measured precisely. Same eyeball-against-
 *   a-real-scale-bar method, and the same kind of error margin, this
 *   fixture's other measurements already use throughout test-sites/
 *   README.md — not a new, lower evidence bar invented for this one
 *   number. This is exactly the "general capability improvement...
 *   justified on its own terms" that same README flagged as future
 *   work when SIDE_GAP_M (1m) was found to under-space real detached
 *   schemes like this one.
 */
export const SIDE_GAP_TIER_M: Record<"tighter" | "typical" | "roomier", number> = {
  tighter: SIDE_GAP_M,
  typical: 2,
  roomier: 4,
};

/**
 * Maximum units per attached block, by ATTACHMENT FORM — independent of
 * bedroom count, since "semi" definitionally means a pair and "detached"
 * definitionally means never sharing a wall, regardless of how many
 * bedrooms that semi/detached house has. Only the terrace figure is
 * genuinely configurable: common UK streetscape convention breaks
 * terraces into runs of around 4-6 units for visual variety and to cap
 * cumulative party-wall runs; 6 is used here as the v0 default for every
 * bedroom count's terrace form.
 */
export const MAX_BLOCK_UNITS: Record<HouseTypeId, number> = {
  "2-bed-terrace": 6,
  "2-bed-semi": 2,
  "2-bed-detached": 1,
  "3-bed-terrace": 6,
  "3-bed-semi": 2,
  "3-bed-detached": 1,
  // Confirmed standalone from the site plan (each of the 9 plots is a
  // separate freestanding footprint with its own driveway, no shared walls).
  "3-bed-bungalow": 1,
  "4-bed-terrace": 6,
  "4-bed-semi": 2,
  "4-bed-detached": 1,
  "5-bed-detached": 1,
};

/**
 * Candidate-position search step, metres, along a side's frontage —
 * "full" (the default, used whenever EngineInputs.quality isn't set to
 * "draft") probes every 0.5m; "draft" probes every 2m, a deliberately
 * coarser/faster search intended for live use WHILE a user is dragging a
 * boundary vertex or the entrance (one full-quality recalculation on
 * release gets the best layout; draft just needs to be fast and still
 * valid while the pointer is moving). This is a search-granularity
 * trade-off, not a rule — draft can place fewer units than full (it's a
 * strict subset of the candidates full would try) but every unit it DOES
 * place passes the exact same hard-rule checks, so it's never less
 * correct, only less exhaustive. Both the engine (generateLayout.ts) and
 * the test harness (scripts/invariants.ts) import this same pair of
 * constants so the "no gap big enough for a smaller unit to fit"
 * tolerance — which is inherently a function of how finely the search
 * actually probed — stays consistent between what the engine checks and
 * what the harness independently re-checks, for either quality level.
 */
export const PROBE_STEP_M = 0.5;
export const DRAFT_PROBE_STEP_M = 2;

/**
 * Network-generator topology (generateLayout.ts's tryNetworkGenerator,
 * behind EngineInputs.networkGenerator) — growth-economy constants, not
 * planning-rule figures, so flagged and swappable here rather than
 * derived from any citation.
 *
 * NETWORK_GROWTH_MIN_YIELD_FRACTION: the growth loop scores each
 * candidate road segment by (estimated homes gained) / (road metres
 * added) and keeps growing only while the best candidate's score beats a
 * penalty. The penalty is expressed as a FRACTION of that segment's own
 * theoretical best case — a branch road hosts plots on both sides, so a
 * metre of it can carry at most 2 / (its mix's average plot frontage
 * width) homes; this fraction is how much of that theoretical ceiling a
 * stretch must actually deliver (accounting for boundary/restriction
 * loss, not just an arbitrary cutoff) before it's judged to pay for
 * itself. 0.25 is this engine's own default growth-economy choice, not a
 * sourced standard: a quarter of double-sided capacity is deliberately
 * permissive (plenty of real UK cul-de-sac stretches run well under
 * fully built out on both sides at every metre) while still stopping
 * growth that would mostly just be access road with little housing on
 * it.
 *
 * NETWORK_BRIDGE_THRESHOLD_M: maximum straight-line distance between two
 * dead-end tips for a loop-closing bridge to even be considered. 40m
 * mirrors this feature's own design-spike prototype (see the session's
 * growth_lib.py) — carried over as this engine's starting default rather
 * than re-derived, since there's no planning-rule number for "how close
 * is close enough to bridge"; a bridge is still only ever built if it
 * passes the SAME marginal-value test as every other growth step (see
 * tryNetworkGenerator), so this threshold only bounds which pairs are
 * even tried, not which succeed.
 */
export const NETWORK_GROWTH_MIN_YIELD_FRACTION = 0.25;
export const NETWORK_BRIDGE_THRESHOLD_M = 40;
