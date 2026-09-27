-- Drop the old 3-parameter function
DROP FUNCTION IF EXISTS public.admin_gift_license(text, text, text);

-- Create the new 4-parameter function
CREATE OR REPLACE FUNCTION public.admin_gift_license(
  p_email text,
  p_product_slug text,
  p_encryption_secret text,
  p_duration text DEFAULT 'lifetime'
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
  v_interval      interval;
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

  -- Determine the time interval for the gift
  IF p_duration = '1_month' THEN
    v_interval := interval '1 month';
  ELSIF p_duration = '3_months' THEN
    v_interval := interval '3 months';
  ELSE
    v_interval := NULL; -- lifetime
  END IF;

  -- 3. Create a paid gift order with amount 0 (We removed price_id NOT NULL in 034)
  INSERT INTO public.orders (
    user_id, product_id, status,
    amount_minor, currency, provider_payment_id, idempotency_key, duration
  )
  VALUES (
    v_user_id, v_product_id, 'paid',
    0, 'USD',
    'gift_' || substr(md5(random()::text), 1, 10),
    'gift_' || substr(md5(random()::text), 1, 10),
    p_duration
  )
  RETURNING id INTO v_order_id;

  -- 4. Generate the license key
  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4));

  v_key_hash      := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);

  -- 5. Insert the license record
  INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices, expires_at)
  VALUES (v_license_id, v_user_id, v_product_id, v_order_id, 'active', right(v_raw_key, 4), 3, CASE WHEN v_interval IS NOT NULL THEN now() + v_interval ELSE NULL END);

  INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);

  -- 6. Audit log
  INSERT INTO private.audit_log (actor_id, action, target_id)
  VALUES (auth.uid(), 'license.gifted', v_license_id::text || ' to ' || p_email || ' (' || p_duration || ')');

  RETURN v_license_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_gift_license(text, text, text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_gift_license(text, text, text, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
