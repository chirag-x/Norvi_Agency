-- 051_drop_old_upsert.sql
-- Drop the overloaded signature from 034_fix_prepaid_checkout.sql so PostgREST resolves to the new one with 22 params.
DROP FUNCTION IF EXISTS public.admin_upsert_product(
  uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric
);

-- Fallbacks just in case
DROP FUNCTION IF EXISTS public.admin_upsert_product(uuid, text, text, text, text, text, text, text, text, text, text[], text, text, text);
DROP FUNCTION IF EXISTS public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text);
