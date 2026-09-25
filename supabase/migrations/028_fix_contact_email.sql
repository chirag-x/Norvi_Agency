-- Migration 028: Fix placeholder contact email in settings
-- 
-- The initial seed data in migration 008 set the email to 'email_Support'.
-- This updates the existing settings row to the correct support email.

UPDATE public.site_settings 
SET email = 'chiragsharmawork95@gmail.com' 
WHERE email = 'email_Support';

-- Also ensure the fallback values for domain and company are reasonable
UPDATE public.site_settings 
SET company = 'Norvi AI Agency' 
WHERE company = 'name_Company';

UPDATE public.site_settings 
SET domain = 'nor-vi.in' 
WHERE domain = 'domain_Website';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
