-- 044_promotions_engine.sql

-- 1. Add promotion columns to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS banner_text text DEFAULT '',
ADD COLUMN IF NOT EXISTS sale_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sale_percentage int DEFAULT 0;

-- 2. Add is_on_sale flag to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_on_sale boolean DEFAULT false;

-- 3. Update get_site_settings to expose these securely
CREATE OR REPLACE FUNCTION public.get_site_settings()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT json_build_object(
    'name', name,
    'headline', headline,
    'description', description,
    'email', email,
    'company', company,
    'domain', domain,
    'maintenanceMode', maintenance_mode,
    'maintenance_mode', maintenance_mode,
    'permissions', permissions,
    'bannerText', banner_text,
    'saleActive', sale_active,
    'salePercentage', sale_percentage
  ) FROM public.site_settings WHERE id=1
$$;
REVOKE ALL ON FUNCTION public.get_site_settings() FROM public;
GRANT EXECUTE ON FUNCTION public.get_site_settings() TO anon, authenticated;

-- 4. Create an RPC for admins to update the promotions
CREATE OR REPLACE FUNCTION public.admin_update_promotions(
  p_banner_text text,
  p_sale_active boolean,
  p_sale_percentage int,
  p_sale_product_ids uuid[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.site_settings 
  SET 
    banner_text = p_banner_text,
    sale_active = p_sale_active,
    sale_percentage = p_sale_percentage,
    updated_at = now()
  WHERE id = 1;

  UPDATE public.products SET is_on_sale = false;

  IF p_sale_active AND array_length(p_sale_product_ids, 1) > 0 THEN
    UPDATE public.products SET is_on_sale = true WHERE id = ANY(p_sale_product_ids);
  END IF;

  INSERT INTO public.audit_log (id, user_id, action, target)
  VALUES (gen_random_uuid(), auth.uid(), 'Updated sales & promotions', 'marketing');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_promotions(text, boolean, int, uuid[]) TO authenticated;

-- 5. UPDATE CHECKOUT ORDER LOGIC TO STACK DISCOUNTS
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or unavailable.';
  END IF;

  IF p_duration = '1_month' THEN
    v_amount := coalesce(v_product.price_1m, 0);
  ELSIF p_duration = '3_months' THEN
    v_amount := coalesce(v_product.price_3m, 0);
  ELSIF p_duration = 'lifetime' THEN
    v_amount := coalesce(v_product.price_lifetime, 0);
  ELSE
    RAISE EXCEPTION 'Invalid duration. Must be 1_month, 3_months, or lifetime.';
  END IF;

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

  -- 2. Apply Referral Code Discount (stacking on top of the sale price)
  v_affiliate_id := NULL;
  IF p_referral_code IS NOT NULL AND trim(p_referral_code) != '' THEN
    SELECT id INTO v_affiliate_id FROM public.affiliates 
    WHERE upper(referral_code) = upper(trim(p_referral_code)) 
    AND user_id != v_user_id; -- Cannot refer yourself

    IF v_affiliate_id IS NOT NULL THEN
      -- Apply 10% discount on the remaining amount
      v_amount := v_amount * 0.90;
    END IF;
  END IF;

  v_currency := 'INR';
  v_order_id := gen_random_uuid();

  INSERT INTO public.orders (id, user_id, product_id, amount_minor, currency, status, duration, renewal_for_license_id, idempotency_key, affiliate_id)
  VALUES (v_order_id, v_user_id, p_product_id, (v_amount * 100)::bigint, v_currency, 'pending', p_duration, p_renewal_for_license_id, 'checkout_' || gen_random_uuid(), v_affiliate_id);

  RETURN jsonb_build_object('ok', true, 'order_id', v_order_id, 'amount', (v_amount * 100)::bigint, 'currency', v_currency, 'name', v_product.name);
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(uuid, text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
