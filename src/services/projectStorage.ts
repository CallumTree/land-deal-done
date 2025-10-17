import { Project, ProjectSummary } from "@/types/project";

const STORAGE_KEY = "buildflow_projects";

export const projectStorage = {
  getAllProjects(): Project[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error loading projects:", error);
      return [];
    }
  },

  getProject(id: string): Project | null {
    const projects = this.getAllProjects();
    return projects.find((p) => p.id === id) || null;
  },

  saveProject(project: Project): void {
    const projects = this.getAllProjects();
    const index = projects.findIndex((p) => p.id === project.id);
    
    if (index >= 0) {
      projects[index] = { ...project, lastUpdated: new Date().toISOString() };
    } else {
      projects.push(project);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  },

  deleteProject(id: string): void {
    const projects = this.getAllProjects();
    const filtered = projects.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  deleteProjects(ids: string[]): void {
    const projects = this.getAllProjects();
    const filtered = projects.filter((p) => !ids.includes(p.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  duplicateProject(id: string): Project | null {
    const original = this.getProject(id);
    if (!original) return null;

    const duplicate: Project = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (Copy)`,
      dateCreated: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isFavorite: false,
    };

    this.saveProject(duplicate);
    return duplicate;
  },

  toggleFavorite(id: string): void {
    const project = this.getProject(id);
    if (project) {
      project.isFavorite = !project.isFavorite;
      this.saveProject(project);
    }
  },

  archiveProject(id: string): void {
    const project = this.getProject(id);
    if (project) {
      project.isArchived = true;
      this.saveProject(project);
    }
  },

  exportProject(id: string): void {
    const project = this.getProject(id);
    if (!project) return;

    const dataStr = JSON.stringify(project, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, "-")}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  importProject(file: File): Promise<Project> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const project = JSON.parse(e.target?.result as string) as Project;
          project.id = crypto.randomUUID(); // New ID for imported project
          project.dateCreated = new Date().toISOString();
          project.lastUpdated = new Date().toISOString();
          this.saveProject(project);
          resolve(project);
        } catch (error) {
          reject(new Error("Invalid project file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  },

  getProjectSummary(): ProjectSummary {
    const projects = this.getAllProjects().filter((p) => !p.isArchived);
    
    if (projects.length === 0) {
      return {
        totalGDV: 0,
        averageProfitMargin: 0,
        highestMarginProject: null,
        averageUnits: 0,
        totalSites: 0,
        estimatedCombinedRLV: 0,
      };
    }

    const totalGDV = projects.reduce((sum, p) => sum + p.gdv, 0);
    const averageProfitMargin = projects.reduce((sum, p) => sum + p.profitMargin, 0) / projects.length;
    const averageUnits = projects.reduce((sum, p) => sum + p.units, 0) / projects.length;
    const estimatedCombinedRLV = projects.reduce((sum, p) => sum + p.rlv, 0);
    
    const highestMargin = projects.reduce((max, p) => 
      p.profitMargin > (max?.profitMargin || 0) ? p : max
    , projects[0]);

    return {
      totalGDV,
      averageProfitMargin,
      highestMarginProject: {
        name: highestMargin.name,
        margin: highestMargin.profitMargin,
      },
      averageUnits,
      totalSites: projects.length,
      estimatedCombinedRLV,
    };
  },
};
