import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Project } from "@/types/project";
import { projectStorage } from "@/services/projectStorage";
import { 
  MapPin, 
  Calendar, 
  MoreVertical, 
  Star, 
  Copy, 
  FileDown, 
  Edit, 
  Trash2,
  Home,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/utils/calculatorHelpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  onUpdate: () => void;
}

const ProjectCard = ({ project, onUpdate }: ProjectCardProps) => {
  const navigate = useNavigate();
  const [isFlipped, setIsFlipped] = useState(false);

  const getProfitColor = (margin: number) => {
    if (margin >= 20) return "text-success";
    if (margin >= 10) return "text-warning";
    return "text-destructive";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved": return "bg-success/10 text-success border-success/20";
      case "Under Review": return "bg-warning/10 text-warning border-warning/20";
      case "Completed": return "bg-info/10 text-info border-info/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const handleOpen = () => {
    navigate(`/project/${project.id}`);
  };

  const handleDuplicate = () => {
    const duplicate = projectStorage.duplicateProject(project.id);
    if (duplicate) {
      toast.success("Project duplicated");
      onUpdate();
    }
  };

  const handleExport = () => {
    projectStorage.exportProject(project.id);
    toast.success("Project exported");
  };

  const handleDelete = () => {
    if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      projectStorage.deleteProject(project.id);
      toast.success("Project deleted");
      onUpdate();
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    projectStorage.toggleFavorite(project.id);
    toast.success(project.isFavorite ? "Removed from favorites" : "Added to favorites");
    onUpdate();
  };

  return (
    <Card 
      className={cn(
        "group relative cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        "min-w-[320px] max-w-[380px]"
      )}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      {!isFlipped ? (
        // Card Front
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{project.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{project.location || project.postcode || "No location"}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleToggleFavorite}
              >
                <Star className={cn("h-4 w-4", project.isFavorite && "fill-primary text-primary")} />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpen(); }}>
                    <Home className="h-4 w-4 mr-2" />
                    Open Project
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(); }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleExport(); }}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Export JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={getStatusColor(project.status)}>
              {project.status}
            </Badge>
            {project.tag && (
              <Badge variant="secondary">{project.tag}</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 py-3 border-y">
            <div>
              <div className="text-xs text-muted-foreground">GDV</div>
              <div className="font-semibold text-lg">{formatCurrency(project.gdv)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Profit Margin</div>
              <div className={cn("font-semibold text-lg", getProfitColor(project.profitMargin))}>
                {formatPercent(project.profitMargin)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Units:</span>{" "}
              <span className="font-medium">{project.units}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Density:</span>{" "}
              <span className="font-medium">{project.density.toFixed(1)} u/ha</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <Calendar className="h-3 w-3" />
            <span>Updated {new Date(project.lastUpdated).toLocaleDateString()}</span>
          </div>

          <div className="text-xs text-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            Click to see details
          </div>
        </CardContent>
      ) : (
        // Card Back
        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            <h4 className="font-semibold">Quick Stats</h4>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Build (Base)</div>
                <div className="font-medium">{formatCurrency(project.buildCost)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Land Cost</div>
                <div className="font-medium">{formatCurrency(project.landCost)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Net Profit</div>
                <div className="font-medium">{formatCurrency(project.netProfit)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">ROI</div>
                <div className="font-medium">{formatPercent(project.roi)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">RLV</div>
                <div className="font-medium">{formatCurrency(project.rlv)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleOpen(); }}
            >
              Open Feasibility
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              size="sm"
              onClick={(e) => { e.stopPropagation(); navigate(`/project/${project.id}?tab=roi`); }}
            >
              Open ROI Visualiser
            </Button>
          </div>

          <div className="text-xs text-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pt-2">
            Click to flip back
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ProjectCard;
