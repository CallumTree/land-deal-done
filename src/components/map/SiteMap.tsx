import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { point } from '@turf/helpers';
import { area as turfArea } from '@turf/area';
import distance from '@turf/distance';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, MapPin, ChevronDown, ChevronUp, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SiteMapProps {
  onAreaUpdate: (areaM2: number) => void;
  savedArea?: number;
  mapboxToken: string;
}

const SiteMap = ({ onAreaUpdate, savedArea, mapboxToken }: SiteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(!savedArea);
  const [currentArea, setCurrentArea] = useState<number>(savedArea || 0);
  const [currentPerimeter, setCurrentPerimeter] = useState<number>(0);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-0.1278, 51.5074], // Default to London
      zoom: 15,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Initialize draw tool
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'simple_select',
      styles: [
        // Polygon fill
        {
          'id': 'gl-draw-polygon-fill',
          'type': 'fill',
          'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          'paint': {
            'fill-color': 'hsl(220, 70%, 35%)',
            'fill-opacity': 0.3,
          }
        },
        // Polygon outline
        {
          'id': 'gl-draw-polygon-stroke-active',
          'type': 'line',
          'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          'paint': {
            'line-color': 'hsl(220, 70%, 35%)',
            'line-width': 3,
          }
        },
        // Vertex points
        {
          'id': 'gl-draw-polygon-and-line-vertex-active',
          'type': 'circle',
          'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
          'paint': {
            'circle-radius': 6,
            'circle-color': 'hsl(220, 70%, 35%)',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          }
        }
      ]
    });

    map.current.addControl(draw.current);

    // Handle draw events
    const updateArea = () => {
      const data = draw.current?.getAll();
      if (data && data.features.length > 0) {
        const polygon = data.features[0];
        const areaInM2 = turfArea(polygon);
        const perimeterInM = calculatePerimeter(polygon);
        
        setCurrentArea(areaInM2);
        setCurrentPerimeter(perimeterInM);
      } else {
        setCurrentArea(0);
        setCurrentPerimeter(0);
      }
    };

    map.current.on('draw.create', updateArea);
    map.current.on('draw.update', updateArea);
    map.current.on('draw.delete', updateArea);

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  const calculatePerimeter = (polygon: any): number => {
    if (!polygon.geometry || !polygon.geometry.coordinates || !polygon.geometry.coordinates[0]) {
      return 0;
    }
    
    const coords = polygon.geometry.coordinates[0];
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
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?country=GB&access_token=${mapboxToken}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        map.current?.flyTo({ center: [lng, lat], zoom: 17 });
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
    draw.current?.deleteAll();
    setCurrentArea(0);
    setCurrentPerimeter(0);
  };

  const formatArea = (m2: number) => {
    const hectares = m2 / 10000;
    return `${m2.toLocaleString()} m² (${hectares.toFixed(2)} ha)`;
  };

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

            {/* Map container */}
            <div ref={mapContainer} className="w-full h-[500px] rounded-lg border overflow-hidden" />

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
