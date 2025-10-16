-- Create the updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for app settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings
CREATE POLICY "Anyone can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow authenticated users to update settings
CREATE POLICY "Authenticated users can update app settings"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow insert for authenticated users
CREATE POLICY "Authenticated users can insert app settings"
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default mapbox token setting (empty)
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('mapbox_token', NULL)
ON CONFLICT (setting_key) DO NOTHING;