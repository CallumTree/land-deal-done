// "Grid Runner" map/scene palette — the single source of truth shared by
// the 2D map (SiteCanvas.tsx) and the 3D scene (scene3d/*), so a home's
// colour never drifts between the two views. Homes are coloured by size
// (magenta = Small/2-bed forms, violet = everything larger), not a
// per-bedroom-tier gradient — see SiteCanvas.tsx's original comment for
// the reasoning. A plot in `tightPlotIds` (a per-plot hard-rule check the
// engine actually failed) gets amber instead, regardless of its size
// colour, in both views.

import type { HouseTypeId } from "@/engine/types";

export const HOUSE_TYPE_COLOR: Record<HouseTypeId, string> = {
  "2-bed-terrace": "#ff2bd6",
  "2-bed-semi": "#ff2bd6",
  "2-bed-detached": "#ff2bd6",
  "3-bed-terrace": "#8b5cff",
  "3-bed-semi": "#8b5cff",
  "3-bed-detached": "#8b5cff",
  "3-bed-bungalow": "#8b5cff",
  "4-bed-terrace": "#8b5cff",
  "4-bed-semi": "#8b5cff",
  "4-bed-detached": "#8b5cff",
  "5-bed-detached": "#8b5cff",
};

export const GRID_CYAN = "#19f6ff";
export const GRID_AMBER = "#ffb020";
export const GRID_GREEN = "#27ff8a";
export const ROAD_GREY_BLUE = "#4b5a7a";
