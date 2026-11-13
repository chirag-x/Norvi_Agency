-- Migration 068: Overview Revenue Breakdown, Agent Leaderboard, Accurate Paid Orders & Coupon Tracking
-- 1. Adds revenue metrics for Today, 7d, 30d, All-Time and agent leaderboard to admin_analytics()
-- 2. Restricts "Paid Orders" strictly to commercial purchases (amount_minor > 0, excluding trial/gift/free)
-- 3. Adds trialsAllTime and trialOrders metrics for separate tracking of promotional activations
-- 4. Extends admin_list_orders() to classify 'trial', 'gift', 'free', and 'paid'
-- 5. Extends public.coupons with max_uses and used_count tracking and enforcement

BEGIN;

-- 1. Extend public.coupons with max_uses and used_count
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS max_uses integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS used_count integer DEFAULT 0;

-- 2. Upgrade admin_list_coupons()
CREATE OR REPLACE FUNCTION public.admin_list_coupons()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_role text;
  v_res json;
BEGIN
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT coalesce(json_agg(json_build_object(
    'id', c.id, 'code', c.code, 'discount_percentage', c.discount_percentage,
    'product_id', c.product_id, 'duration_type', c.duration_type,
    'expires_at', c.expires_at, 'created_at', c.created_at,
    'max_uses', c.max_uses,
    'used_count', COALESCE(c.used_count, 0)
  ) ORDER BY c.created_at DESC), '[]'::json) INTO v_res FROM public.coupons c;
  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_coupons() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_coupons() TO authenticated;

