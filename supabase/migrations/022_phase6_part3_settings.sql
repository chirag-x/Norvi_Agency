-- 022_phase6_part3_settings.sql

-- Add Dynamic Role Permissions and Maintenance Mode to site_settings
ALTER TABLE public.site_settings
ADD COLUMN permissions JSONB DEFAULT '{"support": ["/customers", "/licenses", "/orders"], "product_manager": ["/products", "/content"], "administrator": ["/products", "/customers", "/licenses", "/orders", "/subscriptions", "/team", "/content", "/settings", "/activity"]}'::jsonb,
ADD COLUMN maintenance_mode BOOLEAN NOT NULL DEFAULT false;

-- Update the RPC to allow modifying these advanced settings
CREATE OR REPLACE FUNCTION public.admin_update_advanced_settings(
  p_maintenance_mode BOOLEAN,
  p_permissions JSONB
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_role text;
BEGIN
  -- 1. Check permissions (Owner only for advanced settings)
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_role != 'owner' THEN
    RAISE EXCEPTION 'Owner permission required.';
  END IF;

  -- 2. Update settings
  UPDATE public.site_settings SET
    maintenance_mode = p_maintenance_mode,
    permissions = p_permissions,
    updated_at = now()
  WHERE id = 1;

  -- 3. Log the action
  INSERT INTO public.audit_log (id, user_id, action, target)
  VALUES (gen_random_uuid(), auth.uid(), 'Updated advanced settings', 'global');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_advanced_settings TO authenticated;
