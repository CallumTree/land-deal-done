import { useEffect, useRef, useCallback, useState } from "react";
import { Project } from "@/types/project";
import { projectStorage } from "@/services/projectStorage";
import { toast } from "sonner";

interface AutoSaveOptions {
  projectId: string;
  onSave?: (timestamp: string) => void;
  debounceMs?: number;
}

export const useAutoSave = ({ projectId, onSave, debounceMs = 500 }: AutoSaveOptions) => {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSaveTime, setLastSaveTime] = useState<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveCountRef = useRef(0);

  const saveProject = useCallback((project: Project) => {
    setSaveStatus("saving");
    
    // Clear any pending save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounced save
    debounceTimerRef.current = setTimeout(() => {
      try {
        // Save main project
        projectStorage.saveProject(project);
        
        // Update backup once per session
        if (saveCountRef.current === 0) {
          const backupKey = `buildflow_project_${projectId}_backup`;
          localStorage.setItem(backupKey, JSON.stringify(project));
        }
        saveCountRef.current++;
        
        // Update index for dashboard
        updateProjectIndex(project);
        
        const timestamp = new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        setLastSaveTime(timestamp);
        setSaveStatus("saved");
        
        if (onSave) {
          onSave(timestamp);
        }

        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("Auto-save failed:", error);
        toast.error("Failed to save project");
        setSaveStatus("idle");
      }
    }, debounceMs);
  }, [projectId, onSave, debounceMs]);

  const saveNow = useCallback((project: Project) => {
    // Clear debounce and save immediately
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    try {
      projectStorage.saveProject(project);
      updateProjectIndex(project);
      
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      setLastSaveTime(timestamp);
      setSaveStatus("saved");
      toast.success("Project saved locally");
      
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Save now failed:", error);
      toast.error("Failed to save project");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    saveProject,
    saveNow,
    saveStatus,
    lastSaveTime,
  };
};

const updateProjectIndex = (project: Project) => {
  try {
    // Update the main projects storage to keep dashboard in sync
    const mainKey = 'buildflow_projects';
    const mainStored = localStorage.getItem(mainKey);
    const projects: Project[] = mainStored ? JSON.parse(mainStored) : [];
    const existingIndex = projects.findIndex((p) => p.id === project.id);
    
    if (existingIndex >= 0) {
      projects[existingIndex] = { ...project, lastUpdated: new Date().toISOString() };
    } else {
      projects.push(project);
    }
    
    localStorage.setItem(mainKey, JSON.stringify(projects));
  } catch (error) {
    console.error("Failed to update project index:", error);
  }
};
