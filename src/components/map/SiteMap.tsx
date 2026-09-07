import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { area as turfArea } from '@turf/area';
import distance from '@turf/distance';
import { point } from '@turf/helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, MapPin, ChevronDown, ChevronUp, Download, Trash2, RefreshCw, Map as MapIcon, Satellite, Settings, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { detectLocalAuthority, getLAHousingData, calculateAdjustedMix } from '@/utils/localAuthorityData';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextPreset,
  MixType,
  CONTEXT_DENSITY,
  MIX_LABELS,
  generateSiteLayoutCandidates,
  computeOrigin,
} from '@/utils/siteLayoutEngine';
import { BuildSpec, getUnitEconomics } from '@/utils/houseTypeLibrary';
import { fetchNearbyRoads, detectFrontage, FrontageInfo } from '@/utils/roadNetwork';
import { toLocalXY } from '@/utils/geo';
import { LayoutGenerationOutput, LayoutResult } from '@/types/siteLayout';
import LayoutSummaryPanel from './LayoutSummaryPanel';

interface SiteMapProps {
  onAreaUpdate: (areaM2: number) => void;
  savedArea?: number;
  onGenerateRows?: (rows: any[], metadata?: {
    source: string;
    localAuthority?: string;
    region: string;
    baseBand: string;
    generatedAt: string;
  }) => void;
  onMapSnapshot?: (imageUrl: string) => void;
  onLocationDetected?: (location: string, region: string) => void;
  savedPolygon?: any;
  onPolygonUpdate?: (polygon: any) => void;
  onLayoutGenerated?: (layout: LayoutResult | null) => void;
}

type BasemapType = 'standard' | 'satellite';

interface UnitAssumptions {
  netDevelopable: number;
  infrastructure: number;
  context: ContextPreset;
  mixType: MixType;
  buildSpec: BuildSpec;
}

const MIX_PLOT_AREA: Record<MixType, number> = {
  semis: 220,
  mixed: 230,
  terrace: 150,
  bungalow: 260,
};

