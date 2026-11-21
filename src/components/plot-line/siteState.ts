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

import type { BNGPoint, BNGPolygon, Restriction } from "@/engine/types";
import { SIZE_TIERS, type SizeTier } from "@/engine/sizeTiers";
import type { MixMode } from "@/hooks/useMixState";

export interface SiteState {
  boundary: BNGPolygon;
  entrance: BNGPoint | null;
  mixMode: MixMode;
  sizeMix: Partial<Record<SizeTier, number>>;
  includeBungalows: boolean;
  /**
   * "Keep clear" zones drawn via the UI — always `hardness: "hard",
   * reason: "choice"` (see page.tsx's draw-mode handler), so v3's packed
   * payload only persists each zone's POLYGON, not its label/hardness/
   * reason — reconstructed with those fixed defaults on decode (see
   * unpackSiteState). A future UI that lets a drawn zone be "soft," or
   * carries a different reason, would need its own payload field here
   * and a version bump, same as any other layout change.
   */
  restrictions: Restriction[];
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

  // v3: restriction zones, appended after everything above —
  // [zoneCount, (per zone) pointCount, originE, originN, dE1, dN1, ...].
  // Each zone is delta-encoded against ITS OWN first point, not the
  // site boundary's, so a zone stays self-contained regardless of where
  // the boundary happens to sit. Only the polygon is persisted — see
  // SiteState.restrictions' own doc comment for why label/hardness/
  // reason don't need a field here yet.
  out.push(state.restrictions.length);
  for (const r of state.restrictions) {
    out.push(r.polygon.length);
    let pe = 0;
    let pn = 0;
    r.polygon.forEach(([e, n], i) => {
      const re = round10(e);
      const rn = round10(n);
      out.push(i === 0 ? re : re - pe, i === 0 ? rn : rn - pn);
      pe = re;
      pn = rn;
    });
  }

  return out;
}

/**
 * `readRestrictions` gates whether the trailing zones section (see
 * packSiteState above) is even attempted — set false for any hash
 * payload versioned below 3 (including legacy unversioned links),
 * regardless of what numbers happen to be left over, so an old link's
 * leftover bytes (there normally are none) can never be misread as a
 * zones section. The localStorage path always passes true: it always
 * WRITES the section going forward, and an old save with nothing left
 * to read decodes to zero zones via the same `zoneCount === undefined`
 * check unpackSiteState already needs internally.
 */
function unpackSiteState(nums: number[], readRestrictions: boolean): SiteState | null {
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

  const restrictions: Restriction[] = [];
  if (readRestrictions) {
    const zoneCount = rest[cursor++];
    // undefined = nothing left to read, i.e. an old (pre-v3) payload
    // that still reached here somehow (today, only via the tolerant
    // localStorage path) — zero zones, not a decode failure.
    if (zoneCount !== undefined) {
      if (zoneCount < 0 || zoneCount > 50) return null; // sanity bound
      for (let z = 0; z < zoneCount; z++) {
        const ptCount = rest[cursor++];
        if (ptCount === undefined || ptCount < 3 || ptCount > 200) return null;
        const polygon: BNGPolygon = [];
        let ze = 0;
        let zn = 0;
        for (let i = 0; i < ptCount; i++) {
          const de = rest[cursor++];
          const dn = rest[cursor++];
          if (de === undefined || dn === undefined) return null;
          ze = i === 0 ? de : ze + de;
          zn = i === 0 ? dn : zn + dn;
          polygon.push([ze / COORD_SCALE, zn / COORD_SCALE]);
        }
        restrictions.push({ polygon, label: "Keep clear", hardness: "hard", reason: "choice" });
      }
    }
  }

  return {
    boundary,
    entrance,
    mixMode: mixModeFlag ? "auto" : "manual",
    sizeMix,
    includeBungalows: !!bungalowFlag,
    restrictions,
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

// Share-link format version marker. Old links (encoded before this marker
// existed) are a plain number array starting with hasEntrance (always 0 or
// 1) — VERSION_SENTINEL (-1) can never appear there, so prepending
// [VERSION_SENTINEL, HASH_FORMAT_VERSION] to every NEW encoding gives new
// links a tag old links don't have, without touching old links' own
// layout or breaking their decode path at all. Bump HASH_FORMAT_VERSION
// whenever a future change actually alters the payload layout below it.
// History: 1 = no marker at all (pre-marker links). 2 = marker added, no
// payload change. 3 = restriction zones appended to the payload's tail
// (see packSiteState/unpackSiteState) — versions 1 and 2 never read that
// tail, so a zone-less link at either version still decodes correctly
// with zero zones.
const VERSION_SENTINEL = -1;
const HASH_FORMAT_VERSION = 3;

/** Encodes state into a URL hash fragment value (no leading "#"). Never throws — a malformed/empty state just encodes to a tiny, harmless string. */
export function encodeSiteStateToHash(state: SiteState): string {
  return base64UrlEncode(JSON.stringify([VERSION_SENTINEL, HASH_FORMAT_VERSION, ...packSiteState(state)]));
}

/**
 * Decodes a URL hash fragment value back into SiteState. Returns null on
 * ANYTHING malformed (bad base64, invalid JSON, wrong shape, corrupted
 * numbers) — callers fall back to localStorage or a blank site, exactly
 * as if no hash were present. Never throws.
 *
 * Backward-compatible with links encoded before HASH_FORMAT_VERSION
 * existed: those decode as version 1, payload = the whole array. A
 * version-tagged link's own payload is everything after the
 * [VERSION_SENTINEL, version] prefix. Only version >= 3 even attempts to
 * read the zones tail — a version 1 or 2 link always decodes to zero
 * zones, regardless of what (if anything) is left over in its payload.
 */
export function decodeHashToSiteState(hash: string): SiteState | null {
  if (!hash) return null;
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(hash));
    if (!Array.isArray(parsed) || !parsed.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    const isVersioned = parsed[0] === VERSION_SENTINEL;
    const version = isVersioned ? parsed[1] : 1;
    const payload = isVersioned ? parsed.slice(2) : parsed;
    return unpackSiteState(payload, version >= 3);
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
    return unpackSiteState(parsed, true);
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
