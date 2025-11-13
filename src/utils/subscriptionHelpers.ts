export type SubscriptionTier = 'free' | 'pro' | 'business' | 'enterprise';

export type Feature = 
  | 'pdf_export'
  | 'ai_qs'
  | 'location_presets'
  | 'roi_visualizer'
  | 'watermark'
  | 'brandable_exports'
  | 'planning_uplift'
  | 'collaboration'
  | 'api_access';

const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  free: ['ai_qs', 'location_presets', 'roi_visualizer', 'watermark'],
  pro: ['ai_qs', 'location_presets', 'roi_visualizer', 'pdf_export'],
  business: [
    'ai_qs',
    'location_presets',
    'roi_visualizer',
    'pdf_export',
    'brandable_exports',
    'planning_uplift',
  ],
  enterprise: [
    'ai_qs',
    'location_presets',
    'roi_visualizer',
    'pdf_export',
    'brandable_exports',
    'planning_uplift',
    'collaboration',
    'api_access',
  ],
};

const PROJECT_LIMITS: Record<SubscriptionTier, number | null> = {
  free: 5,
  pro: 10,
  business: null, // unlimited
  enterprise: null, // unlimited
};

export const checkFeatureAccess = (
  userTier: SubscriptionTier,
  feature: Feature
): boolean => {
  return TIER_FEATURES[userTier]?.includes(feature) || false;
};

export const getProjectLimit = (tier: SubscriptionTier): number | null => {
  return PROJECT_LIMITS[tier] ?? 5;
};

export const getTierDisplayName = (tier: SubscriptionTier): string => {
  const names: Record<SubscriptionTier, string> = {
    free: 'Free',
    pro: 'Pro',
    business: 'Business',
    enterprise: 'Enterprise',
  };
  return names[tier] || 'Free';
};

export const getUpgradeMessage = (feature: Feature): string => {
  const messages: Record<Feature, string> = {
    pdf_export: 'Upgrade to Pro to export professional PDF reports',
    ai_qs: 'Upgrade to access AI Quantity Surveyor',
    location_presets: 'Upgrade to unlock all location presets',
    roi_visualizer: 'Upgrade to access ROI visualizations',
    watermark: 'Upgrade to remove watermarks',
    brandable_exports: 'Upgrade to Business for branded exports',
    planning_uplift: 'Upgrade to Business for planning uplift insights',
    collaboration: 'Upgrade to Enterprise for team collaboration',
    api_access: 'Upgrade to Enterprise for API access',
  };
  return messages[feature] || 'Upgrade to unlock this feature';
};
