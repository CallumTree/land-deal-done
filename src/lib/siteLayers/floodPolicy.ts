// Which flood zones get "No homes here" by default, and what to warn when
// a zone is left open to homes. Wales only (v0), so the policy source is
// Welsh Government, Technical Advice Note 15: Development, flooding and
// coastal erosion (the March 2025 edition that works off NRW's Flood Map
// for Planning; gov.wales TAN 15 page, last updated 20 March 2026).
//
// - TAN 15 Figure 4 / para 9.2: "All residential premises" are HIGHLY
//   VULNERABLE development. Every home this engine places is in that
//   category, so every rule below is read at that level.
// - TAN 15 para 10.22 (Zone 3, planning applications): "No new highly
//   vulnerable development on greenfield land should be permitted in
//   zone 3 regardless of the conclusion of any Flood Consequences
//   Assessments". Para 10.20 says the same for allocations: they "must
//   not be made". Paras 10.20-10.22 sit under section 10's zones as
//   drawn on the Flood Map for Planning for RIVERS and SEA. Hence: river
//   and sea Zone 3 are "No homes here" BY DEFAULT.
//   Not modelled in v0: brownfield redevelopment in Zone 3 (para 10.23 —
//   possible only if essential to the plan strategy, never residential
//   at ground floor), and TAN 15 Defended Zones (paras 10.13-10.17),
//   which the Flood Map for Planning layers used here still show as
//   Zone 3. Both are reasons a user might switch the default off — the
//   toggle stays theirs.
// - TAN 15 para 10.19 (Zone 2, planning applications): new highly
//   vulnerable development on greenfield land is "only appropriate
//   where the site has been allocated in adopted Development Plans",
//   with a Flood Consequences Assessment showing acceptable risk. So
//   homes are possible — off by default, with a warning.
// - TAN 15 para 6.1 (Surface Water and Small Watercourses, Zones 2 and
//   3): a Flood Consequences Assessment "is required for any development
//   proposal located fully or partly" in these zones, and new
//   development next to them should be "appropriately set back". TAN 15
//   doesn't bar homes outright here — off by default, with a warning.

import type { FloodSource, FloodZoneId, FloodZoneLayer } from "./types";

export function noHomesByDefault(zone: Pick<FloodZoneLayer, "source" | "zone">): boolean {
  return zone.zone === 3 && (zone.source === "rivers" || zone.source === "sea");
}

const SOURCE_LABEL: Record<FloodSource, string> = {
  rivers: "Rivers",
  sea: "Sea",
  surface: "Surface water",
};

export function floodZoneLabel(zone: Pick<FloodZoneLayer, "source" | "zone">): string {
  return `${SOURCE_LABEL[zone.source]} · Zone ${zone.zone}`;
}

/** Shown while a zone is OPEN to homes — plain English, one line, with the TAN 15 paragraph. */
export function openZoneWarning(zone: Pick<FloodZoneLayer, "source" | "zone">): string {
  if (zone.source === "surface") return "Homes here need a flood consequences assessment (TAN 15 §6.1).";
  if (zone.zone === 3) return "Wales doesn't allow new homes here on greenfield land (TAN 15 §10.22).";
  return "Homes here only if the local plan allocates the site, with a flood assessment (TAN 15 §10.19).";
}

export type FloodOverrides = Partial<Record<FloodZoneId, boolean>>;

export function isNoHomes(zone: FloodZoneLayer, overrides: FloodOverrides): boolean {
  return overrides[zone.id] ?? noHomesByDefault(zone);
}
