// Types for the rule-based smart site layout generator.
// Geometry is expressed as standard GeoJSON (WGS84 lng/lat) so it can be
// rendered directly on the Leaflet map alongside the drawn site boundary.

export type LngLat = [number, number];
export type RingGeoJSON = GeoJSON.Feature<GeoJSON.Polygon>;

export interface PlacedPlot {
  id: string;
  houseType: string;
  plotPolygon: RingGeoJSON;
  housePolygon: RingGeoJSON;
  gardenPolygon: RingGeoJSON | null;
  frontageM: number;
  plotDepthM: number;
  gardenDepthM: number;
  gardenAreaM2: number;
  gia: number;
  side: "north" | "south";
}

export interface ComplianceCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface LayoutSummary {
  totalUnits: number;
  achievedDensityUprHa: number;
  roadLengthM: number;
  totalGardenAreaM2: number;
  averageGardenDepthM: number;
  mixCounts: Record<string, number>;
  estimatedGDV: number;
  estimatedBuildCost: number;
  profitProxy: number;
  compliance: ComplianceCheck[];
}

export interface LayoutResult {
  id: string;
  label: string;
  mixType: string;
  orientationDeg: number;
  plots: PlacedPlot[];
  roadPolygon: RingGeoJSON | null;
  summary: LayoutSummary;
  isWinner: boolean;
}

export interface LayoutGenerationOutput {
  winner: LayoutResult | null;
  candidates: LayoutResult[];
  warning?: string;
}
