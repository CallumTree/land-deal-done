import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, X, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface RestoreBannerProps {
  timestamp: string;
  hasBackup: boolean;
  onRestore: () => void;
  onRestoreBackup: () => void;
  onDismiss: () => void;
  onAutoRestoreChange: (enabled: boolean) => void;
}

export const RestoreBanner = ({
  timestamp,
  hasBackup,
  onRestore,
  onRestoreBackup,
  onDismiss,
  onAutoRestoreChange,
}: RestoreBannerProps) => {
  const [autoRestore, setAutoRestore] = useState(false);

  const handleAutoRestoreChange = (checked: boolean) => {
    setAutoRestore(checked);
    onAutoRestoreChange(checked);
  };

  return (
    <Alert className="relative border-primary/50 bg-primary/5">
      <Clock className="h-4 w-4" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-8">
        <div className="flex-1">
          <p className="font-medium">Restore previous save from {timestamp}?</p>
          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              id="auto-restore"
              checked={autoRestore}
              onCheckedChange={handleAutoRestoreChange}
            />
            <label
              htmlFor="auto-restore"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Always restore automatically
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasBackup && (
            <Button variant="outline" size="sm" onClick={onRestoreBackup}>
              <Download className="h-4 w-4 mr-1" />
              Recover Backup
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button size="sm" onClick={onRestore}>
            Restore
          </Button>
        </div>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
};
