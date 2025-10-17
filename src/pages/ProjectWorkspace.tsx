import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import NapkinCalculator from "@/components/NapkinCalculator";
import SiteMap from "@/components/map/SiteMap";
import { Calculator, DollarSign, TrendingUp } from "lucide-react";
import { PropertyRow } from "@/types/calculator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GlobalHeader from "@/components/GlobalHeader";
import { projectStorage } from "@/services/projectStorage";
import { Project } from "@/types/project";

const ProjectWorkspace = () => {
  const { id } = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [siteArea, setSiteArea] = useState<number>(0);
  const [generatedRows, setGeneratedRows] = useState<PropertyRow[] | undefined>();
  const [mapImageUrl, setMapImageUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState("site-map");
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

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    // Load project data
    if (id) {
      const project = projectStorage.getProject(id);
      if (project) {
        setCurrentProject(project);
      } else {
        toast.error("Project not found—showing dashboard");
        navigate("/dashboard");
      }
    }
  }, [id, navigate]);


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
      <GlobalHeader 
        currentProject={currentProject || undefined}
        currentSection={activeTab}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="site-map">
              <Calculator className="h-4 w-4 mr-2" />
              Site Map
            </TabsTrigger>
            <TabsTrigger value="gdv-calculator">
              <Calculator className="h-4 w-4 mr-2" />
              GDV Calculator
            </TabsTrigger>
            <TabsTrigger value="roi-visualiser">
              <TrendingUp className="h-4 w-4 mr-2" />
              ROI Visualiser
            </TabsTrigger>
            <TabsTrigger value="build-cost">
              <DollarSign className="h-4 w-4 mr-2" />
              Build Cost
            </TabsTrigger>
          </TabsList>

          <TabsContent value="site-map">
            <SiteMap 
              onAreaUpdate={setSiteArea} 
              savedArea={siteArea}
              onGenerateRows={setGeneratedRows}
            />
          </TabsContent>

          <TabsContent value="gdv-calculator">
            <NapkinCalculator 
              siteArea={siteArea} 
              initialRows={generatedRows} 
              mapImageUrl={mapImageUrl} 
            />
          </TabsContent>

          <TabsContent value="roi-visualiser">
            <NapkinCalculator 
              siteArea={siteArea} 
              initialRows={generatedRows} 
              mapImageUrl={mapImageUrl}
              showROIVisualiser
            />
          </TabsContent>

          <TabsContent value="build-cost">
            <div className="text-center py-16 px-4 bg-muted/30 rounded-lg">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-2xl font-bold mb-2">Build Cost Estimator</h3>
              <p className="text-muted-foreground">Coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ProjectWorkspace;
