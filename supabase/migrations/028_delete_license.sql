-- Migration 028: Add delete license capability

CREATE OR REPLACE FUNCTION public.admin_delete_license(p_license_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator') THEN
    RAISE EXCEPTION 'Permission denied. Only owners and administrators can permanently delete licenses.';
  END IF;

  -- Delete from dependent tables first (no CASCADE on foreign keys)
  DELETE FROM public.devices WHERE license_id = p_license_id;
  DELETE FROM private.license_secrets WHERE license_id = p_license_id;
  
  -- Delete the license
  DELETE FROM public.licenses WHERE id = p_license_id;

  INSERT INTO private.audit_log(actor_id, action, target_id) VALUES(auth.uid(), 'license.deleted', p_license_id::text);
END;
$$;

NOTIFY pgrst, 'reload schema';
