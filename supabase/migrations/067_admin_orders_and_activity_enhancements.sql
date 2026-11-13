-- Migration 067: Admin Orders Telemetry and Product Quick Status RPCs
-- Enhances admin_list_orders() with product slug, linked license key suffix, and license status
-- Adds admin_set_product_status() RPC for rapid agent catalog status toggling

BEGIN;

-- 1. Upgrade admin_list_orders() with linked license telemetry
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
      o.status,
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

-- 2. New RPC: admin_set_product_status(p_product_id, p_status)
CREATE OR REPLACE FUNCTION public.admin_set_product_status(
  p_product_id uuid,
  p_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_name text;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'product_manager']);

  IF p_status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'Invalid status. Must be draft, published, or archived.';
  END IF;

  UPDATE public.products
  SET status = p_status, revision = revision + 1
  WHERE id = p_product_id
  RETURNING name INTO v_product_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  RETURN json_build_object('ok', true, 'id', p_product_id, 'name', v_product_name, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_product_status(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_status(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
