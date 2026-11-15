// Resolves a site's jurisdiction: National baseline ⊕ Local pack for its
// council (if one exists). Adding a new council is one new file (see
// pembrokeshire.ts) plus one entry in LOCAL_PACKS below — no changes to
// national.ts, types.ts, or the engine.

import { NATIONAL_APPRAISAL_BASELINE, NATIONAL_PLANNING_BASELINE } from "./national";
import { PEMBROKESHIRE_APPRAISAL_DEFAULTS, PEMBROKESHIRE_PLANNING_RULES } from "./pembrokeshire";
import type { LocalAppraisalDefaults, LocalPlanningRules, NationalAppraisalBaseline, NationalPlanningBaseline } from "./types";

export const DEFAULT_LOCAL_AUTHORITY = "pembrokeshire";

const LOCAL_PACKS: Record<string, { planning: LocalPlanningRules; appraisal: LocalAppraisalDefaults }> = {
  pembrokeshire: { planning: PEMBROKESHIRE_PLANNING_RULES, appraisal: PEMBROKESHIRE_APPRAISAL_DEFAULTS },
};

export interface ResolvedJurisdiction {
  /** The key actually resolved (lower-cased), not necessarily what was passed in. */
  localAuthority: string;
  nationalPlanning: NationalPlanningBaseline;
  nationalAppraisal: NationalAppraisalBaseline;
  /** null if no local pack exists for this council yet — callers fall back to nationalPlanning/nationalAppraisal alone, which for appraisal defaults means mostly UNSOURCED placeholders (see national.ts). */
  localPlanning: LocalPlanningRules | null;
  localAppraisal: LocalAppraisalDefaults | null;
}

export function resolveJurisdiction(localAuthority?: string): ResolvedJurisdiction {
  const key = (localAuthority ?? DEFAULT_LOCAL_AUTHORITY).trim().toLowerCase();
  const pack = LOCAL_PACKS[key];
  return {
    localAuthority: key,
    nationalPlanning: NATIONAL_PLANNING_BASELINE,
    nationalAppraisal: NATIONAL_APPRAISAL_BASELINE,
    localPlanning: pack?.planning ?? null,
    localAppraisal: pack?.appraisal ?? null,
  };
}

export * from "./types";
