-- 055_customer_device_release.sql

CREATE OR REPLACE FUNCTION public.release_device(p_device_id uuid, p_license_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- 1. Verify the license belongs to the currently authenticated user
  SELECT user_id INTO v_user_id FROM public.licenses WHERE id = p_license_id;
  
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Permission denied or license not found.';
  END IF;

  -- 2. Release the device by marking it inactive
  UPDATE public.devices 
  SET active = false 
  WHERE id = p_device_id AND license_id = p_license_id;

  -- 3. Log the action
  INSERT INTO private.audit_log(actor_id, action, target_id) 
  VALUES(auth.uid(), 'device.released', p_device_id::text);
END;
$$;

REVOKE ALL ON FUNCTION public.release_device(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_device(uuid, uuid) TO authenticated;
