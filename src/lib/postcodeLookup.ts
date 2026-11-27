// Postcode -> British National Grid lookup via postcodes.io (ONS/OS
// open-data, no API key). Its own `eastings`/`northings` fields ARE
// already OSGB36/EPSG:27700 British National Grid metres — confirmed
// directly against a real response (SW1A 1AA -> eastings 529090,
// northings 179645, the well-known BNG reference for that location) —
// no lat/lng reprojection needed at all.

import type { BNGPoint } from "@/engine/types";

export interface PostcodeLookupResult {
  centerBng: BNGPoint;
  postcode: string;
}

export async function lookupPostcode(query: string): Promise<PostcodeLookupResult> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("Enter a postcode.");

  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed.replace(/\s+/g, ""))}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error(`"${trimmed}" doesn't look like a real UK postcode.`);
    throw new Error(`Postcode lookup failed (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { result?: { eastings: number | null; northings: number | null; postcode: string } };
  const result = data.result;
  if (!result || typeof result.eastings !== "number" || typeof result.northings !== "number") {
    throw new Error(`"${trimmed}" has no grid reference on file — try a nearby postcode.`);
  }
  return { centerBng: [result.eastings, result.northings], postcode: result.postcode };
}