const SiteMap = ({ onAreaUpdate, savedArea, onGenerateRows, onMapSnapshot, onLocationDetected, savedPolygon, onPolygonUpdate, onLayoutGenerated }: SiteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const drawnItems = useRef<L.FeatureGroup | null>(null);
  const drawControl = useRef<L.Control.Draw | null>(null);
  const currentTileLayer = useRef<L.TileLayer | null>(null);
  const layoutLayerGroup = useRef<L.FeatureGroup | null>(null);
  const [layoutOutput, setLayoutOutput] = useState<LayoutGenerationOutput | null>(null);
  const [isGeneratingLayout, setIsGeneratingLayout] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [currentArea, setCurrentArea] = useState<number>(savedArea || 0);
  const [currentPerimeter, setCurrentPerimeter] = useState<number>(0);
  const [mapError, setMapError] = useState(false);
  const [basemap, setBasemap] = useState<BasemapType>(() => {
    return (localStorage.getItem('siteMapBasemap') as BasemapType) || 'standard';
  });
  const [fillOpacity, setFillOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('siteMapOpacity');
    return saved ? parseFloat(saved) : 0.3;
  });
  const [assumptions, setAssumptions] = useState<UnitAssumptions>(() => {
    const defaults: UnitAssumptions = {
      netDevelopable: 70,
      infrastructure: 25,
      context: 'suburban' as ContextPreset,
      mixType: 'semis' as MixType,
      buildSpec: 'medium' as BuildSpec,
    };
    const saved = localStorage.getItem('siteMapAssumptions');
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      // Initialize map
      map.current = L.map(mapContainer.current).setView([51.5074, -0.1278], 15);

      // Add initial tile layer
      addTileLayer(basemap);

      // Add scale control for user reference (meters/kilometers)
      L.control.scale({ metric: true, imperial: false }).addTo(map.current!);

      // Initialize feature group for drawn items
      drawnItems.current = new L.FeatureGroup();
      map.current.addLayer(drawnItems.current);

      // Feature group for the generated smart layout overlay (road, plots, gardens)
      layoutLayerGroup.current = new L.FeatureGroup();
      map.current.addLayer(layoutLayerGroup.current);

      // Initialize draw control with higher contrast styles for satellite
      const polygonOptions = getPolygonOptions();
      drawControl.current = new L.Control.Draw({
        edit: {
          featureGroup: drawnItems.current,
        },
        draw: {
          polygon: {
            allowIntersection: false,
            shapeOptions: polygonOptions
          },
          polyline: false,
          circle: false,
          rectangle: false,
          marker: false,
          circlemarker: false,
        },
      });

      map.current.addControl(drawControl.current);

      // Handle draw events
      map.current.on(L.Draw.Event.CREATED, (e: any) => {
        const layer = e.layer;
        drawnItems.current?.clearLayers();
        drawnItems.current?.addLayer(layer);
        updateArea();
        extractAndNotifyPolygon();
        clearGeneratedLayout();
      });

      map.current.on(L.Draw.Event.EDITED, () => {
        updateArea();
        extractAndNotifyPolygon();
        clearGeneratedLayout();
      });

      map.current.on(L.Draw.Event.DELETED, () => {
        updateArea();
        if (onPolygonUpdate) {
          onPolygonUpdate(null);
        }
        clearGeneratedLayout();
      });

    } catch (error) {
      console.error('Map initialization error:', error);
      setMapError(true);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Handle basemap changes
  useEffect(() => {
    if (!map.current) return;
    
    // Remove current tile layer
    if (currentTileLayer.current) {
      currentTileLayer.current.remove();
    }

    // Add new tile layer
    addTileLayer(basemap);

    // Update polygon styling
    updatePolygonStyles();

    // Save preference
    localStorage.setItem('siteMapBasemap', basemap);
  }, [basemap]);

  // Handle opacity changes
  useEffect(() => {
    updatePolygonStyles();
    localStorage.setItem('siteMapOpacity', fillOpacity.toString());
  }, [fillOpacity]);

  // Persist assumptions
  useEffect(() => {
    localStorage.setItem('siteMapAssumptions', JSON.stringify(assumptions));
  }, [assumptions]);

  // Restore saved polygon on mount
  useEffect(() => {
    if (!savedPolygon || !map.current || !drawnItems.current) return;
    
    try {
      // Clear existing layers
      drawnItems.current.clearLayers();
      
      // Create polygon from saved GeoJSON
      const geoJsonLayer = L.geoJSON(savedPolygon, {
        style: getPolygonOptions()
      });
      
      // Add to drawn items
      geoJsonLayer.eachLayer((layer) => {
        drawnItems.current?.addLayer(layer);
      });
      
      // Fit map to polygon bounds
      const bounds = geoJsonLayer.getBounds();
      map.current.fitBounds(bounds, { padding: [50, 50] });
      
      // Update area display
      updateArea();
    } catch (error) {
      console.error('Failed to restore polygon:', error);
    }
  }, [savedPolygon]);

  // Fix: Leaflet map can render blank when container visibility toggles
  useEffect(() => {
    if (!isOpen || !map.current) return;
    const invalidate = () => {
      map.current?.invalidateSize();
      // If a polygon exists, fit bounds to ensure it's visible
      if (drawnItems.current) {
        const layers = drawnItems.current.getLayers();
        if (layers.length > 0) {
          const layer = layers[0] as L.Polygon;
          map.current?.fitBounds(layer.getBounds(), { padding: [20, 20] });
        }
      }
    };

    // Slight delay allows the Collapsible to finish layout
    const t = setTimeout(invalidate, 60);

    // Invalidate on window resize as well
    const onResize = () => map.current?.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [isOpen]);

  const getPolygonOptions = () => {
    const isSatellite = basemap === 'satellite';
    return {
      color: isSatellite ? '#FFFF00' : 'hsl(221, 83%, 53%)',
      fillColor: isSatellite ? '#FFFF00' : 'hsl(221, 83%, 53%)',
      fillOpacity: fillOpacity,
      weight: isSatellite ? 4 : 3,
    };
  };

  const updatePolygonStyles = () => {
    if (!drawnItems.current) return;
    
    const options = getPolygonOptions();
    drawnItems.current.eachLayer((layer: any) => {
      if (layer.setStyle) {
        layer.setStyle(options);
      }
    });
  };

  const addTileLayer = (type: BasemapType) => {
    if (!map.current) return;

    if (type === 'satellite') {
      try {
        // Use Esri World Imagery (free, no API key required)
        const satelliteLayer = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: '© Esri, Maxar, Earthstar Geographics, and the GIS User Community',
            maxZoom: 19,
          }
        );

        satelliteLayer.on('tileerror', () => {
          console.warn('Satellite tiles failed, falling back to standard');
          setBasemap('standard');
          toast.info('Satellite unavailable — using Standard map');
        });

        satelliteLayer.on('tileload', () => {
          setMapError(false);
        });

        satelliteLayer.addTo(map.current);
        currentTileLayer.current = satelliteLayer;
      } catch (error) {
        console.error('Satellite tile error:', error);
        setBasemap('standard');
        toast.info('Satellite unavailable — using Standard map');
      }
    } else {
      // Use OpenStreetMap tiles
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      });

      osmLayer.on('tileerror', () => {
        setMapError(true);
      });

      osmLayer.on('tileload', () => {
        setMapError(false);
      });

      osmLayer.addTo(map.current);
      currentTileLayer.current = osmLayer;
    }
  };

  const updateArea = () => {
    if (!drawnItems.current) return;

    const layers = drawnItems.current.getLayers();
    if (layers.length > 0) {
      const layer = layers[0] as L.Polygon;
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      
      // Convert to GeoJSON for area calculation
      const coordinates = latlngs.map((latlng: L.LatLng) => [latlng.lng, latlng.lat]);
      coordinates.push(coordinates[0]); // Close the polygon
      
      const geojson = {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coordinates]
        },
        properties: {}
      };

      const areaInM2 = turfArea(geojson);
      const perimeterInM = calculatePerimeter(coordinates);
      
      setCurrentArea(areaInM2);
      setCurrentPerimeter(perimeterInM);
    } else {
      setCurrentArea(0);
      setCurrentPerimeter(0);
    }
  };

  const calculatePerimeter = (coords: number[][]): number => {
    let perimeter = 0;
    
    for (let i = 0; i < coords.length - 1; i++) {
      const from = point(coords[i]);
      const to = point(coords[i + 1]);
      const dist = distance(from, to, { units: 'meters' });
      perimeter += dist;
    }
    
    return perimeter;
  };

  const extractAndNotifyPolygon = () => {
    if (!drawnItems.current || !onPolygonUpdate) return;
    
    const layers = drawnItems.current.getLayers();
    if (layers.length > 0) {
      const layer = layers[0] as L.Polygon;
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      
      // Convert to GeoJSON format
      const coordinates = latlngs.map((latlng: L.LatLng) => [latlng.lng, latlng.lat]);
      coordinates.push(coordinates[0]); // Close the polygon
      
      const geojson = {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coordinates]
        },
        properties: {}
      };
      
      onPolygonUpdate(geojson);
    }
  };

  const getCurrentPolygonFeature = (): GeoJSON.Feature<GeoJSON.Polygon> | null => {
    if (!drawnItems.current) return null;
    const layers = drawnItems.current.getLayers();
    if (layers.length === 0) return null;

    const layer = layers[0] as L.Polygon;
    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    const coordinates = latlngs.map((latlng: L.LatLng) => [latlng.lng, latlng.lat] as [number, number]);
    coordinates.push(coordinates[0]);

    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coordinates] },
      properties: {},
    };
  };

  const clearGeneratedLayout = () => {
    setLayoutOutput(null);
    layoutLayerGroup.current?.clearLayers();
    if (onLayoutGenerated) onLayoutGenerated(null);
  };

  const renderLayoutOnMap = (layout: LayoutResult) => {
    if (!layoutLayerGroup.current) return;
    layoutLayerGroup.current.clearLayers();

    layout.roadPolygons.forEach((roadPolygon) => {
      L.geoJSON(roadPolygon, {
        style: { color: '#4b5563', fillColor: '#6b7280', fillOpacity: 0.6, weight: 1 },
      }).addTo(layoutLayerGroup.current!);
    });

    if (layout.entrancePoint) {
      const [lng, lat] = layout.entrancePoint;
      L.circleMarker([lat, lng], {
        radius: 7,
        color: '#dc2626',
        fillColor: '#ef4444',
        fillOpacity: 0.9,
        weight: 2,
      })
        .bindTooltip(`Site access${layout.accessRoadName ? ` from ${layout.accessRoadName}` : ''}`, { permanent: false })
        .addTo(layoutLayerGroup.current);
    }

    layout.plots.forEach((plot) => {
      L.geoJSON(plot.plotPolygon, {
        style: { color: '#1f2937', weight: 1, fillOpacity: 0, dashArray: '3,3' },
      }).addTo(layoutLayerGroup.current!);

      L.geoJSON(plot.housePolygon, {
        style: { color: '#b45309', fillColor: '#f59e0b', fillOpacity: 0.8, weight: 1 },
      })
        .bindTooltip(plot.houseType, { sticky: true })
        .addTo(layoutLayerGroup.current!);

      if (plot.gardenPolygon) {
        L.geoJSON(plot.gardenPolygon, {
          style: { color: '#15803d', fillColor: '#22c55e', fillOpacity: 0.35, weight: 1 },
        }).addTo(layoutLayerGroup.current!);
      }
    });
  };

  const handleGenerateLayout = async () => {
    const polygonFeature = getCurrentPolygonFeature();
    if (!polygonFeature) {
      toast.error('Please draw a boundary first');
      return;
    }

    setIsGeneratingLayout(true);
    try {
      const ring = polygonFeature.geometry.coordinates[0];
      const centroidLng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      const centroidLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      const region = await detectRegionFromCoords(centroidLat, centroidLng);

      let frontage: FrontageInfo | null = null;
      const origin = computeOrigin(polygonFeature);
      if (origin) {
        try {
          const roads = await fetchNearbyRoads(polygonFeature);
          const ringLocal = ring.slice(0, -1).map((p) => toLocalXY(p as [number, number], origin));
          frontage = detectFrontage(ringLocal, roads, origin);
        } catch (err) {
          console.warn('Nearby road lookup failed, generating a geometry-only layout:', err);
        }
      }

      const output = generateSiteLayoutCandidates(polygonFeature, assumptions.context, region, assumptions.buildSpec, frontage);
      setLayoutOutput(output);

      if (output.winner) {
        renderLayoutOnMap(output.winner);
        if (onLayoutGenerated) onLayoutGenerated(output.winner);
        const units = output.winner.summary.totalUnits;
        if (!frontage) {
          toast.warning(`Smart layout generated — no verified road frontage found nearby, so orientation is geometry-only: ${units} units (${region} pricing).`);
        } else if (frontage.confidence === 'approximate') {
          toast.warning(`Smart layout generated — nearest highway is ${Math.round(frontage.distanceToRoadM)}m away (unverified frontage): ${units} units (${region} pricing).`);
        } else {
          toast.success(`Smart layout generated: ${units} units, ${output.winner.label} (${region} pricing) — access from ${frontage.roadName ?? 'adjacent highway'}.`);
        }
      } else {
        layoutLayerGroup.current?.clearLayers();
        if (onLayoutGenerated) onLayoutGenerated(null);
        toast.error(output.warning || 'Could not generate a layout for this boundary');
      }
    } finally {
      setIsGeneratingLayout(false);
    }
  };

  const handleUseLayout = (layout: LayoutResult) => {
    if (!onGenerateRows) return;

    const rows = Object.entries(layout.summary.mixCounts).map(([type, units], idx) => {
      const economics = getUnitEconomics(type, layout.region, (layout.buildSpec as BuildSpec) || 'medium');
      return {
        id: `layout-${Date.now()}-${idx}`,
        type,
        units,
        giaPerUnit: economics.gia,
        salesValue: economics.salesValue,
        unitPriceOverride: 0,
        buildPerSqm: economics.gia > 0 ? economics.buildCost / economics.gia : 0,
        notes: `From smart layout • ${layout.label}`,
      };
    });

    onGenerateRows(rows, {
      source: `Smart layout generator (rule-based) • ${layout.region || 'national'} pricing`,
      region: layout.region || '',
      baseBand: layout.label,
      generatedAt: new Date().toISOString(),
    });

    toast.success('Layout applied to unit mix — head to the GDV Calculator to review');
  };

  // Coarse fallback only — used when the postcodes.io reverse-geocode lookup
  // fails (offline, rate-limited). It cannot distinguish Wales/Scotland from
  // neighbouring English regions, so the API lookup below is always tried first.
  const detectRegionFromCoordsFallback = (lat: number, lon: number): string => {
    if (lat > 53.5 && lon < -3) return "North West";
    if (lat > 53.5 && lon >= -3 && lon < -1) return "Yorkshire & Humber";
    if (lat > 53.5 && lon >= -1) return "North East";
    if (lat > 52 && lat <= 53.5 && lon < -2) return "West Midlands";
    if (lat > 52 && lat <= 53.5 && lon >= -2) return "East Midlands";
    if (lat > 51.5 && lat <= 52 && lon < -1) return "South West";
    if (lat > 51.5 && lat <= 52 && lon >= -1) return "East";
    if (lat > 51 && lat <= 51.5) return "London";
    if (lat <= 51 && lon < -2) return "South West";
    if (lat <= 51 && lon >= -2) return "South East";
    return "South East"; // default
  };

  // Maps postcodes.io's `region` (England only) and `country` (Wales/Scotland/NI,
  // where `region` is null) onto our REGION_PRESETS keys, so build/sales £/m²
  // rates are keyed to the site's actual UK region rather than a lat/lon guess.
  const POSTCODES_IO_REGION_MAP: Record<string, string> = {
    "London": "London",
    "South East": "South East",
    "South West": "South West",
    "East of England": "East",
    "East Midlands": "East Midlands",
    "West Midlands": "West Midlands",
    "North West": "North West",
    "North East": "North East",
    "Yorkshire and The Humber": "Yorkshire & Humber",
  };

  const POSTCODES_IO_COUNTRY_MAP: Record<string, string> = {
    "Wales": "Wales",
    "Scotland": "Scotland",
  };

  const detectRegionFromCoords = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes?lon=${lon}&lat=${lat}&limit=1`);
      const data = await response.json();
      const result = data?.result?.[0];
      if (result) {
        if (result.region && POSTCODES_IO_REGION_MAP[result.region]) {
          return POSTCODES_IO_REGION_MAP[result.region];
        }
        if (result.country && POSTCODES_IO_COUNTRY_MAP[result.country]) {
          return POSTCODES_IO_COUNTRY_MAP[result.country];
        }
      }
    } catch (error) {
      console.warn('Region reverse-geocode failed, falling back to coordinate heuristic:', error);
    }
    return detectRegionFromCoordsFallback(lat, lon);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a UK postcode or address');
      return;
    }

    try {
      // Using Nominatim API for geocoding (OpenStreetMap's geocoding service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=gb&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        
        map.current?.flyTo([latitude, longitude], 17);
        toast.success('Location found');
        
        // Detect region and notify parent
        const region = await detectRegionFromCoords(latitude, longitude);
        if (onLocationDetected) {
          onLocationDetected(display_name, region);
        }
      } else {
        toast.error('Location not found');
      }
    } catch (error) {
      toast.error('Failed to search location');
    }
  };

  const handleUseForGDV = async () => {
    if (currentArea > 0) {
      // Extract and save polygon
      extractAndNotifyPolygon();
      // Calculate density and compactness
      const grossAreaM2 = currentArea;
      const grossAreaHa = grossAreaM2 / 10000;
      const netDevelopableHa = grossAreaHa * (assumptions.netDevelopable / 100);
      
      // Calculate approx units
      const netDevelopableM2 = grossAreaM2 * (assumptions.netDevelopable / 100);
      const netBuildableM2 = netDevelopableM2 * (1 - assumptions.infrastructure / 100);
      const avgPlotArea = MIX_PLOT_AREA[assumptions.mixType];
      const approxUnits = Math.round(netBuildableM2 / avgPlotArea);
      
      // Calculate implied density (units per net developable hectare)
      const impliedDensity = netDevelopableHa > 0 ? approxUnits / netDevelopableHa : 0;
      
      // Calculate compactness: 4πA/P²
      const compactness = currentPerimeter > 0 ? (4 * Math.PI * grossAreaM2) / (currentPerimeter * currentPerimeter) : 0;
      const isCompact = compactness >= 0.65;
      const isIrregular = !isCompact;
      
      // Try to detect local authority and get region
      let localAuthority: string | null = null;
      let detectedRegion = "South East"; // default
      
      // Get centroid for location detection
      if (drawnItems.current) {
        const layers = drawnItems.current.getLayers();
        if (layers.length > 0) {
          const layer = layers[0] as L.Polygon;
          const bounds = layer.getBounds();
          const center = bounds.getCenter();
          detectedRegion = await detectRegionFromCoords(center.lat, center.lng);
          
          // Try to detect LA from search query if available
          if (searchQuery) {
            try {
              localAuthority = await detectLocalAuthority(searchQuery);
            } catch (error) {
              console.warn("Failed to detect LA:", error);
            }
          }
        }
      }
      
      // Get LA housing data (with fallback to regional/national)
      const laData = getLAHousingData(localAuthority || undefined, detectedRegion);
      
      // Determine base mix band based on density
      let mixName = "";
      let baseMixConfig: Array<{ type: string; percent: number; gia: number }> = [];
      
      if (impliedDensity < 28) {
        // 20-28 u/ha: Family Suburban
        mixName = "Family Suburban";
        baseMixConfig = [
          { type: "3-Bed Semi", percent: isIrregular ? 60 : 50, gia: 90 },
          { type: "4-Bed Detached", percent: isIrregular ? 20 : 30, gia: 120 },
          { type: "2-Bed Semi", percent: 20, gia: 75 },
        ];
      } else if (impliedDensity < 36) {
        // 28-36 u/ha: Balanced Mixed (default suburban)
        mixName = "Balanced Mixed";
        baseMixConfig = [
          { type: "3-Bed Semi", percent: 50, gia: 90 },
          { type: "2-Bed Semi", percent: 30, gia: 75 },
          { type: "4-Bed Detached", percent: 20, gia: 120 },
        ];
      } else if (impliedDensity < 45) {
        // 36-45 u/ha: Compact Mixed
        mixName = "Compact Mixed";
        baseMixConfig = [
          { type: "2-Bed Semi", percent: isCompact ? 30 : 40, gia: 75 },
          { type: "3-Bed Semi", percent: isCompact ? 50 : 40, gia: 90 },
          { type: "3-Bed Detached", percent: 20, gia: 105 },
        ];
      } else {
        // >45 u/ha: Urban Edge
        mixName = "Urban Edge";
        baseMixConfig = [
          { type: "2-Bed Semi", percent: 60, gia: 75 },
          { type: "3-Bed Semi", percent: 20, gia: 85 },
          { type: "3-Bed Detached", percent: 20, gia: 105 },
        ];
      }
      
      // Adjust mix based on LA data
      const adjustedMix = calculateAdjustedMix(baseMixConfig, laData, approxUnits);
      
      // Create scenario name with LA context
      const scenarioName = localAuthority 
        ? `Suggested mix • ${mixName} • ${localAuthority}`
        : `Suggested mix • ${mixName} • ${detectedRegion}`;
      
      // Calculate units per type and create rows
      const generatedRows = adjustedMix.map((config, idx) => {
        const defaults: Record<string, { salesValue: number; buildPerSqm: number }> = {
          "2-Bed Semi": { salesValue: 247500, buildPerSqm: 1650 },
          "3-Bed Semi": { salesValue: 292500, buildPerSqm: 1650 },
          "3-Bed Detached": { salesValue: 369000, buildPerSqm: 1750 },
          "4-Bed Detached": { salesValue: 432000, buildPerSqm: 1800 },
          "2-Bed Bungalow": { salesValue: 228000, buildPerSqm: 1650 },
          "3-Bed Bungalow": { salesValue: 291000, buildPerSqm: 1700 },
        };
        const typeDefaults = defaults[config.type] || { salesValue: 0, buildPerSqm: 1650 };
        
        return {
          id: `mix-${Date.now()}-${idx}`,
          type: config.type,
          units: config.units,
          giaPerUnit: config.gia,
          salesValue: typeDefaults.salesValue,
          unitPriceOverride: 0,
          buildPerSqm: typeDefaults.buildPerSqm,
          notes: config.adjustedFrom === "LA data" ? `${laData.dataSource}` : "",
        };
      });
      
      onAreaUpdate(Math.round(currentArea));
      if (onGenerateRows) {
        const metadata = {
          source: laData.dataSource,
          localAuthority: localAuthority || undefined,
          region: detectedRegion,
          baseBand: mixName,
          generatedAt: new Date().toISOString(),
        };
        onGenerateRows(generatedRows, metadata);
      }
      
      // Detect region from polygon centroid if location detection callback provided
      if (onLocationDetected) {
        const locationName = localAuthority || searchQuery || 'Site location';
        onLocationDetected(locationName, detectedRegion);
      }
      
      // Show success message with LA context
      const sourceInfo = localAuthority 
        ? `Mix adjusted from ${mixName} based on ${laData.dataSource}`
        : `Using ${mixName} with regional defaults`;
      
      toast.success("Unit mix generated from map", {
        description: sourceInfo,
        duration: 6000,
      });
      
      // Capture map snapshot if callback provided
      if (onMapSnapshot && map.current) {
        try {
          // Use leaflet-image or simple canvas approach
          const mapElement = map.current.getContainer();
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (ctx && mapElement) {
            canvas.width = mapElement.offsetWidth;
            canvas.height = mapElement.offsetHeight;
            
            // Simple approach: convert to data URL (limitations: won't capture tiles perfectly)
            // For production, consider using leaflet-image or html2canvas library
            const mapRect = mapElement.getBoundingClientRect();
            
            // Store the current map view as a static image URL
            // This is a placeholder - in production you'd use a proper screenshot library
            onMapSnapshot(mapElement.style.backgroundImage || '');
          }
        } catch (err) {
          console.warn('Failed to capture map snapshot:', err);
        }
      }
      
      const densityRounded = Math.round(impliedDensity);
      toast.success(
        `Recommended mix applied: ${mixName}, ${approxUnits} units @ ${densityRounded} u/ha (ND ${assumptions.netDevelopable}%, Infra ${assumptions.infrastructure}%). Edit any row to refine.`
      );
      
      // Keep map visible - don't collapse
      // setIsOpen(false);
      
      // Scroll to calculator
      setTimeout(() => {
        document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      toast.error('Please draw a boundary first');
    }
  };

  const handleClear = () => {
    drawnItems.current?.clearLayers();
    setCurrentArea(0);
    setCurrentPerimeter(0);
    clearGeneratedLayout();

    // Notify parent that polygon was cleared
    if (onPolygonUpdate) {
      onPolygonUpdate(null);
    }
  };

  const handleRetry = () => {
    setMapError(false);
    window.location.reload();
  };

  const formatArea = (m2: number) => {
    const hectares = m2 / 10000;
    return `${m2.toLocaleString()} m² (${hectares.toFixed(2)} ha)`;
  };

  const calculateUnits = () => {
    if (currentArea === 0) return null;

    const grossAreaM2 = currentArea;
    const grossAreaHa = grossAreaM2 / 10000;
    
    // Net-Developable
    const netDevelopableM2 = grossAreaM2 * (assumptions.netDevelopable / 100);
    const netDevelopableHa = netDevelopableM2 / 10000;
    
    // Net-Buildable
    const netBuildableM2 = netDevelopableM2 * (1 - assumptions.infrastructure / 100);
    
    // Plot-area method (primary)
    const plotArea = MIX_PLOT_AREA[assumptions.mixType];
    const unitsPlot = Math.round(netBuildableM2 / plotArea);
    
    // Density cross-check (secondary)
    const densityBand = CONTEXT_DENSITY[assumptions.context];
    const unitsLow = Math.round(netDevelopableHa * densityBand.low);
    const unitsHigh = Math.round(netDevelopableHa * densityBand.high);
    
    return {
      unitsPlot,
      unitsLow,
      unitsHigh,
      mixLabel: MIX_LABELS[assumptions.mixType],
      parking: Math.round(unitsPlot * 2.2),
      roadLength: Math.round(unitsPlot * 20),
    };
  };

  const unitEstimate = calculateUnits();

  if (mapError) {
    return (
      <Card className="w-full">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Map temporarily unavailable</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Unable to load map tiles. Your GDV calculator remains fully functional.
              </p>
              <Button onClick={handleRetry} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Site Map & Area
                </CardTitle>
                <CardDescription>
                  {currentArea > 0 ? (
                    <Badge variant="secondary" className="mt-2">
                      Boundary: {formatArea(currentArea)} — Click to Edit
                    </Badge>
                  ) : (
                    'Search and draw your site boundary'
                  )}
                </CardDescription>
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Search bar */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter UK postcode or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* Basemap Switcher */}
            <Tabs value={basemap} onValueChange={(v) => setBasemap(v as BasemapType)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="standard" className="gap-2">
                  <MapIcon className="h-4 w-4" />
                  Standard
                </TabsTrigger>
                <TabsTrigger value="satellite" className="gap-2">
                  <Satellite className="h-4 w-4" />
                  Satellite
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Opacity Slider */}
            {currentArea > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Boundary Opacity: {Math.round(fillOpacity * 100)}%
                </Label>
                <Slider
                  value={[fillOpacity]}
                  onValueChange={([value]) => setFillOpacity(value)}
                  min={0}
                  max={0.6}
                  step={0.05}
                  className="w-full"
                />
              </div>
            )}

            {/* Map container */}
            <div ref={mapContainer} className="w-full h-[500px] rounded-lg border overflow-hidden" />

            {/* Attribution */}
            <p className="text-xs text-muted-foreground text-center">
              {basemap === 'satellite' 
                ? '© Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                : 'Map data © OpenStreetMap contributors'}
            </p>

            {/* Area info */}
            {currentArea > 0 && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Area:</span>
                  <span className="text-sm font-bold">{formatArea(currentArea)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Perimeter:</span>
                  <span className="text-sm font-bold">{currentPerimeter.toLocaleString()} m</span>
                </div>
                
                {unitEstimate && (
                  <>
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-medium">Approx Units:</span>
                        <div className="text-right">
                          <div className="text-sm font-bold">
                            {unitEstimate.unitsPlot} ({unitEstimate.mixLabel}) · {unitEstimate.unitsLow}–{unitEstimate.unitsHigh} (density)
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">
                          Assumes ND {assumptions.netDevelopable}%, Infra {assumptions.infrastructure}%
                        </p>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Settings className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Unit Estimator Assumptions</DialogTitle>
                              <DialogDescription>
                                Adjust the assumptions to refine the unit count estimate
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                  Net-Developable %: {assumptions.netDevelopable}%
                                </Label>
                                <Slider
                                  value={[assumptions.netDevelopable]}
                                  onValueChange={([value]) => setAssumptions({ ...assumptions, netDevelopable: value })}
                                  min={50}
                                  max={85}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                  Infrastructure %: {assumptions.infrastructure}%
                                </Label>
                                <Slider
                                  value={[assumptions.infrastructure]}
                                  onValueChange={([value]) => setAssumptions({ ...assumptions, infrastructure: value })}
                                  min={15}
                                  max={35}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Context Preset</Label>
                                <Select 
                                  value={assumptions.context} 
                                  onValueChange={(value: ContextPreset) => setAssumptions({ ...assumptions, context: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="rural">Rural edge (22–30 u/ha)</SelectItem>
                                    <SelectItem value="suburban">Suburban (30–35 u/ha)</SelectItem>
                                    <SelectItem value="urban">Urban edge (35–60 u/ha)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Mix Type</Label>
                                <Select 
                                  value={assumptions.mixType} 
                                  onValueChange={(value: MixType) => setAssumptions({ ...assumptions, mixType: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="semis">Semis (220 m²)</SelectItem>
                                    <SelectItem value="mixed">Mixed (230 m²)</SelectItem>
                                    <SelectItem value="terrace">Terrace-led (150 m²)</SelectItem>
                                    <SelectItem value="bungalow">Bungalow-heavy (260 m²)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Build Spec (Smart Layout)</Label>
                                <Select
                                  value={assumptions.buildSpec}
                                  onValueChange={(value: BuildSpec) => setAssumptions({ ...assumptions, buildSpec: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low (Volume)</SelectItem>
                                    <SelectItem value="medium">Medium (Standard)</SelectItem>
                                    <SelectItem value="high">High (Premium)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="pt-4 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
                                <div className="flex justify-between">
                                  <span>Parking (rough):</span>
                                  <span>{unitEstimate.parking} spaces</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Internal roads (rough):</span>
                                  <span>{unitEstimate.roadLength} m</span>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={handleUseForGDV} 
                      className="flex-1"
                      disabled={currentArea === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Send to GDV
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="font-semibold mb-1">Smart Mix Generation</p>
                    <p className="text-xs">
                      Generates unit mix adjusted using local authority new-build completion data 
                      when available, reducing duplicates and improving realism.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleGenerateLayout}
                      variant="secondary"
                      className="flex-1"
                      disabled={currentArea === 0 || isGeneratingLayout}
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      {isGeneratingLayout ? 'Generating…' : 'Generate Smart Layout'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="font-semibold mb-1">Smart Layout Generator</p>
                    <p className="text-xs">
                      Places an access road plus rows of house plots (each with a compliant rear garden) inside
                      your boundary, compares mix/orientation options against planning rules, and picks the
                      highest-profit compliant layout.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                onClick={handleClear}
                variant="outline"
                disabled={currentArea === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>

            {layoutOutput && (
              <LayoutSummaryPanel output={layoutOutput} onUseLayout={handleUseLayout} />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default SiteMap;
