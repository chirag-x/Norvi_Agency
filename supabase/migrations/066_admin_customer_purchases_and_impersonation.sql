-- Migration 066: Customer Purchases Telemetry and Order Receipts
-- Adds detailed purchase telemetry (total spend, purchased agents) to admin_list_customers()
-- Adds admin_get_customer_orders() RPC for customer receipt breakdowns

BEGIN;

-- 1. Upgrade admin_list_customers() to include totalSpent and purchasedProducts array
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

  SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json) INTO v_items FROM (
    SELECT 
      p.id,
      u.email,
      p.display_name AS name,
      p.suspended,
      CASE WHEN p.suspended THEN 'suspended' ELSE 'active' END AS status,
      p.created_at AS "createdAt",
      (SELECT COUNT(*) FROM public.orders o WHERE o.user_id = p.id AND o.status = 'paid') AS "orderCount",
      (SELECT COUNT(*) FROM public.licenses l WHERE l.user_id = p.id AND l.status = 'active') AS "activeLicenses",
      COALESCE((
        SELECT ROUND(SUM(o.amount_minor) / 100.0, 2)
        FROM public.orders o
        WHERE o.user_id = p.id AND o.status = 'paid'
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
          WHERE o.user_id = p.id AND o.status = 'paid'
        ) prod
      ), '[]'::json) AS "purchasedProducts"
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE NOT EXISTS (SELECT 1 FROM public.staff_memberships s WHERE s.user_id = p.id)
    ORDER BY p.created_at DESC
  ) x;

  RETURN json_build_object('items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_customers() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_customers() TO authenticated;


-- 2. New RPC: admin_get_customer_orders(p_customer_id)
-- Returns rich order history with provider payment ID, duration, and license key suffix
CREATE OR REPLACE FUNCTION public.admin_get_customer_orders(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_orders json;
  v_customer RECORD;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  SELECT p.id, p.display_name AS name, u.email
  INTO v_customer
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_customer_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Customer not found');
  END IF;

  SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json) INTO v_orders FROM (
    SELECT 
      o.id,
      p.name AS product,
      p.slug AS "productSlug",
      o.amount_minor AS "amountMinor",
      o.currency,
      (o.currency || ' ' || TO_CHAR(o.amount_minor / 100.0, 'FM999999990.00')) AS amount,
      o.status,
      o.provider_order_id AS "providerOrderId",
      o.provider_payment_id AS "providerPaymentId",
      o.created_at AS "createdAt",
      l.id AS "licenseId",
      l.key_suffix AS "licenseSuffix",
      l.expires_at AS "licenseExpiresAt",
      l.status AS "licenseStatus"
    FROM public.orders o
    JOIN public.products p ON p.id = o.product_id
    LEFT JOIN public.licenses l ON l.order_id = o.id
    WHERE o.user_id = p_customer_id
    ORDER BY o.created_at DESC
  ) x;

  RETURN json_build_object(
    'customerId', p_customer_id,
    'customerName', v_customer.name,
    'customerEmail', v_customer.email,
    'orders', v_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_customer_orders(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_customer_orders(uuid) TO authenticated;


-- 3. New RPC: admin_delete_customer(p_customer_id)
-- Permanently deletes a customer account and all dependent records from the server
CREATE OR REPLACE FUNCTION public.admin_delete_customer(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_customer_email text;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator']);

  -- Cannot delete yourself
  IF p_customer_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account from the customers tab.';
  END IF;

  -- Cannot delete staff members
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = p_customer_id;
  IF v_role IS NOT NULL THEN
    RAISE EXCEPTION 'Staff accounts cannot be deleted here. Remove their staff role first.';
  END IF;

  -- Look up email for response/audit
  SELECT email INTO v_customer_email FROM auth.users WHERE id = p_customer_id;
  IF v_customer_email IS NULL THEN
    RAISE EXCEPTION 'Customer account not found.';
  END IF;

  -- Delete dependent records
  DELETE FROM public.support_requests WHERE user_id = p_customer_id;
  UPDATE private.audit_log SET actor_id = NULL WHERE actor_id = p_customer_id;
  DELETE FROM public.devices WHERE license_id IN (SELECT id FROM public.licenses WHERE user_id = p_customer_id);
  DELETE FROM private.license_secrets WHERE license_id IN (SELECT id FROM public.licenses WHERE user_id = p_customer_id);
  DELETE FROM public.licenses WHERE user_id = p_customer_id;
  DELETE FROM public.orders WHERE user_id = p_customer_id;
  DELETE FROM public.profiles WHERE id = p_customer_id;
  DELETE FROM auth.users WHERE id = p_customer_id;

  RETURN json_build_object('ok', true, 'customerId', p_customer_id, 'email', v_customer_email);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_customer(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_customer(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
