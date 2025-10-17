import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Project } from "@/types/project";
import { projectStorage } from "@/services/projectStorage";
import ProjectCard from "@/components/dashboard/ProjectCard";
import AnalyticsSummary from "@/components/dashboard/AnalyticsSummary";
import NewProjectModal from "@/components/dashboard/NewProjectModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Filter,
  LogOut,
  Sparkles,
  Grid3x3,
  LayoutList,
} from "lucide-react";

type SortOption = "newest" | "gdv-high" | "profit-high";
type ViewMode = "grid" | "carousel";

const Home = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("carousel");
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        loadProjects();
      } else {
        navigate("/auth");
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProjects = () => {
    const allProjects = projectStorage.getAllProjects();
    setProjects(allProjects.filter((p) => !p.isArchived));
  };

  useEffect(() => {
    let filtered = [...projects];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.location.toLowerCase().includes(query) ||
          p.postcode.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        break;
      case "gdv-high":
        filtered.sort((a, b) => b.gdv - a.gdv);
        break;
      case "profit-high":
        filtered.sort((a, b) => b.profitMargin - a.profitMargin);
        break;
    }

    // Favorites first
    filtered.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));

    setFilteredProjects(filtered);
  }, [projects, searchQuery, sortBy]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to log out");
    } else {
      toast.success("Logged out successfully");
      navigate("/");
    }
  };

  const summary = projectStorage.getProjectSummary();

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
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                BuildFlow
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="cta" onClick={() => setShowNewProjectModal(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Project</span>
              </Button>

              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Analytics Summary */}
        {projects.length > 0 && <AnalyticsSummary summary={summary} />}

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="gdv-high">GDV (High → Low)</SelectItem>
                <SelectItem value="profit-high">Profit % (High → Low)</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "carousel" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("carousel")}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Projects */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">
              {searchQuery ? "No projects found" : "No projects yet"}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery
                ? "Try adjusting your search query"
                : "Click New Project to start your first feasibility assessment"}
            </p>
            {!searchQuery && (
              <Button variant="cta" onClick={() => setShowNewProjectModal(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Project
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Recent/Favorites Section */}
            {filteredProjects.some((p) => p.isFavorite) && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Favorites</h2>
                <div
                  className={
                    viewMode === "carousel"
                      ? "flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
                      : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  }
                >
                  {filteredProjects
                    .filter((p) => p.isFavorite)
                    .map((project) => (
                      <div
                        key={project.id}
                        className={viewMode === "carousel" ? "snap-start" : ""}
                      >
                        <ProjectCard project={project} onUpdate={loadProjects} />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* All Projects Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {filteredProjects.some((p) => p.isFavorite) ? "All Projects" : "Recent Projects"}
              </h2>
              <div
                className={
                  viewMode === "carousel"
                    ? "flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                }
              >
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={viewMode === "carousel" ? "snap-start" : ""}
                  >
                    <ProjectCard project={project} onUpdate={loadProjects} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      <NewProjectModal open={showNewProjectModal} onOpenChange={setShowNewProjectModal} />
    </div>
  );
};

export default Home;
