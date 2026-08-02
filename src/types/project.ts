import { PropertyRow, GlobalInputs } from "./calculator";
import { LayoutResult } from "./siteLayout";

export type ProjectStatus = "Draft" | "Under Review" | "Approved" | "Completed";
export type ProjectTag = "Residential" | "Mixed-Use" | "Bungalows" | "Apartments" | "Custom";

export interface Project {
  id: string;
  name: string;
  location: string;
  postcode: string;
  dateCreated: string;
  lastUpdated: string;
  status: ProjectStatus;
  tag?: ProjectTag;
  isFavorite: boolean;
  isArchived: boolean;
  
  // Map data
  mapImageUrl?: string;
  polygon?: any;
  siteLayout?: LayoutResult;
  
  // Calculator data
  rows: PropertyRow[];
  inputs: GlobalInputs;
  
  // Quick access metrics (calculated)
  gdv: number;
  profitMargin: number;
  units: number;
  density: number;
  buildCost: number;
  landCost: number;
  netProfit: number;
  roi: number;
  rlv: number;
  
  notes?: string;
  
  // Location Preset tracking
  presetInfo?: {
    region: string;
    spec: "low" | "medium" | "high";
    appliedAt: string;
  };
  
  // Unit mix suggestion metadata
  suggestionMetadata?: {
    source: string; // e.g., "LA completions 2022-24" or "Regional defaults"
    localAuthority?: string;
    region: string;
    baseBand: string; // e.g., "Balanced Mixed"
    generatedAt: string;
    useStandardMix?: boolean; // User opted for standard mix instead
  };
}

export interface ProjectSummary {
  totalGDV: number;
  averageProfitMargin: number;
  highestMarginProject: {
    name: string;
    margin: number;
  } | null;
  averageUnits: number;
  totalSites: number;
  estimatedCombinedRLV: number;
}
