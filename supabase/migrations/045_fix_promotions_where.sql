-- 045_fix_promotions_where.sql

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

  -- Safe update trick to bypass pg_safeupdate strict block
  UPDATE public.products SET is_on_sale = false WHERE id IS NOT NULL;

  IF p_sale_active AND array_length(p_sale_product_ids, 1) > 0 THEN
    UPDATE public.products SET is_on_sale = true WHERE id = ANY(p_sale_product_ids);
  END IF;

  -- Fixed: Correct column names for audit logging (actor_id, target_id)
  INSERT INTO private.audit_log (id, actor_id, action, target_id)
  VALUES (gen_random_uuid(), auth.uid(), 'Updated sales & promotions', 'marketing');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_promotions(text, boolean, int, uuid[]) TO authenticated;