-- 3. Upgrade admin_upsert_coupon()
CREATE OR REPLACE FUNCTION public.admin_upsert_coupon(
  p_id uuid,
  p_code text,
  p_discount int,
  p_product_id uuid,
  p_duration text,
  p_expires_at timestamp with time zone,
  p_max_uses int DEFAULT 50
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  
  INSERT INTO public.coupons (id, code, discount_percentage, product_id, duration_type, expires_at, max_uses, used_count)
  VALUES (coalesce(p_id, gen_random_uuid()), upper(trim(p_code)), p_discount, p_product_id, p_duration, p_expires_at, p_max_uses, 0)
  ON CONFLICT (id) DO UPDATE SET 
    code = upper(trim(excluded.code)),
    discount_percentage = excluded.discount_percentage,
    product_id = excluded.product_id,
    duration_type = excluded.duration_type,
    expires_at = excluded.expires_at,
    max_uses = excluded.max_uses;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_upsert_coupon(uuid, text, int, uuid, text, timestamp with time zone, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_coupon(uuid, text, int, uuid, text, timestamp with time zone, int) TO authenticated;

-- Overload for backwards compatibility with 6-arg callers
CREATE OR REPLACE FUNCTION public.admin_upsert_coupon(
  p_id uuid,
  p_code text,
  p_discount int,
  p_product_id uuid,
  p_duration text,
  p_expires_at timestamp with time zone
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.admin_upsert_coupon(p_id, p_code, p_discount, p_product_id, p_duration, p_expires_at, 50);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_upsert_coupon(uuid, text, int, uuid, text, timestamp with time zone) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_coupon(uuid, text, int, uuid, text, timestamp with time zone) TO authenticated;

-- 4. Upgrade validate_promo_code() to enforce coupon usage limits
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text, p_product_id uuid, p_duration text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE 
  v_coupon record; 
  v_affiliate record;
  v_allowed_durations text[];
  v_duration_match boolean;
BEGIN
  -- 1. Try Coupon first
  SELECT * INTO v_coupon FROM public.coupons 
  WHERE upper(code) = upper(trim(p_code))
    AND (expires_at IS NULL OR expires_at > now())
    AND (product_id IS NULL OR product_id = p_product_id);
    
  IF FOUND THEN
    IF v_coupon.max_uses IS NOT NULL AND coalesce(v_coupon.used_count, 0) >= v_coupon.max_uses THEN
      RETURN json_build_object(
        'valid', false,
        'type', 'coupon',
        'reason', 'usage_limit_reached'
      );
    END IF;

    -- Determine allowed durations
    IF v_coupon.duration_type IS NULL OR v_coupon.duration_type = 'all' OR trim(v_coupon.duration_type) = '' THEN
      v_duration_match := true;
      v_allowed_durations := ARRAY['1_month', '3_months', 'lifetime'];
    ELSE
      v_allowed_durations := string_to_array(v_coupon.duration_type, ',');
      v_duration_match := (p_duration = ANY(v_allowed_durations));
    END IF;

    IF v_duration_match THEN
      RETURN json_build_object(
        'valid', true,
        'type', 'coupon', 
        'discount', v_coupon.discount_percentage,
        'allowed_durations', v_allowed_durations
      );
    ELSE
      RETURN json_build_object(
        'valid', false,
        'type', 'coupon',
        'reason', 'duration_mismatch',
        'discount', v_coupon.discount_percentage,
        'allowed_durations', v_allowed_durations
      );
    END IF;
  END IF;

  -- 2. Try Affiliate / Partner Code
  SELECT id, user_id, status INTO v_affiliate FROM public.affiliates 
  WHERE upper(referral_code) = upper(trim(p_code));

  IF FOUND THEN
    IF coalesce(v_affiliate.status, 'active') != 'active' THEN
      RETURN json_build_object('valid', false, 'reason', 'inactive');
    END IF;

    IF auth.uid() IS NOT NULL AND v_affiliate.user_id = auth.uid() THEN
      RETURN json_build_object('valid', false, 'reason', 'self_referral');
    END IF;

    RETURN json_build_object(
      'valid', true,
      'type', 'affiliate',
      'discount', 10,
      'allowed_durations', ARRAY['1_month', '3_months', 'lifetime']
    );
  END IF;

  RETURN json_build_object('valid', false, 'reason', 'not_found');
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, uuid, text) TO anon, authenticated, service_role;

-- 5. Upgrade admin_analytics() to count ACTUAL paid commercial orders
CREATE OR REPLACE FUNCTION public.admin_analytics()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_rev_today numeric;
  v_sales_today bigint;
  v_rev_7d numeric;
  v_sales_7d bigint;
  v_rev_30d numeric;
  v_sales_30d bigint;
  v_rev_all numeric;
  v_sales_all bigint;
  v_trials_all bigint;
  v_licenses bigint;
  v_customers bigint;
  v_activity json;
  v_leaderboard json;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'product_manager']);

  -- Today (since midnight) - strictly commercial paid orders
  SELECT COALESCE(SUM(amount_minor)/100.0, 0), COUNT(*)
  INTO v_rev_today, v_sales_today
  FROM public.orders
  WHERE status = 'paid' 
    AND amount_minor > 0
    AND coalesce(provider_payment_id, '') NOT LIKE 'trial_%'
    AND coalesce(provider_payment_id, '') NOT LIKE 'gift_%'
    AND coalesce(provider_payment_id, '') NOT LIKE 'free_%'
    AND created_at >= date_trunc('day', now());

  -- 7 Days - strictly commercial paid orders
  SELECT COALESCE(SUM(amount_minor)/100.0, 0), COUNT(*)
  INTO v_rev_7d, v_sales_7d
  FROM public.orders
  WHERE status = 'paid' 
    AND amount_minor > 0
    AND coalesce(provider_payment_id, '') NOT LIKE 'trial_%'
    AND coalesce(provider_payment_id, '') NOT LIKE 'gift_%'
    AND coalesce(provider_payment_id, '') NOT LIKE 'free_%'
    AND created_at >= now() - interval '7 days';

  -- 30 Days - strictly commercial paid orders
  SELECT COALESCE(SUM(amount_minor)/100.0, 0), COUNT(*)
  INTO v_rev_30d, v_sales_30d
  FROM public.orders
  WHERE status = 'paid' 
    AND amount_minor > 0
    AND coalesce(provider_payment_id, '') NOT LIKE 'trial_%'
    AND coalesce(provider_payment_id, '') NOT LIKE 'gift_%'
    AND coalesce(provider_payment_id, '') NOT LIKE 'free_%'
    AND created_at >= now() - interval '30 days';

  -- All-Time - strictly commercial paid orders
  SELECT COALESCE(SUM(amount_minor)/100.0, 0), COUNT(*)
  INTO v_rev_all, v_sales_all
  FROM public.orders
  WHERE status = 'paid'
    AND amount_minor > 0
    AND coalesce(provider_payment_id, '') NOT LIKE 'trial_%'
    AND coalesce(provider_payment_id, '') NOT LIKE 'gift_%'
    AND coalesce(provider_payment_id, '') NOT LIKE 'free_%';

  -- All-Time Trials & Gifted Activations (promotional)
  SELECT COUNT(*) INTO v_trials_all
  FROM public.orders
  WHERE status = 'paid'
    AND (amount_minor = 0 
         OR coalesce(provider_payment_id, '') LIKE 'trial_%'
         OR coalesce(provider_payment_id, '') LIKE 'gift_%'
         OR coalesce(provider_payment_id, '') LIKE 'free_%');

  -- Active Licenses
  SELECT COUNT(*) INTO v_licenses FROM public.licenses WHERE status = 'active';

  -- Total Customers
  SELECT COUNT(*) INTO v_customers FROM public.profiles p
  WHERE NOT EXISTS (SELECT 1 FROM public.staff_memberships s WHERE s.user_id = p.id);

  -- Top Agents Leaderboard
  SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json) INTO v_leaderboard FROM (
    SELECT 
      p.id,
      p.name,
      p.slug,
      p.status,
      COALESCE(COUNT(o.id) FILTER (
        WHERE o.status = 'paid' 
          AND o.amount_minor > 0
          AND coalesce(o.provider_payment_id, '') NOT LIKE 'trial_%'
          AND coalesce(o.provider_payment_id, '') NOT LIKE 'gift_%'
          AND coalesce(o.provider_payment_id, '') NOT LIKE 'free_%'
      ), 0) AS "paidOrders",
      COALESCE(COUNT(o.id) FILTER (
        WHERE o.status = 'paid' 
          AND (o.amount_minor = 0 
               OR coalesce(o.provider_payment_id, '') LIKE 'trial_%'
               OR coalesce(o.provider_payment_id, '') LIKE 'gift_%'
               OR coalesce(o.provider_payment_id, '') LIKE 'free_%')
      ), 0) AS "trialOrders",
      COALESCE(ROUND(SUM(o.amount_minor) FILTER (
        WHERE o.status = 'paid' 
          AND o.amount_minor > 0
          AND coalesce(o.provider_payment_id, '') NOT LIKE 'trial_%'
          AND coalesce(o.provider_payment_id, '') NOT LIKE 'gift_%'
          AND coalesce(o.provider_payment_id, '') NOT LIKE 'free_%'
      ) / 100.0, 2), 0) AS revenue,
      (SELECT COUNT(*) FROM public.licenses l WHERE l.product_id = p.id AND l.status = 'active') AS "activeLicenses"
    FROM public.products p
    LEFT JOIN public.orders o ON o.product_id = p.id
    GROUP BY p.id, p.name, p.slug, p.status
    ORDER BY COALESCE(SUM(o.amount_minor) FILTER (
      WHERE o.status = 'paid' 
        AND o.amount_minor > 0
        AND coalesce(o.provider_payment_id, '') NOT LIKE 'trial_%'
        AND coalesce(o.provider_payment_id, '') NOT LIKE 'gift_%'
        AND coalesce(o.provider_payment_id, '') NOT LIKE 'free_%'
    ), 0) DESC, "paidOrders" DESC
  ) x;

  -- Activity logs (last 20)
  SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json) INTO v_activity FROM (
    SELECT id, action, target_id AS target, created_at AS "createdAt"
    FROM private.audit_log
    ORDER BY created_at DESC LIMIT 20
  ) a;

  RETURN json_build_object(
    'items', v_activity,
    'metrics', json_build_object(
      'revenue', v_rev_30d,
      'revenueToday', v_rev_today,
      'salesToday', v_sales_today,
      'revenue7d', v_rev_7d,
      'sales7d', v_sales_7d,
      'revenue30d', v_rev_30d,
      'sales30d', v_sales_30d,
      'revenueAllTime', v_rev_all,
      'salesAllTime', v_sales_all,
      'trialsAllTime', v_trials_all,
      'activeLicenses', v_licenses,
      'recentSales', v_sales_30d,
      'totalCustomers', v_customers
    ),
    'leaderboard', v_leaderboard
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_analytics() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics() TO authenticated;

-- 6. Upgrade admin_list_orders() to classify 'trial', 'gift', 'free', and 'paid'
CREATE OR REPLACE FUNCTION public.admin_list_orders()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_items json;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json) INTO v_items FROM (
    SELECT 
      o.id,
      p.name AS product,
      p.slug AS "productSlug",
      COALESCE(pr.display_name, u.email, 'Customer') AS customer,
      u.email,
      o.amount_minor AS "amountMinor",
      o.currency,
      (o.currency || ' ' || TO_CHAR(o.amount_minor / 100.0, 'FM999999990.00')) AS amount,
      CASE 
        WHEN o.status = 'paid' AND (o.amount_minor = 0 OR coalesce(o.provider_payment_id, '') LIKE 'trial_%') THEN 'trial'
        WHEN o.status = 'paid' AND coalesce(o.provider_payment_id, '') LIKE 'gift_%' THEN 'gift'
        WHEN o.status = 'paid' AND coalesce(o.provider_payment_id, '') LIKE 'free_%' THEN 'free'
        ELSE o.status
      END AS status,
      o.status AS "rawStatus",
      o.provider_order_id AS "providerOrderId",
      o.provider_payment_id AS "providerPaymentId",
      o.created_at AS "createdAt",
      l.id AS "licenseId",
      l.key_suffix AS "licenseSuffix",
      l.status AS "licenseStatus"
    FROM public.orders o
    JOIN public.products p ON p.id = o.product_id
    JOIN auth.users u ON u.id = o.user_id
    LEFT JOIN public.profiles pr ON pr.id = o.user_id
    LEFT JOIN public.licenses l ON l.order_id = o.id
    ORDER BY o.created_at DESC
  ) x;

  RETURN json_build_object('items', v_items);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_orders() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_orders() TO authenticated;

