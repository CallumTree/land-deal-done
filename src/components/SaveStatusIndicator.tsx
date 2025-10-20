import { CheckCircle, Loader2 } from "lucide-react";

interface SaveStatusIndicatorProps {
  status: "idle" | "saving" | "saved";
  lastSaveTime?: string;
}

export const SaveStatusIndicator = ({ status, lastSaveTime }: SaveStatusIndicatorProps) => {
  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {status === "saving" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
          <span className="text-yellow-500">Saving...</span>
        </>
      ) : (
        <>
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span className="text-green-500">
            Saved {lastSaveTime && `· ${lastSaveTime}`}
          </span>
        </>
      )}
    </div>
  );
};
