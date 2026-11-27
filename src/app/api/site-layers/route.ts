// GET /api/site-layers?b=e,n;e,n;...  (BNG metres, 0.1m — see encodeBoundary)
//
// Slope bands, elevation range and flood-zone cover for a drawn site,
// Wales only for v0. Runs server-side because neither upstream (the
// Welsh Government LiDAR COG on Azure blob storage, NRW's Flood Map for
// Planning WFS on DataMapWales) sends CORS headers for this app.
//
// Caching is HTTP-only, no tables: the response is a pure function of
// the boundary string and two slowly-changing public datasets, so it's
// a GET with a public Cache-Control and Vercel's CDN does the rest.
// Same boundary -> same URL -> CDN hit.
//
// Never throws a raw error at the client: every failure becomes
// { status: "unavailable" } with HTTP 200, and the UI shows one calm
// "not available for this area yet" line.

import type { NextRequest } from "next/server";
import { analyseTerrain, LIDAR_SOURCE_NAME } from "@/lib/siteLayers/server/terrain";
import { analyseFlood, FLOOD_SOURCE_NAME } from "@/lib/siteLayers/server/flood";
import { decodeBoundary, type SiteLayersResponse, type SiteLayersUnavailableReason } from "@/lib/siteLayers/types";
import { area, isSimplePolygon } from "@/engine/geometry";

export const maxDuration = 30;

// A week at the CDN, a day in the browser, and serve stale for a week
// while revalidating — both datasets update a few times a year.
const CACHE_OK = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";
// "Not in Wales" / "too big" are just as stable as a real answer.
const CACHE_STABLE_UNAVAILABLE = "public, max-age=86400, s-maxage=604800";
// An upstream blip shouldn't be pinned for a week — retry soon.
const CACHE_FAILED = "public, max-age=0, s-maxage=60";

function unavailable(reason: SiteLayersUnavailableReason, cacheControl: string) {
  const body: SiteLayersResponse = { status: "unavailable", reason };
  return Response.json(body, { headers: { "Cache-Control": cacheControl } });
}

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export async function GET(request: NextRequest) {
  const boundary = decodeBoundary(request.nextUrl.searchParams.get("b"));
  if (!boundary || !isSimplePolygon(boundary) || area(boundary) < 1) return unavailable("bad-input", CACHE_STABLE_UNAVAILABLE);

  try {
    // Terrain first: it's also the "is this in Wales?" test (the COG is
    // nodata outside Wales), so an English site never queries NRW's WFS.
    const terrain = await analyseTerrain(boundary);
    if (!terrain.ok) return unavailable(terrain.reason, CACHE_STABLE_UNAVAILABLE);
    const flood = await analyseFlood(boundary);

    const body: SiteLayersResponse = {
      status: "ok",
      siteAreaM2: area(boundary),
      elevation: { minM: terrain.minM, maxM: terrain.maxM },
      slope: { steeperThan1in15Pct: terrain.steeperThan1in15Pct, steeperThan1in10Pct: terrain.steeperThan1in10Pct },
      flood: { anyPct: flood.anyPct, zones: flood.zones },
      sources: {
        lidar: { name: LIDAR_SOURCE_NAME, date: formatDate(terrain.sourceDate) },
        flood: { name: FLOOD_SOURCE_NAME, date: formatDate(flood.sourceDate) },
      },
    };
    return Response.json(body, { headers: { "Cache-Control": CACHE_OK } });
  } catch (err) {
    console.error("site-layers failed", err);
    return unavailable("upstream-failed", CACHE_FAILED);
  }
}
