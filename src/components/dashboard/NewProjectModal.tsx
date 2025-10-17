import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectStorage } from "@/services/projectStorage";
import { Project } from "@/types/project";
import { toast } from "sonner";

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewProjectModal = ({ open, onOpenChange }: NewProjectModalProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    postcode: "",
    landSize: "",
    landCost: "",
    notes: "",
  });

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: formData.name.trim(),
      location: formData.location.trim(),
      postcode: formData.postcode.trim(),
      dateCreated: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: "Draft",
      isFavorite: false,
      isArchived: false,
      rows: [],
      inputs: {
        professionalFeesPercent: 10,
        marketingSalesPercent: 3,
        contingencyPercent: 5,
        financePercent: 7,
        s106CIL: 0,
        landCost: parseFloat(formData.landCost) || 0,
        targetMarginPercent: 20,
        vatEnabled: false,
        siteArea: parseFloat(formData.landSize) || 0,
        demolitionClearance: 0,
        ecologyEnvironmental: 0,
        groundInvestigation: 0,
        planningStatutoryFees: 0,
        serviceConnections: 0,
        abnormals: 0,
        siteSecurity: 0,
        miscellaneousAllowance: 0,
        abnormalsPercentEnabled: false,
        abnormalsPercent: 0,
        siteNotes: formData.notes,
      },
      gdv: 0,
      profitMargin: 0,
      units: 0,
      density: 0,
      buildCost: 0,
      landCost: parseFloat(formData.landCost) || 0,
      netProfit: 0,
      roi: 0,
      rlv: 0,
      notes: formData.notes,
    };

    projectStorage.saveProject(newProject);
    toast.success("Project created!");
    onOpenChange(false);
    navigate(`/project/${newProject.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Enter the basic details for your new feasibility project
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Hayscastle Cross Development"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Pembrokeshire"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                placeholder="e.g., SA62 5XX"
                value={formData.postcode}
                onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="landSize">Land Size (hectares)</Label>
              <Input
                id="landSize"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.landSize}
                onChange={(e) => setFormData({ ...formData, landSize: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landCost">Land Cost (£)</Label>
              <Input
                id="landCost"
                type="number"
                step="1000"
                placeholder="0"
                value={formData.landCost}
                onChange={(e) => setFormData({ ...formData, landCost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any initial notes about this project..."
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="cta" onClick={handleCreate}>
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewProjectModal;
