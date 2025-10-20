import { PropertyRow, GlobalInputs } from "./calculator";

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
