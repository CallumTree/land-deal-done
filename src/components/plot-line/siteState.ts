// No-backend save/share, per the audit's Part 5 proposal — replaces the
// unused Supabase sites/scenarios tables (deleted in the audit cleanup
// commit) with two client-only mechanisms:
//
// 1. Save (return later): one auto-saved slot in localStorage, restored
//    silently on load. No login, no named "projects" — this product
//    doesn't need multi-site management yet, and a picker UI would be
//    exactly the kind of extra screen CLAUDE.md says to challenge first.
// 2. Share (send to someone else): the same state encoded into the URL
//    HASH (never a query param, so it never reaches a server log —
//    everything here already runs client-side, this keeps persistence
//    client-side too). On load, a hash wins over the localStorage slot —
//    a shared link should show what was shared, not the viewer's own
//    last site.
//
// Encoding: boundary/entrance coordinates are BNG eastings/northings —
// real numbers with no meaningful sub-metre precision at this product's
// current fidelity. Rounded to the nearest 0.1m, stored as integers
// (x10), and delta-encoded against the previous point (adjacent boundary
// vertices are always close together, so deltas stay small and the JSON
// stays compact) rather than storing every point's full absolute
// magnitude. The whole thing is a plain number array — not a bespoke
// binary format — so it's easy to read, debug and extend; JSON.stringify
// + base64url is "simplest tool that works," not a performance-critical
// path.

import type { BNGPoint, BNGPolygon } from "@/engine/types";
import { SIZE_TIERS, type SizeTier } from "@/engine/sizeTiers";
import type { MixMode } from "@/hooks/useMixState";

export interface SiteState {
  boundary: BNGPolygon;
  entrance: BNGPoint | null;
  mixMode: MixMode;
  sizeMix: Partial<Record<SizeTier, number>>;
  includeBungalows: boolean;
}

const LOCAL_STORAGE_KEY = "plotline.siteState.v1";
const COORD_SCALE = 10; // 0.1m precision

function round10(n: number): number {
  return Math.round(n * COORD_SCALE);
}

/**
 * Packs SiteState into a flat number array:
 *   [hasEntrance, mixModeFlag, bungalowFlag, small, medium, large, xl,
 *    boundaryPointCount,
 *    originE, originN, dE1, dN1, dE2, dN2, ...,
 *    (if hasEntrance) entranceDE, entranceDN]
 * Boundary points are delta-encoded against the PREVIOUS boundary point
 * (first point is absolute). The entrance is delta-encoded against the
 * first boundary point — always present whenever an entrance is, and as
 * good a nearby reference as any other.
 */
function packSiteState(state: SiteState): number[] {
  const out: number[] = [
    state.entrance ? 1 : 0,
    state.mixMode === "auto" ? 1 : 0,
    state.includeBungalows ? 1 : 0,
    ...SIZE_TIERS.map((t) => state.sizeMix[t] ?? 0),
    state.boundary.length,
  ];

  let prevE = 0;
  let prevN = 0;
  state.boundary.forEach(([e, n], i) => {
    const re = round10(e);
    const rn = round10(n);
    out.push(i === 0 ? re : re - prevE, i === 0 ? rn : rn - prevN);
    prevE = re;
    prevN = rn;
  });

  if (state.entrance && state.boundary.length > 0) {
    const [originE, originN] = state.boundary[0];
    out.push(round10(state.entrance[0]) - round10(originE), round10(state.entrance[1]) - round10(originN));
  }

  return out;
}

function unpackSiteState(nums: number[]): SiteState | null {
  if (nums.length < 8) return null;
  const [hasEntrance, mixModeFlag, bungalowFlag, small, medium, large, xl, pointCount, ...rest] = nums;
  if (pointCount < 0 || pointCount > 200) return null; // sanity bound — a real boundary never has this many points

  const boundary: BNGPolygon = [];
  let cursor = 0;
  let e = 0;
  let n = 0;
  for (let i = 0; i < pointCount; i++) {
    const de = rest[cursor++];
    const dn = rest[cursor++];
    if (de === undefined || dn === undefined) return null;
    e = i === 0 ? de : e + de;
    n = i === 0 ? dn : n + dn;
    boundary.push([e / COORD_SCALE, n / COORD_SCALE]);
  }

  let entrance: BNGPoint | null = null;
  if (hasEntrance) {
    const dE = rest[cursor++];
    const dN = rest[cursor++];
    if (dE === undefined || dN === undefined || boundary.length === 0) return null;
    entrance = [boundary[0][0] + dE / COORD_SCALE, boundary[0][1] + dN / COORD_SCALE];
  }

  const sizeMix: Partial<Record<SizeTier, number>> = { Small: small, Medium: medium, Large: large, XL: xl };

  return {
    boundary,
    entrance,
    mixMode: mixModeFlag ? "auto" : "manual",
    sizeMix,
    includeBungalows: !!bungalowFlag,
  };
}

function base64UrlEncode(s: string): string {
  const b64 = typeof window === "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  return typeof window === "undefined" ? Buffer.from(padded, "base64").toString("utf8") : atob(padded);
}

/** Encodes state into a URL hash fragment value (no leading "#"). Never throws — a malformed/empty state just encodes to a tiny, harmless string. */
export function encodeSiteStateToHash(state: SiteState): string {
  return base64UrlEncode(JSON.stringify(packSiteState(state)));
}

/**
 * Decodes a URL hash fragment value back into SiteState. Returns null on
 * ANYTHING malformed (bad base64, invalid JSON, wrong shape, corrupted
 * numbers) — callers fall back to localStorage or a blank site, exactly
 * as if no hash were present. Never throws.
 */
export function decodeHashToSiteState(hash: string): SiteState | null {
  if (!hash) return null;
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(hash));
    if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    return unpackSiteState(parsed);
  } catch {
    return null;
  }
}

/** Reads the current page's location.hash (minus "#") and decodes it, or null if absent/invalid. SSR-safe: returns null server-side. */
export function readHashSiteState(): SiteState | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  return decodeHashToSiteState(hash);
}

/** Writes state into the page's URL hash (replacing history, not pushing a new entry — this isn't "back button" navigation state). */
export function writeHashSiteState(state: SiteState): void {
  if (typeof window === "undefined") return;
  const encoded = encodeSiteStateToHash(state);
  window.history.replaceState(null, "", `#${encoded}`);
}

/** The one auto-save slot. SSR-safe: a no-op server-side, same pattern as mapFilter.ts's readStoredMapTheme. */
export function readStoredSiteState(): SiteState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    return unpackSiteState(parsed);
  } catch {
    return null;
  }
}

export function storeSiteState(state: SiteState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(packSiteState(state)));
  } catch {
    // Storage can throw (quota, private mode) — saving is a convenience, never worth crashing the app over.
  }
}

/** Builds the full, absolute shareable URL for the given state (origin + pathname + encoded hash). */
export function buildShareUrl(state: SiteState): string {
  const encoded = encodeSiteStateToHash(state);
  if (typeof window === "undefined") return `#${encoded}`;
  return `${window.location.origin}${window.location.pathname}#${encoded}`;
}
