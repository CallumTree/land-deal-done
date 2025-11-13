import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check } from "lucide-react";
import { Feature, getUpgradeMessage } from "@/utils/subscriptionHelpers";

interface UpgradePromptProps {
  feature: Feature;
  title?: string;
  description?: string;
  benefits?: string[];
}

export const UpgradePrompt = ({ 
  feature, 
  title,
  description,
  benefits = []
}: UpgradePromptProps) => {
  const navigate = useNavigate();

  const defaultBenefits: Record<Feature, string[]> = {
    pdf_export: [
      'Export professional PDF reports',
      'Include company branding',
      'Lender-ready documentation',
      'Unlimited exports'
    ],
    ai_qs: [
      'AI-powered quantity surveying',
      'Instant cost estimates',
      'Market insights',
      'Chat support'
    ],
    location_presets: [
      'All UK regional presets',
      'Market calibration data',
      'Cost benchmarks',
      'Planning insights'
    ],
    roi_visualizer: [
      'Visual ROI analysis',
      'Sensitivity charts',
      'Waterfall diagrams',
      'Custom scenarios'
    ],
    watermark: [
      'Clean, professional exports',
      'No EazyBuild branding',
      'Client-ready documents'
    ],
    brandable_exports: [
      'Add your company logo',
      'Custom color schemes',
      'Branded templates',
      'White-label exports'
    ],
    planning_uplift: [
      'Planning uplift insights',
      'Policy zone analysis',
      'Viability assessments',
      'CIL/S106 estimates'
    ],
    collaboration: [
      'Team workspaces',
      'Shared projects',
      'Role-based permissions',
      'Activity tracking'
    ],
    api_access: [
      'Full API access',
      'Custom integrations',
      'Webhook support',
      'Developer documentation'
    ]
  };

  const displayBenefits = benefits.length > 0 ? benefits : defaultBenefits[feature];
  const displayTitle = title || getUpgradeMessage(feature);
  const displayDescription = description || 'Unlock this premium feature and more with a paid plan';

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {displayTitle}
            </CardTitle>
            <CardDescription>{displayDescription}</CardDescription>
          </div>
          <Badge variant="default">Premium</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {displayBenefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
        
        <div className="flex gap-3 pt-2">
          <Button 
            onClick={() => navigate('/pricing')}
            className="flex-1"
          >
            View Plans
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/profile')}
          >
            My Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
