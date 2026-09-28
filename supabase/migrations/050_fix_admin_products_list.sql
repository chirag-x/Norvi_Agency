-- 050_fix_admin_products_list.sql
-- Fixes the JSON key returned by admin_list_products from 'products' to 'items' so the admin frontend maps it correctly.
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
    'is_on_sale',p.is_on_sale,
    'aiUsage',p.ai_usage, 'deviceAllowance',p.device_allowance
  ) order by p.created_at), '[]'::json) into v_items
  from public.products p left join public.categories c on c.id=p.category_id
  WHERE p.status != 'deleted';
  
  select coalesce(json_agg(json_build_object('id',id,'slug',slug,'name',name,'createdAt',created_at) order by created_at),'[]'::json)
    into v_categories from public.categories;
    
  return json_build_object('items', v_items, 'categories', v_categories);
end;
$$;
