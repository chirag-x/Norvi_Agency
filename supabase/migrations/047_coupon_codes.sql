-- 047_coupon_codes.sql

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_percentage int NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  duration_type text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Safely create index
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_coupons_code_upper') THEN
    CREATE UNIQUE INDEX idx_coupons_code_upper ON public.coupons (upper(code));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_coupons()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text; v_res json;
BEGIN
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT coalesce(json_agg(json_build_object(
    'id', c.id, 'code', c.code, 'discount_percentage', c.discount_percentage,
    'product_id', c.product_id, 'duration_type', c.duration_type,
    'expires_at', c.expires_at, 'created_at', c.created_at
  ) ORDER BY c.created_at DESC), '[]'::json) INTO v_res FROM public.coupons c;
  RETURN v_res;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_coupons() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_coupon(
  p_id uuid, p_code text, p_discount int, p_product_id uuid, p_duration text, p_expires_at timestamp with time zone
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  
  INSERT INTO public.coupons (id, code, discount_percentage, product_id, duration_type, expires_at)
  VALUES (coalesce(p_id, gen_random_uuid()), upper(trim(p_code)), p_discount, p_product_id, p_duration, p_expires_at)
  ON CONFLICT (id) DO UPDATE SET 
    code = upper(trim(excluded.code)),
    discount_percentage = excluded.discount_percentage,
    product_id = excluded.product_id,
    duration_type = excluded.duration_type,
    expires_at = excluded.expires_at;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_coupon(uuid, text, int, uuid, text, timestamp with time zone) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_coupon(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM public.coupons WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_coupon(uuid) TO authenticated;

-- Rewrite create_checkout_order to incorporate coupons
CREATE OR REPLACE FUNCTION public.create_checkout_order(
    p_product_id uuid,
    p_duration text DEFAULT 'lifetime',
    p_renewal_for_license_id uuid DEFAULT NULL,
    p_referral_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_product record;
  v_user_id uuid;
  v_order_id uuid;
  v_amount numeric(10,2);
  v_currency text;
  v_affiliate_id uuid;
  v_settings record;
  v_coupon record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found or unavailable.'; END IF;

  IF p_duration = '1_month' THEN v_amount := coalesce(v_product.price_1m, 0);
  ELSIF p_duration = '3_months' THEN v_amount := coalesce(v_product.price_3m, 0);
  ELSIF p_duration = 'lifetime' THEN v_amount := coalesce(v_product.price_lifetime, 0);
  ELSE RAISE EXCEPTION 'Invalid duration. Must be 1_month, 3_months, or lifetime.'; END IF;

  IF p_renewal_for_license_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.licenses WHERE id = p_renewal_for_license_id AND user_id = v_user_id AND product_id = p_product_id) THEN
      RAISE EXCEPTION 'License to renew not found or does not belong to you.';
    END IF;
  END IF;

  -- 1. Apply Flash Sale Discount (if active)
  SELECT * INTO v_settings FROM public.site_settings WHERE id = 1;
  IF v_settings.sale_active AND v_settings.sale_percentage > 0 AND v_product.is_on_sale THEN
    v_amount := v_amount * (1.0 - (v_settings.sale_percentage::numeric / 100.0));
  END IF;

  -- 2. Apply Referral Code OR Coupon Code
  v_affiliate_id := NULL;
  IF p_referral_code IS NOT NULL AND trim(p_referral_code) != '' THEN
    -- Try Coupon first
    SELECT * INTO v_coupon FROM public.coupons 
    WHERE upper(code) = upper(trim(p_referral_code))
      AND (expires_at IS NULL OR expires_at > now())
      AND (product_id IS NULL OR product_id = p_product_id)
      AND (duration_type IS NULL OR duration_type = 'all' OR duration_type = p_duration);
      
    IF FOUND THEN
      v_amount := v_amount * (1.0 - (v_coupon.discount_percentage::numeric / 100.0));
    ELSE
      -- Try Affiliate
      SELECT id INTO v_affiliate_id FROM public.affiliates 
      WHERE upper(referral_code) = upper(trim(p_referral_code)) 
      AND user_id != v_user_id;

      IF FOUND THEN
        v_amount := v_amount * 0.90;
      END IF;
    END IF;
  END IF;

  -- Ensure amount doesn't go below 0 due to floating point
  IF v_amount < 0 THEN v_amount := 0; END IF;

  v_currency := 'INR';
  v_order_id := gen_random_uuid();

  INSERT INTO public.orders (id, user_id, product_id, amount_minor, currency, status, duration, renewal_for_license_id, idempotency_key, affiliate_id)
  VALUES (v_order_id, v_user_id, p_product_id, (v_amount * 100)::bigint, v_currency, 'pending', p_duration, p_renewal_for_license_id, 'checkout_' || gen_random_uuid(), v_affiliate_id);

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'amount', (v_amount * 100)::bigint, 'currency', v_currency, 'name', v_product.name);
END;
$$;
REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) TO authenticated;

-- New function for frontend to validate the code purely for UI math
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text, p_product_id uuid, p_duration text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_coupon record; v_affiliate_id uuid;
BEGIN
  -- Try Coupon
  SELECT * INTO v_coupon FROM public.coupons 
  WHERE upper(code) = upper(trim(p_code))
    AND (expires_at IS NULL OR expires_at > now())
    AND (product_id IS NULL OR product_id = p_product_id)
    AND (duration_type IS NULL OR duration_type = p_duration OR duration_type = 'all');
  IF FOUND THEN
    RETURN json_build_object('type', 'coupon', 'discount', v_coupon.discount_percentage);
  END IF;

  -- Try Affiliate
  SELECT id INTO v_affiliate_id FROM public.affiliates 
  WHERE upper(referral_code) = upper(trim(p_code)) AND user_id != auth.uid();
  IF FOUND THEN
    RETURN json_build_object('type', 'referral', 'discount', 10);
  END IF;

  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, uuid, text) TO authenticated;
