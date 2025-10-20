import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import NapkinCalculator from "@/components/NapkinCalculator";
import SiteMap from "@/components/map/SiteMap";
import LenderExport from "@/components/calculator/LenderExport";
import { LocationPresets } from "@/components/calculator/LocationPresets";
import { Calculator, FileText, TrendingUp, MapPin } from "lucide-react";
import { PropertyRow, GlobalInputs } from "@/types/calculator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GlobalHeader from "@/components/GlobalHeader";
import { projectStorage } from "@/services/projectStorage";
import { Project } from "@/types/project";
import { calculateTotals } from "@/utils/calculatorHelpers";
import { Button } from "@/components/ui/button";

const ProjectWorkspace = () => {
  const { id } = useParams();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [siteArea, setSiteArea] = useState<number>(0);
  const [generatedRows, setGeneratedRows] = useState<PropertyRow[] | undefined>();
  const [mapImageUrl, setMapImageUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState("site-map");
  const [showLocationPresets, setShowLocationPresets] = useState(false);
  const navigate = useNavigate();

  // Read tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Sync calculator data with project when switching to lender-export tab
  useEffect(() => {
    if (activeTab === "lender-export" && id) {
      // Load latest calculator data from localStorage
      try {
        const calculatorData = localStorage.getItem("napkin-calculator-data");
        if (calculatorData) {
          const { rows, inputs } = JSON.parse(calculatorData);
          
          // Update the project with latest data
          const project = projectStorage.getProject(id);
          if (project && rows && inputs) {
            const updatedProject = {
              ...project,
              rows,
              inputs,
              lastUpdated: new Date().toISOString(),
            };
            projectStorage.saveProject(updatedProject);
            setCurrentProject(updatedProject);
          }
        }
      } catch (error) {
        console.error("Failed to sync calculator data:", error);
      }
    }
  }, [activeTab, id]);

  const handleApplyPreset = (
    updatedRows: PropertyRow[], 
    updatedInputs: GlobalInputs, 
    presetInfo: { region: string; spec: "low" | "medium" | "high"; appliedAt: string }
  ) => {
    if (!id) return;

    // Save to calculator localStorage
    localStorage.setItem("napkin-calculator-data", JSON.stringify({
      rows: updatedRows,
      inputs: updatedInputs,
    }));

    // Update project
    const project = projectStorage.getProject(id);
    if (project) {
      const calculatedValues = calculateTotals(updatedRows, updatedInputs);
      const updatedProject = {
        ...project,
        rows: updatedRows,
        inputs: updatedInputs,
        presetInfo,
        gdv: calculatedValues.totalGDV,
        profitMargin: calculatedValues.profitMarginPercent,
        units: updatedRows.reduce((sum, r) => sum + r.units, 0),
        buildCost: calculatedValues.buildCost,
        netProfit: calculatedValues.netProfit,
        roi: calculatedValues.profitMarginPercent,
        rlv: calculatedValues.residualLandValue,
        lastUpdated: new Date().toISOString(),
      };
      projectStorage.saveProject(updatedProject);
      setCurrentProject(updatedProject);
    }
  };

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
        setSiteArea(project.inputs?.siteArea || 0);
        setMapImageUrl(project.mapImageUrl || "");
        
        // Sync project data to calculator localStorage
        localStorage.setItem("napkin-calculator-data", JSON.stringify({
          rows: project.rows,
          inputs: project.inputs,
        }));
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
            <TabsTrigger value="lender-export">
              <FileText className="h-4 w-4 mr-2" />
              Lender Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="site-map">
            <div className="space-y-6">
              <SiteMap 
                onAreaUpdate={setSiteArea} 
                savedArea={siteArea}
                onGenerateRows={setGeneratedRows}
              />
              
              {currentProject && (
                <LocationPresets
                  onApply={handleApplyPreset}
                  currentRows={currentProject.rows}
                  currentInputs={currentProject.inputs}
                  projectLocation={currentProject.location}
                  detectedRegion={currentProject.presetInfo?.region}
                  collapsed={true}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="gdv-calculator">
            <NapkinCalculator 
              siteArea={siteArea} 
              initialRows={generatedRows} 
              mapImageUrl={mapImageUrl}
              presetInfo={currentProject?.presetInfo}
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

          <TabsContent value="lender-export">
            {currentProject ? (
              <LenderExport
                values={calculateTotals(currentProject.rows, currentProject.inputs)}
                inputs={currentProject.inputs}
                rows={currentProject.rows}
                siteArea={siteArea}
                mapImageUrl={mapImageUrl}
                projectName={currentProject.name}
              />
            ) : (
              <div className="text-center py-16 px-4 bg-muted/30 rounded-lg">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-2xl font-bold mb-2">No Project Data</h3>
                <p className="text-muted-foreground">Please complete the GDV Calculator first</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ProjectWorkspace;
