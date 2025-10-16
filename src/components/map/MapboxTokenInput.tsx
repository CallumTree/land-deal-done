import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Key, ExternalLink } from 'lucide-react';

interface MapboxTokenInputProps {
  onTokenSubmit: (token: string) => void;
}

const MapboxTokenInput = ({ onTokenSubmit }: MapboxTokenInputProps) => {
  const [token, setToken] = useState('');
  const [savedToken, setSavedToken] = useState<string | null>(null);

  useEffect(() => {
    // Check if token is already saved in localStorage
    const stored = localStorage.getItem('mapbox_token');
    if (stored) {
      setSavedToken(stored);
      onTokenSubmit(stored);
    }
  }, [onTokenSubmit]);

  const handleSubmit = () => {
    if (token.trim()) {
      localStorage.setItem('mapbox_token', token.trim());
      setSavedToken(token.trim());
      onTokenSubmit(token.trim());
    }
  };

  const handleClear = () => {
    localStorage.removeItem('mapbox_token');
    setSavedToken(null);
    setToken('');
  };

  if (savedToken) {
    return (
      <Alert>
        <Key className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Mapbox token configured</span>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-5 w-5" />
          Mapbox Access Token Required
        </CardTitle>
        <CardDescription>
          To use the map feature, please enter your Mapbox public token.
          <a
            href="https://account.mapbox.com/access-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
          >
            Get your token here
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="pk.eyJ1..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="flex-1"
          />
          <Button onClick={handleSubmit} disabled={!token.trim()}>
            Save Token
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Your token will be stored locally in your browser for this project only.
        </p>
      </CardContent>
    </Card>
  );
};

export default MapboxTokenInput;
