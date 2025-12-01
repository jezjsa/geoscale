-- Update plans table structure for new pricing model
-- Run this in Supabase SQL Editor

-- Add new columns if they don't exist
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_one_off boolean DEFAULT false;

-- Update existing plans (starter and pro) instead of deleting
UPDATE public.plans SET
  display_name = 'Starter',
  description = 'Perfect for small businesses who just need their geo pages created once.',
  website_limit = 1,
  combination_page_limit = 50,
  rank_tracking_frequency = NULL,
  rank_tracking_limit = 0,
  price_monthly = 49.00,
  per_site_price_gbp = 0,
  is_one_off = true,
  sort_order = 1,
  features = '["1 website", "50 geo-landing pages", "GPT content generation", "WordPress publishing", "Meta titles and descriptions", "Testimonial integration", "Related keyword inclusion", "CSV import for locations"]'::jsonb,
  target_customer = 'Small businesses needing one-time page creation',
  is_active = true
WHERE name = 'starter';

UPDATE public.plans SET
  display_name = 'Pro',
  description = 'Ideal for website owners who want active monitoring and ongoing improvements.',
  website_limit = 1,
  combination_page_limit = 400,
  rank_tracking_frequency = 'every_other_day',
  rank_tracking_limit = 50,
  price_monthly = 29.00,
  per_site_price_gbp = 0,
  is_one_off = false,
  sort_order = 2,
  features = '["1 website", "400 combination pages", "Up to 50 keywords tracked", "Every-other-day rank updates", "Keyword performance insights", "Bulk meta editor", "Content refresh on demand"]'::jsonb,
  target_customer = 'Website owners wanting active monitoring',
  is_active = true
WHERE name = 'pro';

-- Update existing agency plan
UPDATE public.plans SET
  display_name = 'Agency',
  description = 'Built for smaller agencies managing multiple local clients.',
  website_limit = 5,
  combination_page_limit = 2000,
  rank_tracking_frequency = 'every_other_day',
  rank_tracking_limit = 250,
  price_monthly = 99.00,
  per_site_price_gbp = 20.00,
  is_one_off = false,
  sort_order = 3,
  features = '["Up to 5 client websites", "400 pages per website", "50 tracked keywords per site (250 total)", "Every-other-day rank tracking", "Extra sites: £20/site + 50 keywords", "Client dashboards", "WordPress plugin for all sites", "Bulk meta optimisation"]'::jsonb,
  target_customer = 'Smaller agencies with multiple clients',
  is_active = true
WHERE name = 'agency';

-- Insert Agency Plus if it doesn't exist
INSERT INTO public.plans (
  name, display_name, description, website_limit, combination_page_limit,
  rank_tracking_frequency, rank_tracking_limit, price_monthly, per_site_price_gbp,
  is_one_off, sort_order, features, target_customer, is_active
)
SELECT
  'agency_plus',
  'Agency Plus',
  'For growing or established agencies with many client websites.',
  10,
  4000,
  'every_other_day',
  500,
  199.00,
  20.00,
  false,
  4,
  '["Up to 10 client websites", "400 pages per website", "50 tracked keywords per site (500 total)", "Every-other-day rank tracking", "Extra sites: £20/site + 50 keywords", "White-label client access", "Agency-level reporting", "All bulk editing tools", "WordPress plugin for all sites", "Priority support"]'::jsonb,
  'Growing agencies with many clients',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'agency_plus');

-- Verify the plans
SELECT name, display_name, price_monthly, is_one_off, website_limit, rank_tracking_limit, per_site_price_gbp 
FROM public.plans 
ORDER BY sort_order;