-- 7. Upgrade admin_list_customers() to count actual paid commercial orders
CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_items json;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) INTO v_items FROM (
    SELECT 
      p.id,
      u.email,
      p.display_name AS name,
      p.suspended,
      CASE WHEN p.suspended THEN 'suspended' ELSE 'active' END AS status,
      p.created_at AS "createdAt",
      (SELECT COUNT(*) FROM public.orders o 
       WHERE o.user_id = p.id 
         AND o.status = 'paid' 
         AND o.amount_minor > 0 
         AND coalesce(o.provider_payment_id, '') NOT LIKE 'trial_%'
         AND coalesce(o.provider_payment_id, '') NOT LIKE 'gift_%'
         AND coalesce(o.provider_payment_id, '') NOT LIKE 'free_%') AS "orderCount",
      (SELECT COUNT(*) FROM public.licenses l WHERE l.user_id = p.id AND l.status = 'active') AS "activeLicenses",
      COALESCE((
        SELECT ROUND(SUM(o.amount_minor) / 100.0, 2)
        FROM public.orders o
        WHERE o.user_id = p.id 
          AND o.status = 'paid' 
          AND o.amount_minor > 0 
          AND coalesce(o.provider_payment_id, '') NOT LIKE 'trial_%'
          AND coalesce(o.provider_payment_id, '') NOT LIKE 'gift_%'
          AND coalesce(o.provider_payment_id, '') NOT LIKE 'free_%'
      ), 0.0) AS "totalSpent",
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', prod.id,
          'slug', prod.slug,
          'name', prod.name
        ))
        FROM (
          SELECT DISTINCT prod.id, prod.slug, prod.name
          FROM public.orders o
          JOIN public.products prod ON prod.id = o.product_id
          WHERE o.user_id = p.id 
            AND o.status = 'paid' 
            AND o.amount_minor > 0 
            AND coalesce(o.provider_payment_id, '') NOT LIKE 'trial_%'
            AND coalesce(o.provider_payment_id, '') NOT LIKE 'gift_%'
            AND coalesce(o.provider_payment_id, '') NOT LIKE 'free_%'
        ) prod
      ), '[]'::json) AS "purchasedProducts"
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE NOT EXISTS (SELECT 1 FROM public.staff_memberships s WHERE s.user_id = p.id)
    ORDER BY p.created_at DESC
  ) c;

  RETURN json_build_object('items', v_items);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_customers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_customers() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
