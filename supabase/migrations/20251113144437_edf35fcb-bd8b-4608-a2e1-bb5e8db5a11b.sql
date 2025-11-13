-- Create subscription tiers reference table
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  max_projects INTEGER,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  duration_months INTEGER,
  max_redemptions INTEGER,
  times_redeemed INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL REFERENCES public.subscription_tiers(name),
  status TEXT NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  promo_code_id UUID REFERENCES public.promo_codes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create projects table for user project storage
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  date_created TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_tiers
CREATE POLICY "Anyone can view tiers"
  ON public.subscription_tiers FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for promo_codes
CREATE POLICY "Anyone can view active promo codes"
  ON public.promo_codes FOR SELECT
  TO authenticated
  USING (valid_until IS NULL OR valid_until > now());

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for projects
CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for user_subscriptions updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for projects last_updated
CREATE TRIGGER update_projects_last_updated
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed subscription tiers
INSERT INTO public.subscription_tiers (name, display_name, price_monthly, price_yearly, max_projects, features) VALUES
  ('free', 'Free', 0, 0, 5, '{"pdf_export": false, "ai_qs": true, "location_presets": true, "roi_visualizer": true, "watermark": true}'::jsonb),
  ('pro', 'Pro', 29, 290, 10, '{"pdf_export": true, "ai_qs": true, "location_presets": true, "roi_visualizer": true, "watermark": false}'::jsonb),
  ('business', 'Business', 99, 990, NULL, '{"pdf_export": true, "ai_qs": true, "location_presets": true, "roi_visualizer": true, "watermark": false, "brandable_exports": true, "planning_uplift": true}'::jsonb),
  ('enterprise', 'Enterprise', 149, 1490, NULL, '{"pdf_export": true, "ai_qs": true, "location_presets": true, "roi_visualizer": true, "watermark": false, "brandable_exports": true, "planning_uplift": true, "collaboration": true, "api_access": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Seed early adopter promo code
INSERT INTO public.promo_codes (code, discount_percent, duration_months, max_redemptions) VALUES
  ('EARLY50', 25, 6, 50)
ON CONFLICT (code) DO NOTHING;