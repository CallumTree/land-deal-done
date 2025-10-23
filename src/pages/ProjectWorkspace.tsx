import { useEffect, useState, useCallback } from "react";
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
import { useAutoSave } from "@/hooks/useAutoSave";
import { RestoreBanner } from "@/components/RestoreBanner";
import QSChatBubble from "@/components/QSChatBubble";
import QSChatPanel from "@/components/QSChatPanel";

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
  const [detectedLocation, setDetectedLocation] = useState<string>("");
  const [detectedRegion, setDetectedRegion] = useState<string>("");
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [savedProject, setSavedProject] = useState<Project | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [savedPolygon, setSavedPolygon] = useState<any>(null);
  const navigate = useNavigate();

  // Auto-save hook
  const { saveProject, saveNow, saveStatus, lastSaveTime } = useAutoSave({
    projectId: id || "",
    onSave: (timestamp) => {
      console.log(`Project auto-saved at ${timestamp}`);
    },
  });

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
        buildCost: calculatedValues.baseBuildCost,
        netProfit: calculatedValues.netProfit,
        roi: calculatedValues.profitMarginPercent,
        rlv: calculatedValues.residualLandValue,
        lastUpdated: new Date().toISOString(),
      };
      projectStorage.saveProject(updatedProject);
      setCurrentProject(updatedProject);
    }
  };

  const handleLocationDetected = (location: string, region: string) => {
    setDetectedLocation(location);
    setDetectedRegion(region);
    toast.success(`Detected region: ${region}`);
  };

  const handlePolygonUpdate = useCallback((polygon: any) => {
    if (!id) return;
    
    // Update saved polygon state
    setSavedPolygon(polygon);
    
    // Update project with polygon data
    const project = projectStorage.getProject(id);
    if (project) {
      const updatedProject = {
        ...project,
        polygon,
        lastUpdated: new Date().toISOString(),
      };
      projectStorage.saveProject(updatedProject);
      setCurrentProject(updatedProject);
    }
  }, [id]);

  // Sync calculator changes to project with recalculated metrics
  useEffect(() => {
    if (!id) return;

    const syncCalculatorData = () => {
      try {
        const calculatorData = localStorage.getItem("napkin-calculator-data");
        if (!calculatorData) return;

        const { rows, inputs } = JSON.parse(calculatorData);

        // Get fresh project data to avoid stale closure
        setCurrentProject((prev) => {
          if (!prev) return prev;

          // Recalculate all metrics from fresh data
          const calculatedValues = calculateTotals(rows || [], inputs || prev.inputs);
          const totalUnits = (rows || []).reduce((sum: number, r: PropertyRow) => sum + r.units, 0);
          const siteAreaHa = inputs?.siteArea || prev.inputs.siteArea || 0;
          const density = siteAreaHa > 0 ? totalUnits / siteAreaHa : 0;

          // Create updated project with fresh calculations
          const updatedProject: Project = {
            ...prev,
            rows: rows || prev.rows,
            inputs: inputs || prev.inputs,
            gdv: calculatedValues.totalGDV,
            profitMargin: calculatedValues.profitMarginPercent,
            units: totalUnits,
            density: density,
            buildCost: calculatedValues.baseBuildCost,
            landCost: calculatedValues.landCost,
            netProfit: calculatedValues.netProfit,
            roi: calculatedValues.profitMarginPercent,
            rlv: calculatedValues.residualLandValue,
            lastUpdated: new Date().toISOString(),
          };

          // Save the updated project
          saveProject(updatedProject);

          return updatedProject;
        });
      } catch (error) {
        console.error("Failed to sync calculator data:", error);
      }
    };

    // Set up interval to continuously sync
    const intervalId = setInterval(syncCalculatorData, 3000);

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [id]);

  // Manual controls
  const handleSaveNow = useCallback(() => {
    if (currentProject) {
      saveNow(currentProject);
    }
  }, [currentProject, saveNow]);

  const handleLoadLastSave = useCallback(() => {
    if (!id) return;
    
    const savedKey = `buildflow_project_${id}`;
    const savedData = localStorage.getItem(savedKey);
    
    if (savedData) {
      try {
        const saved = JSON.parse(savedData) as Project;
        loadSavedProject(saved);
      } catch (error) {
        toast.error("Failed to load last save");
      }
    } else {
      toast.error("No saved version found");
    }
  }, [id]);

  const handleResetProject = useCallback(() => {
    if (!id) return;
    
    // Clear saved data
    localStorage.removeItem(`buildflow_project_${id}`);
    localStorage.removeItem(`buildflow_project_${id}_backup`);
    
    // Remove from index
    try {
      const indexKey = "buildflow_projects_index";
      const stored = localStorage.getItem(indexKey);
      if (stored) {
        const index = JSON.parse(stored);
        const filtered = index.filter((p: any) => p.id !== id);
        localStorage.setItem(indexKey, JSON.stringify(filtered));
      }
    } catch (error) {
      console.error("Failed to update index:", error);
    }
    
    toast.success("Project reset");
    navigate("/dashboard");
  }, [id, navigate]);

  const handleDuplicateProject = useCallback(() => {
    if (!currentProject) return;
    
    const duplicate = projectStorage.duplicateProject(currentProject.id);
    if (duplicate) {
      toast.success("Project duplicated");
      navigate(`/project/${duplicate.id}`);
    }
  }, [currentProject, navigate]);

  const handleRestore = useCallback(() => {
    if (savedProject) {
      loadSavedProject(savedProject);
      setShowRestoreBanner(false);
    }
  }, [savedProject]);

  const handleRestoreBackup = useCallback(() => {
    if (!id) return;
    
    const backupKey = `buildflow_project_${id}_backup`;
    const backupData = localStorage.getItem(backupKey);
    
    if (backupData) {
      try {
        const backup = JSON.parse(backupData) as Project;
        loadSavedProject(backup);
        setShowRestoreBanner(false);
        toast.success("Backup restored");
      } catch (error) {
        toast.error("Failed to restore backup");
      }
    }
  }, [id]);

  const handleAutoRestoreChange = useCallback((enabled: boolean) => {
    if (!id) return;
    
    const autoRestoreKey = `buildflow_autorestore_${id}`;
    if (enabled) {
      localStorage.setItem(autoRestoreKey, "true");
    } else {
      localStorage.removeItem(autoRestoreKey);
    }
  }, [id]);

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
    // Load project data and check for saved version
    if (id) {
      const project = projectStorage.getProject(id);
      if (project) {
        setCurrentProject(project);
        setSiteArea(project.inputs?.siteArea || 0);
        setMapImageUrl(project.mapImageUrl || "");
        setSavedPolygon(project.polygon || null);
        
        // Check for saved project
        const savedKey = `buildflow_project_${id}`;
        const savedData = localStorage.getItem(savedKey);
        
        if (savedData) {
          try {
            const saved = JSON.parse(savedData) as Project;
            setSavedProject(saved);
            
            // Check auto-restore preference
            const autoRestoreKey = `buildflow_autorestore_${id}`;
            const autoRestore = localStorage.getItem(autoRestoreKey) === "true";
            
            if (autoRestore) {
              // Auto-restore without prompt
              loadSavedProject(saved);
            } else {
              // Show restore banner
              setShowRestoreBanner(true);
            }
          } catch (error) {
            console.error("Failed to parse saved project:", error);
          }
        }
        
        // Check for backup
        const backupKey = `buildflow_project_${id}_backup`;
        setHasBackup(!!localStorage.getItem(backupKey));
        
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

  const loadSavedProject = (saved: Project) => {
    setCurrentProject(saved);
    setSiteArea(saved.inputs?.siteArea || 0);
    setMapImageUrl(saved.mapImageUrl || "");
    setSavedPolygon(saved.polygon || null);
    
    localStorage.setItem("napkin-calculator-data", JSON.stringify({
      rows: saved.rows,
      inputs: saved.inputs,
    }));
    
    toast.success("Previous save restored");
  };

  const handleSaveChatToNotes = (chatExport: string) => {
    if (currentProject) {
      const updatedProject = {
        ...currentProject,
        notes: currentProject.notes 
          ? `${currentProject.notes}\n\n--- QS Chat (${new Date().toLocaleDateString()}) ---\n${chatExport}`
          : `--- QS Chat (${new Date().toLocaleDateString()}) ---\n${chatExport}`,
        lastUpdated: new Date().toISOString(),
      };
      setCurrentProject(updatedProject);
      saveProject(updatedProject);
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
      <GlobalHeader 
        currentProject={currentProject || undefined}
        currentSection={activeTab}
        saveStatus={saveStatus}
        lastSaveTime={lastSaveTime}
        onSaveNow={handleSaveNow}
        onLoadLastSave={handleLoadLastSave}
        onResetProject={handleResetProject}
        onDuplicateProject={handleDuplicateProject}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Restore Banner */}
        {showRestoreBanner && savedProject && (
          <div className="mb-6">
            <RestoreBanner
              timestamp={new Date(savedProject.lastUpdated).toLocaleString()}
              hasBackup={hasBackup}
              onRestore={handleRestore}
              onRestoreBackup={handleRestoreBackup}
              onDismiss={() => setShowRestoreBanner(false)}
              onAutoRestoreChange={handleAutoRestoreChange}
            />
          </div>
        )}
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
                onLocationDetected={handleLocationDetected}
                savedPolygon={savedPolygon}
                onPolygonUpdate={handlePolygonUpdate}
              />
              
              {currentProject && (
                <LocationPresets
                  onApply={handleApplyPreset}
                  currentRows={currentProject.rows}
                  currentInputs={currentProject.inputs}
                  projectLocation={detectedLocation || currentProject.location}
                  detectedRegion={detectedRegion || currentProject.presetInfo?.region}
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

      {/* QS Chat */}
      <QSChatBubble onClick={() => setIsChatOpen(true)} />
      <QSChatPanel 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        project={currentProject}
        onSaveToNotes={handleSaveChatToNotes}
      />
    </div>
  );
};

export default ProjectWorkspace;
