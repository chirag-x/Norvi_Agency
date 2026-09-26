-- Migration 031: Free Trial System
-- Adds the claim_free_trial RPC function

CREATE OR REPLACE FUNCTION public.claim_free_trial(
  p_product_slug text,
  p_encryption_secret text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id       uuid;
  v_product_id    uuid;
  v_price_id      uuid;
  v_order_id      uuid;
  v_license_id    uuid;
  v_raw_key       text;
  v_key_hash      text;
  v_encrypted_key text;
  v_existing_trial boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to claim a trial.';
  END IF;

  SELECT id INTO v_product_id FROM public.products WHERE slug = p_product_slug;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  -- Check if user already owns or has ever claimed a trial for this product
  SELECT EXISTS (
    SELECT 1 FROM public.licenses 
    WHERE user_id = v_user_id AND product_id = v_product_id
  ) INTO v_existing_trial;

  IF v_existing_trial THEN
    RAISE EXCEPTION 'You already have a license or have used your free trial for this product.';
  END IF;

  -- Get a price reference (trial orders are free -> amount_minor = 0)
  SELECT id INTO v_price_id FROM public.prices WHERE product_id = v_product_id LIMIT 1;

  -- Create a paid trial order with amount 0
  INSERT INTO public.orders (
    user_id, product_id, price_id, status,
    amount_minor, currency, provider_payment_id, idempotency_key
  )
  VALUES (
    v_user_id, v_product_id, v_price_id, 'paid',
    0, 'USD',
    'trial_' || substr(md5(random()::text), 1, 10),
    'trial_' || substr(md5(random()::text), 1, 10)
  )
  RETURNING id INTO v_order_id;

  -- Generate the license key
  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4));

  v_key_hash      := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);

  -- Insert the license record set to expire in exactly 24 hours
  INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices, expires_at)
  VALUES (v_license_id, v_user_id, v_product_id, v_order_id, 'active', right(v_raw_key, 4), 3, now() + interval '24 hours');

  -- Insert the encrypted key material
  INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);

  -- Audit log
  INSERT INTO private.audit_log (actor_id, action, target_id)
  VALUES (v_user_id, 'license.trial_claimed', v_license_id::text);

  RETURN v_license_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_free_trial(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_free_trial(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
