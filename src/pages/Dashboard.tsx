import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import NapkinCalculator from "@/components/NapkinCalculator";
import SiteMap from "@/components/map/SiteMap";
import { Calculator, DollarSign, TrendingUp, Settings, LogOut } from "lucide-react";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [siteArea, setSiteArea] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
    });

    loadMapboxToken();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadMapboxToken = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "mapbox_token")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading mapbox token:", error);
      } else if (data?.setting_value) {
        setMapboxToken(data.setting_value);
      }
    } catch (error) {
      console.error("Error loading mapbox token:", error);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to log out");
    } else {
      toast.success("Logged out successfully");
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold">
              BuildFlow <span className="text-primary">Feasibility Dashboard</span>
            </h1>
            
            <nav className="hidden md:flex items-center gap-6">
              <a href="#calculator" className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                <Calculator className="h-4 w-4" />
                GDV Calculator
              </a>
              <a href="#cost-estimator" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <DollarSign className="h-4 w-4" />
                Build Cost Estimator
              </a>
              <a href="#roi" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <TrendingUp className="h-4 w-4" />
                ROI Visualiser
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/settings")}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </nav>

            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Site Map */}
        {mapboxToken ? (
          <SiteMap 
            onAreaUpdate={setSiteArea} 
            savedArea={siteArea}
            mapboxToken={mapboxToken}
          />
        ) : (
          <div className="bg-muted/30 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              Map unavailable. Please contact the owner to add a Mapbox token in Settings.
            </p>
          </div>
        )}
        
        <NapkinCalculator siteArea={siteArea} />
        
        {/* Placeholder sections for future features */}
        <div className="mt-16 space-y-16">
          <section id="cost-estimator" className="scroll-mt-20">
            <div className="text-center py-16 px-4 bg-muted/30 rounded-lg">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-2xl font-bold mb-2">Build Cost Estimator</h3>
              <p className="text-muted-foreground">Coming soon</p>
            </div>
          </section>

          <section id="roi" className="scroll-mt-20">
            <div className="text-center py-16 px-4 bg-muted/30 rounded-lg">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-2xl font-bold mb-2">ROI Visualiser</h3>
              <p className="text-muted-foreground">Coming soon</p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
};

export default Dashboard;
