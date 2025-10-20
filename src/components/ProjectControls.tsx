import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, Save, FolderOpen, RotateCcw, Copy } from "lucide-react";
import { useState } from "react";

interface ProjectControlsProps {
  onSaveNow: () => void;
  onLoadLastSave: () => void;
  onResetProject: () => void;
  onDuplicateProject: () => void;
}

export const ProjectControls = ({
  onSaveNow,
  onLoadLastSave,
  onResetProject,
  onDuplicateProject,
}: ProjectControlsProps) => {
  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleReset = () => {
    setShowResetDialog(true);
  };

  const confirmReset = () => {
    onResetProject();
    setShowResetDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onSaveNow}>
            <Save className="h-4 w-4 mr-2" />
            Save Now
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLoadLastSave}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Load Last Save
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicateProject}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate Project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleReset} className="text-destructive">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the current project state and remove the local save.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
