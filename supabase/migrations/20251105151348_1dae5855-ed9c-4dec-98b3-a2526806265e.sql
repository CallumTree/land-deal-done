-- Create a table for early access registrations
CREATE TABLE public.early_interest (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_type TEXT,
  region TEXT,
  beta_access BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.early_interest ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow anyone to insert (public registration)
CREATE POLICY "Anyone can register interest" 
ON public.early_interest 
FOR INSERT 
WITH CHECK (true);

-- Create index on email for faster lookups
CREATE INDEX idx_early_interest_email ON public.early_interest(email);

-- Create index on created_at for analytics
CREATE INDEX idx_early_interest_created_at ON public.early_interest(created_at DESC);