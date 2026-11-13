-- Plot Line reset: sites + scenarios.
--
-- Auth model: anonymous sign-in (see CLAUDE.md / src/lib/supabase/client.ts).
-- Every visitor gets a real auth.uid() with no login screen, so these
-- tables use the same owner-scoped RLS pattern as a logged-in user would —
-- user_id NOT NULL, policies keyed on auth.uid() = user_id. When an
-- anonymous user is later upgraded to a full account, auth.uid() stays the
-- same (Supabase's identity-linking preserves it), so existing rows keep
-- working with no migration and no data loss.
--
-- This runs against a fresh, empty Supabase project, so it defines its own
-- updated_at trigger function rather than assuming one already exists.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Boundary polygon in British National Grid (EPSG:27700) metres, plus the
  -- one entrance point clicked on that boundary. Plain JSONB for now —
  -- PostGIS is explicitly deferred until a real need (spatial queries,
  -- indexing) earns it; Priority 1 doesn't need either.
  boundary_bng JSONB NOT NULL,
  entrance_point_bng JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Scenario',
  -- House-type mix, parking ratio, GIA/back-to-back/garden-depth overrides,
  -- £/sqft GDV & build cost assumptions.
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Generated plots/roads + compliance checks (colour-coded pass/fail).
  layout_result JSONB,
  -- unit count, mix, net/gross dph, total GIA, GDV, build cost, RLV.
  metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenarios_site_id ON public.scenarios(site_id);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sites"
  ON public.sites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sites"
  ON public.sites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sites"
  ON public.sites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sites"
  ON public.sites FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own scenarios"
  ON public.scenarios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scenarios"
  ON public.scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scenarios"
  ON public.scenarios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scenarios"
  ON public.scenarios FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scenarios_updated_at
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS alone doesn't grant table access — the anon/authenticated Postgres
-- roles still need explicit GRANTs, or every query 403s even with correct
-- policies. (Caught the hard way against the old project before switching.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO authenticated;
GRANT ALL ON public.sites TO service_role;
GRANT ALL ON public.scenarios TO service_role;
