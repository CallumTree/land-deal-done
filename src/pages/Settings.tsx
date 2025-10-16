import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Satellite } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Settings = () => {
  const navigate = useNavigate();
  const [mapboxToken, setMapboxToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadMapboxToken();
  }, []);

  const loadMapboxToken = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'mapbox_satellite_token')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setMapboxToken(data.setting_value || '');
      }
    } catch (error) {
      console.error('Error loading Mapbox token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'mapbox_satellite_token',
          setting_value: mapboxToken.trim(),
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;
      toast.success('Mapbox satellite token saved successfully');
    } catch (error) {
      console.error('Error saving token:', error);
      toast.error('Failed to save token');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure app-wide integrations and preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Satellite className="h-5 w-5 text-primary" />
              Map Provider
            </CardTitle>
            <CardDescription>
              Configure satellite imagery for the Site Map & Area feature
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                value="Mapbox"
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Currently using Mapbox for satellite imagery
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mapbox-token">
                Mapbox Satellite Public Token (pk...)
              </Label>
              <Input
                id="mapbox-token"
                type="password"
                placeholder="pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGt..."
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                When configured, all users can toggle between Standard and Satellite views.
                Get your token at{' '}
                <a
                  href="https://account.mapbox.com/access-tokens/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  mapbox.com/access-tokens
                </a>
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
