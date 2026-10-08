-- 057_update_contact_details.sql
-- Update the site settings email to the new official support email

UPDATE public.site_settings 
SET email = 'norviagency@gmail.com' 
WHERE email = 'chiragsharmawork95@gmail.com';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
