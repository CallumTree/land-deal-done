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
import { Search, MapPin, ChevronDown, ChevronUp, Download, Trash2, RefreshCw, Map as MapIcon, Satellite } from 'lucide-react';
import { toast } from 'sonner';

interface SiteMapProps {
  onAreaUpdate: (areaM2: number) => void;
  savedArea?: number;
}

type BasemapType = 'standard' | 'satellite';

const SiteMap = ({ onAreaUpdate, savedArea }: SiteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const drawnItems = useRef<L.FeatureGroup | null>(null);
  const drawControl = useRef<L.Control.Draw | null>(null);
  const currentTileLayer = useRef<L.TileLayer | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(!savedArea);
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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      // Initialize map
      map.current = L.map(mapContainer.current).setView([51.5074, -0.1278], 15);

      // Add initial tile layer
      addTileLayer(basemap);

      // Initialize feature group for drawn items
      drawnItems.current = new L.FeatureGroup();
      map.current.addLayer(drawnItems.current);

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
      });

      map.current.on(L.Draw.Event.EDITED, () => {
        updateArea();
      });

      map.current.on(L.Draw.Event.DELETED, () => {
        updateArea();
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

  const getPolygonOptions = () => {
    const isSatellite = basemap === 'satellite';
    return {
      color: isSatellite ? '#FFFF00' : 'hsl(220, 70%, 35%)',
      fillColor: isSatellite ? '#FFFF00' : 'hsl(220, 70%, 35%)',
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
        const { lat, lon } = data[0];
        map.current?.flyTo([parseFloat(lat), parseFloat(lon)], 17);
        toast.success('Location found');
      } else {
        toast.error('Location not found');
      }
    } catch (error) {
      toast.error('Failed to search location');
    }
  };

  const handleUseForGDV = () => {
    if (currentArea > 0) {
      onAreaUpdate(Math.round(currentArea));
      toast.success(`Site area updated: ${(currentArea / 10000).toFixed(2)} ha`);
      setIsOpen(false);
    } else {
      toast.error('Please draw a boundary first');
    }
  };

  const handleClear = () => {
    drawnItems.current?.clearLayers();
    setCurrentArea(0);
    setCurrentPerimeter(0);
  };

  const handleRetry = () => {
    setMapError(false);
    window.location.reload();
  };

  const formatArea = (m2: number) => {
    const hectares = m2 / 10000;
    return `${m2.toLocaleString()} m² (${hectares.toFixed(2)} ha)`;
  };

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
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Area:</span>
                  <span className="text-sm font-bold">{formatArea(currentArea)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Perimeter:</span>
                  <span className="text-sm font-bold">{currentPerimeter.toLocaleString()} m</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={handleUseForGDV} 
                className="flex-1"
                disabled={currentArea === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Use for GDV
              </Button>
              <Button 
                onClick={handleClear} 
                variant="outline"
                disabled={currentArea === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default SiteMap;
