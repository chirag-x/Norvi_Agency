-- Migration 026: Fix admin_gift_license
-- 
-- PROBLEM: Two versions of admin_gift_license exist in the database:
--   1. (text, text)       - Old 2-param version from migration 019 (no encryption, broken)
--   2. (text, text, text) - New 3-param version from migration 023 (correct, uses extensions.digest)
--
-- The API calls with 3 params which targets v2, but v2 may have the wrong digest schema path.
-- This migration:
--   Step 1: Ensure pgcrypto is enabled in the extensions schema
--   Step 2: DROP the old broken 2-param version entirely
--   Step 3: Replace the 3-param version with a clean, verified definition

-- Step 1: Ensure pgcrypto extension exists
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Step 2: Drop the old 2-param version (dead code, no longer called by the API)
DROP FUNCTION IF EXISTS public.admin_gift_license(text, text);

-- Step 3: Replace the 3-param version with a clean copy
CREATE OR REPLACE FUNCTION public.admin_gift_license(
  p_email text,
  p_product_slug text,
  p_encryption_secret text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role          text;
  v_user_id       uuid;
  v_product_id    uuid;
  v_price_id      uuid;
  v_order_id      uuid;
  v_license_id    uuid;
  v_raw_key       text;
  v_key_hash      text;
  v_encrypted_key text;
BEGIN
  -- 0. Permission check
  SELECT role INTO v_role
  FROM public.staff_memberships
  WHERE user_id = auth.uid() AND active = true;

  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  -- 1. Find user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Account with this email does not exist. They must register first.';
  END IF;

  -- 2. Find product by slug
  SELECT id INTO v_product_id FROM public.products WHERE slug = p_product_slug;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  -- 3. Get a price (gift orders are free — amount_minor = 0)
  SELECT id INTO v_price_id FROM public.prices WHERE product_id = v_product_id LIMIT 1;

  -- 4. Create a paid gift order with amount 0
  INSERT INTO public.orders (
    user_id, product_id, price_id, status,
    amount_minor, currency, provider_payment_id, idempotency_key
  )
  VALUES (
    v_user_id, v_product_id, v_price_id, 'paid',
    0, 'USD',
    'gift_' || substr(md5(random()::text), 1, 10),
    'gift_' || substr(md5(random()::text), 1, 10)
  )
  RETURNING id INTO v_order_id;

  -- 5. Generate the license key
  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4));

  -- Use extensions.digest (pgcrypto lives in the extensions schema in Supabase)
  v_key_hash      := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);

  -- 6. Insert the license record
  INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices)
  VALUES (v_license_id, v_user_id, v_product_id, v_order_id, 'active', right(v_raw_key, 4), 3);

  -- 7. Insert the encrypted key material
  INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);

  -- 8. Audit log
  INSERT INTO private.audit_log (actor_id, action, target_id)
  VALUES (auth.uid(), 'license.gifted', v_license_id::text || ' -> ' || p_email);

  RETURN v_license_id;
END;
$$;

-- Lock down permissions
REVOKE EXECUTE ON FUNCTION public.admin_gift_license(text, text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_gift_license(text, text, text) TO authenticated;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
