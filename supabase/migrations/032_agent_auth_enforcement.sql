-- Migration 032: Enforce User Ownership for Agent Licensing

CREATE OR REPLACE FUNCTION public.activate_agent_license(
  p_key_hash text,
  p_product_id uuid,
  p_device_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_license record;
  v_device record;
  v_active_devices integer;
BEGIN
  -- Strict Phase 10 Anti-Piracy Check: The user must be authenticated.
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'You must be logged in to activate an agent.');
  END IF;

  SELECT l.id, l.status, l.expires_at, l.max_devices, l.user_id, l.key_version 
  INTO v_license
  FROM private.license_secrets ls
  JOIN public.licenses l ON l.id = ls.license_id
  WHERE ls.key_hash = p_key_hash AND l.product_id = p_product_id;

  IF NOT FOUND THEN 
    RETURN jsonb_build_object('error', 'License key is invalid or for a different agent.'); 
  END IF;

  -- Phase 10: Strict User Verification (The key must belong to the logged-in email)
  IF v_license.user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'This activation key does not belong to your account.');
  END IF;

  IF v_license.status != 'active' THEN 
    RETURN jsonb_build_object('error', 'This license has been revoked.'); 
  END IF;

  IF v_license.expires_at IS NOT NULL AND v_license.expires_at < now() THEN 
    RETURN jsonb_build_object('error', 'This license has expired.'); 
  END IF;

  SELECT * INTO v_device FROM public.devices WHERE license_id = v_license.id AND installation_id = p_device_id;

  IF FOUND THEN
    IF NOT v_device.active THEN 
      RETURN jsonb_build_object('error', 'This device has been blocked by the administrator.'); 
    END IF;
    UPDATE public.devices SET last_seen_at = now() WHERE id = v_device.id;
  ELSE
    SELECT count(*) INTO v_active_devices FROM public.devices WHERE license_id = v_license.id AND active = true;
    IF v_active_devices >= v_license.max_devices THEN 
      RETURN jsonb_build_object('error', 'Device limit reached. Revoke an old device in your dashboard first.'); 
    END IF;
    INSERT INTO public.devices (license_id, installation_id) VALUES (v_license.id, p_device_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'license_id', v_license.id,
    'device_id', p_device_id,
    'version', v_license.key_version,
    'expires_at', v_license.expires_at,
    'max_devices', v_license.max_devices
  );
END;
$$;
REVOKE ALL ON FUNCTION public.activate_agent_license(text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.activate_agent_license(text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
