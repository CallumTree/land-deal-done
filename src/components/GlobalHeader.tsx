import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, ChevronDown, LayoutDashboard, MessageSquare, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { projectStorage } from "@/services/projectStorage";
import { Project } from "@/types/project";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GlobalHeaderProps {
  currentProject?: Project;
  currentSection?: string;
  hasUnsavedChanges?: boolean;
  onSave?: () => void;
}

const GlobalHeader = ({ 
  currentProject, 
  currentSection,
  hasUnsavedChanges = false,
  onSave
}: GlobalHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    // Load recent projects (last 5)
    const projects = projectStorage.getAllProjects()
      .filter(p => !p.isArchived)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 5);
    setRecentProjects(projects);
  }, []);

  // Keyboard shortcut: D for Dashboard
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleNavigation('/dashboard');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [hasUnsavedChanges]);

  const handleNavigation = (path: string) => {
    if (hasUnsavedChanges && location.pathname !== path) {
      setPendingNavigation(path);
      setShowUnsavedModal(true);
    } else {
      navigate(path);
    }
  };

  const handleSaveAndGo = () => {
    if (onSave) {
      onSave();
    }
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
    setShowUnsavedModal(false);
  };

  const handleDiscard = () => {
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
    setShowUnsavedModal(false);
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

  const getSectionName = () => {
    if (location.pathname.includes('/project/')) {
      const sections = {
        'site-map': 'Site Map',
        'gdv-calculator': 'GDV Calculator',
        'roi-visualiser': 'ROI Visualiser',
        'build-cost': 'Build Cost'
      };
      return currentSection || 'Overview';
    }
    return null;
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo */}
            <Link 
              to="/dashboard" 
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <div className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                BuildFlow
              </div>
            </Link>

            {/* Center: Breadcrumb */}
            <div className="hidden md:flex items-center flex-1 justify-center max-w-2xl mx-8">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink 
                      onClick={() => handleNavigation('/dashboard')}
                      className="cursor-pointer flex items-center gap-1"
                    >
                      <Home className="h-4 w-4" />
                      Home
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  
                  {currentProject && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex items-center gap-1 hover:text-primary">
                            {currentProject.name}
                            <ChevronDown className="h-3 w-3" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-64">
                            <div className="px-2 py-1.5 text-sm font-semibold">Recent Projects</div>
                            {recentProjects.map((project) => (
                              <DropdownMenuItem
                                key={project.id}
                                onClick={() => handleNavigation(`/project/${project.id}`)}
                                className={project.id === currentProject.id ? "bg-muted" : ""}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{project.name}</span>
                                  <span className="text-xs text-muted-foreground">{project.location}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleNavigation('/dashboard')}>
                              All Projects...
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('new-project'))}>
                              + New Project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </BreadcrumbItem>
                    </>
                  )}

                  {getSectionName() && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{getSectionName()}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigation('/dashboard')}
                className="hidden md:flex gap-2"
                title="Go to Dashboard (D)"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="hidden lg:flex gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Ask AI
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleNavigation('/dashboard')}>
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Unsaved Changes</h3>
            <p className="text-muted-foreground mb-6">
              You have unsaved changes. What would you like to do?
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setShowUnsavedModal(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={handleDiscard}>
                Discard
              </Button>
              <Button onClick={handleSaveAndGo}>
                Save & Go
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalHeader;
