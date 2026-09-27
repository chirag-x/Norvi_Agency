-- Drop the oldest signature (14 params)
DROP FUNCTION IF EXISTS public.admin_upsert_product(uuid, text, text, text, text, text, text, text, text, text, text[], text, text, text);

-- Drop the Phase 0.6 signature (17 params)
DROP FUNCTION IF EXISTS public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text);
