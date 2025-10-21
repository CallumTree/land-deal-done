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
        // Save to ONE source of truth
        projectStorage.saveProject(project);
        
        // Update backup once per session
        if (saveCountRef.current === 0) {
          const backupKey = `buildflow_project_${projectId}_backup`;
          localStorage.setItem(backupKey, JSON.stringify(project));
        }
        saveCountRef.current++;
        
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

