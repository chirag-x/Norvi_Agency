-- 046_delete_product.sql

-- 1. Create the Smart Delete RPC
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_role text;
  v_sales_count int;
BEGIN
  -- Strict permission check
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Check if this product has active sales (orders or licenses)
  SELECT COUNT(*) INTO v_sales_count FROM public.licenses WHERE product_id = p_product_id;
  
  IF v_sales_count > 0 THEN
    -- Soft Delete: customers keep their licenses, but it disappears from admin and public UIs
    UPDATE public.products SET status = 'deleted' WHERE id = p_product_id;
    INSERT INTO private.audit_log (id, actor_id, action, target_id)
    VALUES (gen_random_uuid(), auth.uid(), 'Soft deleted product (has sales)', p_product_id::text);
  ELSE
    -- Hard Delete: wipe it cleanly
    DELETE FROM public.prices WHERE product_id = p_product_id;
    DELETE FROM public.products WHERE id = p_product_id;
    INSERT INTO private.audit_log (id, actor_id, action, target_id)
    VALUES (gen_random_uuid(), auth.uid(), 'Hard deleted product (no sales)', p_product_id::text);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(uuid) TO authenticated;

-- 2. Update admin_list_products to hide deleted products
CREATE OR REPLACE FUNCTION public.admin_list_products()
RETURNS json language plpgsql security definer set search_path='' as $$
declare v_items json; v_categories json;
begin
  perform private.require_staff(array['owner','administrator','product_manager']);
  select coalesce(json_agg(json_build_object(
    'id',p.id,'slug',p.slug,'name',p.name,'categoryId',p.category_id,
    'category',case when c.id is null then null else json_build_object('id',c.id,'slug',c.slug,'name',c.name) end,
    'tagline',p.tagline,'description',p.description,'price',p.price_label,
    'price1m',p.price_1m,'price3m',p.price_3m,'price_lifetime',p.price_lifetime,
    'status',p.status,
    'logoUrl',p.logo_url,'features',p.features,'version',p.version,'requirements',p.requirements,
    'releaseStatus',p.release_status,'workflowHeading',p.workflow_heading,
    'workflowDescription',p.workflow_description,'workflowMediaUrl',p.workflow_media_url,
    'workflowNote',p.workflow_note,'updatedAt',p.created_at,
    'is_on_sale',p.is_on_sale
  ) order by p.created_at), '[]'::json) into v_items
  from public.products p left join public.categories c on c.id=p.category_id
  WHERE p.status != 'deleted';
  select coalesce(json_agg(json_build_object('id',id,'slug',slug,'name',name,'createdAt',created_at) order by created_at),'[]'::json)
    into v_categories from public.categories;
  return json_build_object('items',v_items,'categories',v_categories);
end; $$;
GRANT EXECUTE ON FUNCTION public.admin_list_products() TO authenticated;
