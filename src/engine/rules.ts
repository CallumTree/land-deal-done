// Every default the engine applies, in one place, each with where it comes
// from. Nothing in generateLayout.ts/compliance.ts should hardcode a number
// that isn't read from here (or from EngineInputs, which overrides these).
//
// If a figure below isn't genuinely sourced, that's a bug — flag it rather
// than trust the comment.

import type { HouseTypeId } from "./types";

/**
 * Nationally Described Space Standard minimum Gross Internal Area, m².
 * Source: DCLG, "Technical housing standards – nationally described
 * space standard", March 2015, Table 1.
 *
 * NDSS varies by bedroom count AND bed-space (occupancy) count, not just
 * bedrooms — e.g. a 2-bed home can be 3-person or 4-person. The brief
 * specifies three house types by bedroom count only, so v0 assumes the
 * bed-space variant that's the common volume-housebuilder convention for
 * each: 2-bed = 2b4p, 3-bed = 3b5p, 4-bed (detached) = 4b6p. All assumed
 * 2-storey, which is standard for houses of this size.
 */
export const NDSS_MIN_GIA_M2: Record<HouseTypeId, number> = {
  "2-bed-terrace": 79, // 2 bed, 4 person, 2 storey
  "3-bed-semi": 93, // 3 bed, 5 person, 2 storey
  "4-bed-detached": 106, // 4 bed, 6 person, 2 storey
};

/** Storeys assumed per house type, for footprint = GIA / storeys. v0 fixes this at 2 for all three brief-specified types. */
export const STOREYS: Record<HouseTypeId, number> = {
  "2-bed-terrace": 2,
  "3-bed-semi": 2,
  "4-bed-detached": 2,
};

/**
 * Footprint depth, m, assumed per house type — a typical UK volume-
 * housebuilder plan depth for a 2-storey house of this size. This is a
 * modelling assumption (footprint width is then derived as
 * footprint area ÷ this depth), not a published standard — flagged as
 * such rather than presented as a citation.
 */
export const ASSUMED_FOOTPRINT_DEPTH_M: Record<HouseTypeId, number> = {
  "2-bed-terrace": 7.5,
  "3-bed-semi": 8,
  "4-bed-detached": 9,
};

/**
 * Minimum distance between facing habitable-room windows on opposing
 * plots. Source: the brief itself ("21m back-to-back"), which matches the
 * long-standing UK design-guide convention traced to the Essex Design
 * Guide (1973) and widely adopted since. Editable via EngineInputs.
 */
export const BACK_TO_BACK_M = 21;

/**
 * Minimum private garden (rear amenity space) depth. Source: the brief
 * itself ("10m garden depth"), matching typical UK local design-guide /
 * local plan minimums for private amenity space. Editable via EngineInputs.
 */
export const MIN_GARDEN_DEPTH_M = 10;

/**
 * Off-street parking spaces required per dwelling. UK local authority
 * parking standards vary considerably; 2 spaces/dwelling for houses
 * (as opposed to flats) is a common default seen across many local
 * parking SPDs. Editable via EngineInputs — this is explicitly not a
 * national standard.
 */
export const PARKING_SPACES_PER_UNIT = 2;

/** Plan dimensions of a single on-plot parking space, m. Typical UK parking bay: 2.4-2.5m x 4.8-5m. */
export const PARKING_SPACE_WIDTH_M = 2.5;
export const PARKING_SPACE_DEPTH_M = 5;

/**
 * Minimum carriageway width for a short access road serving housing.
 * Source: Manual for Streets (DfT, 2007), which gives flexible widths
 * depending on context; 5.5m is a commonly used minimum for a single
 * carriageway able to pass two cars, used here as a straightforward v0
 * default. Editable via EngineInputs would be a sensible future addition
 * (not yet wired up — v0 only exposes the inputs listed in EngineInputs).
 */
export const ROAD_WIDTH_M = 5.5;

/**
 * Turning head diameter for a dead-end road, sized to let a refuse/fire
 * appliance turn without reversing. Source: Manual for Streets (DfT,
 * 2007) guidance on turning facilities — commonly cited as a minimum
 * ~16m diameter turning circle (or an equivalent hammerhead, not yet
 * modelled separately in v0 — only the circular/square case is checked).
 */
export const TURNING_HEAD_DIAMETER_M = 16;

/**
 * Maximum distance from a fire appliance's pumping position (taken here
 * as any point on the road) to a dwelling's entrance. Source: Approved
 * Document B (fire safety) and the common UK fire/rescue access
 * convention of a 45m maximum hose-run distance.
 */
export const MAX_FIRE_ACCESS_DISTANCE_M = 45;

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

/** £ per sq ft used to estimate GDV when EngineInputs.gdvPerSqFt isn't supplied. Placeholder — always an input in practice, never a "real" default. */
export const DEFAULT_GDV_PER_SQFT = 300;

/** £ per sq ft used to estimate build cost when EngineInputs.buildCostPerSqFt isn't supplied. Placeholder, same caveat as above. */
export const DEFAULT_BUILD_COST_PER_SQFT = 180;

export const SQM_PER_SQFT = 0.09290304;
