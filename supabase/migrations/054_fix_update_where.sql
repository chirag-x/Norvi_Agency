-- 054_fix_update_where.sql

CREATE OR REPLACE FUNCTION public.admin_update_settings(
  p_name text, p_company text, p_domain text, p_email text, p_headline text, p_description text,
  p_maintenance_mode boolean DEFAULT NULL, p_banner_text text DEFAULT NULL,
  p_sale_active boolean DEFAULT NULL, p_sale_percentage int DEFAULT NULL, p_sale_product_ids uuid[] DEFAULT '{}',
  p_social_instagram text DEFAULT NULL, p_social_youtube text DEFAULT NULL, p_social_facebook text DEFAULT NULL, p_social_twitter text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.require_staff(array['owner','administrator']);
  UPDATE public.site_settings SET
    name = coalesce(p_name, name),
    company = coalesce(p_company, company),
    domain = coalesce(p_domain, domain),
    email = coalesce(p_email, email),
    headline = coalesce(p_headline, headline),
    description = coalesce(p_description, description),
    maintenance_mode = coalesce(p_maintenance_mode, maintenance_mode),
    banner_text = coalesce(p_banner_text, banner_text),
    sale_active = coalesce(p_sale_active, sale_active),
    sale_percentage = coalesce(p_sale_percentage, sale_percentage),
    social_instagram = coalesce(p_social_instagram, social_instagram),
    social_youtube = coalesce(p_social_youtube, social_youtube),
    social_facebook = coalesce(p_social_facebook, social_facebook),
    social_twitter = coalesce(p_social_twitter, social_twitter),
    updated_at = now()
  WHERE id = 1;

  -- Add WHERE clause to satisfy safeupdate requirements
  UPDATE public.products SET is_on_sale = false WHERE is_on_sale = true;

  IF p_sale_active AND array_length(p_sale_product_ids, 1) > 0 THEN
    UPDATE public.products SET is_on_sale = true WHERE id = ANY(p_sale_product_ids);
  END IF;

  INSERT INTO private.audit_log(actor_id, action, target_id) VALUES(auth.uid(), 'settings.updated', '1');
END;
$$;
