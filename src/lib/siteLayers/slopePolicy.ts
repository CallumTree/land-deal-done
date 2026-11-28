// Slope honesty: the engine (src/engine/generateLayout.ts) doesn't model
// slope at all — every layout it produces assumes a flat site. Site
// Layers (src/app/api/site-layers/route.ts) reads real LiDAR, so once
// that's in we can at least say when a site is steep enough that the
// flat-site assumption matters, without pretending to validate against
// any actual engineering rule.
//
// 25% is a judgement call, not a rule: there's no cited planning or
// engineering standard behind it, just a reasonable guess at "enough of
// the site is steeper than a comfortable estate-road gradient (1:15)
// that levels should be checked before trusting this layout." Tune it
// if it proves too noisy or too quiet in practice. Shared by the
// compliance status line (page.tsx) and the About this site card
// (SiteLayersCard.tsx) so both agree on what counts as "steep".
export const SLOPE_STEEP_THRESHOLD_PCT = 25;

export function isSteepSite(steeperThan1in15Pct: number): boolean {
  return steeperThan1in15Pct > SLOPE_STEEP_THRESHOLD_PCT;
}
