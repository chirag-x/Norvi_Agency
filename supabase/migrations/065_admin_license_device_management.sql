-- Migration 065: Admin License & Device Management Upgrade
-- 1. Hardware ID visibility, individual unlinking, timed & lifetime bans, unban
-- 2. Customer self-release fix (clean delete to prevent unintended bans)
-- 3. Live per-license usage telemetry (AI & Groq STT counters, token costs, remaining limit)
-- 4. 1-day gift trial key support (24 hours)

BEGIN;

-- 1. Add ban duration and reason fields to public.devices
ALTER TABLE public.devices 
  ADD COLUMN IF NOT EXISTS banned_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ban_reason text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_devices_installation_id ON public.devices (installation_id);
CREATE INDEX IF NOT EXISTS idx_devices_banned_until ON public.devices (banned_until) WHERE banned_until IS NOT NULL;

-- Automatically unblock any devices that were locked out by the previous customer release bug
UPDATE public.devices
SET active = true
WHERE active = false AND banned_until IS NULL;

-- 2. Admin Ban Device (Supports 24h, 7d, 1m, lifetime)
CREATE OR REPLACE FUNCTION public.admin_ban_device(
  p_device_id uuid,
  p_duration text, -- '24h', '7d', '1m', 'lifetime'
  p_reason text DEFAULT 'Admin ban'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_until timestamptz;
  v_dev record;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator']);

  SELECT id, license_id, installation_id INTO v_dev
  FROM public.devices WHERE id = p_device_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Device not found.');
  END IF;

  IF p_duration = '24h' THEN
    v_until := now() + interval '24 hours';
  ELSIF p_duration = '7d' THEN
    v_until := now() + interval '7 days';
  ELSIF p_duration = '1m' THEN
    v_until := now() + interval '30 days';
  ELSIF p_duration = 'lifetime' THEN
    v_until := '9999-12-31 23:59:59+00'::timestamptz;
  ELSE
    RAISE EXCEPTION 'Invalid duration. Valid options are 24h, 7d, 1m, lifetime.';
  END IF;

  UPDATE public.devices
  SET active = false,
      banned_until = v_until,
      ban_reason = coalesce(nullif(trim(p_reason), ''), 'Admin ban')
  WHERE id = p_device_id;

  INSERT INTO private.audit_log(actor_id, action, target_id)
  VALUES (auth.uid(), 'device.banned', p_device_id::text || ' (' || p_duration || '): ' || v_dev.installation_id);

  RETURN jsonb_build_object(
    'ok', true,
    'device_id', p_device_id,
    'installation_id', v_dev.installation_id,
    'banned_until', v_until,
    'duration', p_duration
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ban_device(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_ban_device(uuid, text, text) TO authenticated;

-- 3. Admin Unban Device (Restores active state and clears timers)
CREATE OR REPLACE FUNCTION public.admin_unban_device(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dev record;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator']);

  SELECT id, license_id, installation_id INTO v_dev
  FROM public.devices WHERE id = p_device_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Device not found.');
  END IF;

  UPDATE public.devices
  SET active = true,
      banned_until = NULL,
      ban_reason = NULL
  WHERE id = p_device_id;

  INSERT INTO private.audit_log(actor_id, action, target_id)
  VALUES (auth.uid(), 'device.unbanned', p_device_id::text || ': ' || v_dev.installation_id);

  RETURN jsonb_build_object(
    'ok', true,
    'device_id', p_device_id,
    'installation_id', v_dev.installation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unban_device(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_unban_device(uuid) TO authenticated;

-- 4. Admin Remove Device (Cleans slot completely without banning)
CREATE OR REPLACE FUNCTION public.admin_remove_device(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dev record;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  SELECT id, license_id, installation_id INTO v_dev
  FROM public.devices WHERE id = p_device_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Device not found.');
  END IF;

  DELETE FROM public.devices WHERE id = p_device_id;

  INSERT INTO private.audit_log(actor_id, action, target_id)
  VALUES (auth.uid(), 'device.removed', p_device_id::text || ': ' || v_dev.installation_id);

  RETURN jsonb_build_object(
    'ok', true,
    'device_id', p_device_id,
    'installation_id', v_dev.installation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_device(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_device(uuid) TO authenticated;

-- 5. Customer Device Self-Release (Fixes bug by deleting row instead of marking inactive)
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

  -- 2. Release the device by deleting the row cleanly (frees slot without leaving a ban artifact)
  DELETE FROM public.devices 
  WHERE id = p_device_id AND license_id = p_license_id;

  -- 3. Log the action
  INSERT INTO private.audit_log(actor_id, action, target_id) 
  VALUES(auth.uid(), 'device.released', p_device_id::text);
END;
$$;

REVOKE ALL ON FUNCTION public.release_device(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_device(uuid, uuid) TO authenticated;

-- 6. Update activate_agent_license with timed ban awareness & auto-unban on expiration
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

  -- Strict User Verification (The key must belong to the logged-in email)
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
    -- Check if device has an active timed ban
    IF v_device.banned_until IS NOT NULL AND v_device.banned_until > now() THEN
      RETURN jsonb_build_object(
        'error',
        CASE 
          WHEN v_device.banned_until >= '9999-01-01'::timestamptz THEN 'This device has been permanently blocked by the administrator.'
          ELSE 'This device has been temporarily blocked until ' || to_char(v_device.banned_until AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC') || ' by administrator.'
        END
      );
    END IF;

    -- Check if device is banned with active=false (and ban is permanent or null)
    IF NOT v_device.active AND (v_device.banned_until IS NULL OR v_device.banned_until >= '9999-01-01'::timestamptz) THEN
      RETURN jsonb_build_object('error', 'This device has been blocked by the administrator.');
    END IF;

    -- If timed ban has expired, auto-unban and record last_seen
    IF v_device.banned_until IS NOT NULL AND v_device.banned_until <= now() THEN
      UPDATE public.devices 
      SET active = true, banned_until = NULL, ban_reason = NULL, last_seen_at = now() 
      WHERE id = v_device.id;
    ELSE
      UPDATE public.devices SET last_seen_at = now() WHERE id = v_device.id;
    END IF;
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

-- 7. Update private.verify_active_agent_license with timed ban checking & auto-unban
CREATE OR REPLACE FUNCTION private.verify_active_agent_license(
  p_license_id uuid,
  p_product_id uuid,
  p_device_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_license record;
  v_suspended boolean := false;
  v_device record;
  v_is_trial boolean := false;
BEGIN
  IF p_license_id IS NULL OR p_product_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_invalid',
      'error', 'License is invalid.'
    );
  END IF;

  SELECT id, user_id, product_id, order_id, status, expires_at
  INTO v_license
  FROM public.licenses
  WHERE id = p_license_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_invalid',
      'error', 'License is invalid.'
    );
  END IF;

  IF v_license.product_id <> p_product_id THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'product_mismatch',
      'error', 'License is not valid for this agent.'
    );
  END IF;

  IF v_license.status <> 'active' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_revoked',
      'error', 'This license has been deactivated or revoked.'
    );
  END IF;

  IF v_license.expires_at IS NOT NULL AND v_license.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_expired',
      'error', 'This license has expired.'
    );
  END IF;

  SELECT suspended INTO v_suspended
  FROM public.profiles
  WHERE id = v_license.user_id;

  IF coalesce(v_suspended, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'account_suspended',
      'error', 'This account is suspended.'
    );
  END IF;

  IF nullif(trim(coalesce(p_device_id, '')), '') IS NOT NULL THEN
    SELECT id, active, banned_until INTO v_device
    FROM public.devices
    WHERE license_id = v_license.id
      AND installation_id = trim(p_device_id);

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'status_code', 403,
        'reason', 'device_blocked',
        'error', 'This device is inactive or blocked.'
      );
    END IF;

    -- Check if device has an active timed ban
    IF v_device.banned_until IS NOT NULL AND v_device.banned_until > now() THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'status_code', 403,
        'reason', 'device_blocked',
        'error',
        CASE 
          WHEN v_device.banned_until >= '9999-01-01'::timestamptz THEN 'This device has been permanently blocked by administrator.'
          ELSE 'This device has been temporarily blocked until ' || to_char(v_device.banned_until AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC') || ' by administrator.'
        END
      );
    END IF;

    -- Check permanent ban or inactive without expired ban
    IF NOT v_device.active AND (v_device.banned_until IS NULL OR v_device.banned_until >= '9999-01-01'::timestamptz) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'status_code', 403,
        'reason', 'device_blocked',
        'error', 'This device has been blocked by administrator.'
      );
    END IF;
  END IF;

  v_is_trial := EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = v_license.order_id
      AND coalesce(o.provider_payment_id, '') LIKE 'trial_%'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.orders r
    WHERE r.user_id = v_license.user_id
      AND r.product_id = v_license.product_id
      AND r.status = 'paid'
      AND coalesce(r.provider_payment_id, '') NOT LIKE 'trial_%'
  );

  RETURN jsonb_build_object(
    'allowed', true,
    'license_id', v_license.id,
    'user_id', v_license.user_id,
    'is_trial', v_is_trial,
    'expires_at', v_license.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION private.verify_active_agent_license(uuid, uuid, text) FROM public, anon, authenticated;

-- 8. Update consume_agent_ai_quota with timed ban checking
CREATE OR REPLACE FUNCTION public.consume_agent_ai_quota(
  p_license_id uuid,
  p_product_id uuid,
  p_device_id text DEFAULT NULL,
  p_task_key text DEFAULT 'default'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_license record;
  v_suspended boolean := false;
  v_device record;
  v_policy record;
  v_has_policy boolean := false;
  v_task_key text;
  v_task_match jsonb;
  v_model text;
  v_sort text := 'latency';
  v_max_output_tokens integer := 2048;
  v_max_input_chars integer := 60000;
  v_enforce_zdr boolean := true;
  v_allow_vision boolean := true;
  v_is_trial boolean := false;
  v_effective_daily integer := 0;
  v_day_count integer := 0;
  v_week_count integer := 0;
  v_month_count integer := 0;
  v_usage_log_id bigint;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_license_id IS NULL OR p_product_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_invalid',
      'error', 'License is invalid.'
    );
  END IF;

  -- Serialize concurrent requests for the same license to prevent quota races
  PERFORM pg_advisory_xact_lock(hashtext(p_license_id::text));

  SELECT id, user_id, product_id, order_id, status, expires_at
  INTO v_license
  FROM public.licenses
  WHERE id = p_license_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_invalid',
      'error', 'License is invalid.'
    );
  END IF;

  IF v_license.product_id <> p_product_id THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'product_mismatch',
      'error', 'License is not valid for this agent.'
    );
  END IF;

  IF v_license.status <> 'active' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_revoked',
      'error', 'This license has been deactivated or revoked.'
    );
  END IF;

  IF v_license.expires_at IS NOT NULL AND v_license.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_expired',
      'error', 'This license has expired.'
    );
  END IF;

  SELECT suspended INTO v_suspended
  FROM public.profiles
  WHERE id = v_license.user_id;

  IF coalesce(v_suspended, false) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'account_suspended',
      'error', 'This account is suspended.'
    );
  END IF;

  IF nullif(trim(coalesce(p_device_id, '')), '') IS NOT NULL THEN
    SELECT id, active, banned_until INTO v_device
    FROM public.devices
    WHERE license_id = v_license.id
      AND installation_id = trim(p_device_id);

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'status_code', 403,
        'reason', 'device_blocked',
        'error', 'This device is inactive or blocked.'
      );
    END IF;

    -- Check if device has an active timed ban
    IF v_device.banned_until IS NOT NULL AND v_device.banned_until > now() THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'status_code', 403,
        'reason', 'device_blocked',
        'error',
        CASE 
          WHEN v_device.banned_until >= '9999-01-01'::timestamptz THEN 'This device has been permanently blocked by administrator.'
          ELSE 'This device has been temporarily blocked until ' || to_char(v_device.banned_until AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC') || ' by administrator.'
        END
      );
    END IF;

    -- Check permanent ban or inactive without expired ban
    IF NOT v_device.active AND (v_device.banned_until IS NULL OR v_device.banned_until >= '9999-01-01'::timestamptz) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'status_code', 403,
        'reason', 'device_blocked',
        'error', 'This device is inactive or blocked.'
      );
    END IF;
  END IF;

  -- Load agent AI policy (fallback safely to defaults if unconfigured)
  SELECT * INTO v_policy
  FROM public.agent_ai_policies
  WHERE product_id = p_product_id;

  v_has_policy := FOUND;

  IF v_has_policy AND NOT v_policy.ai_enabled THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'ai_disabled',
      'error', 'Cloud AI is currently disabled for this agent.'
    );
  END IF;

  v_task_key := lower(trim(coalesce(p_task_key, 'default')));
  IF v_task_key = '' THEN
    v_task_key := 'default';
  END IF;

  IF v_has_policy THEN
    v_model := v_policy.default_model;
    v_max_input_chars := v_policy.max_input_chars;
    v_max_output_tokens := v_policy.max_output_tokens;
    v_enforce_zdr := v_policy.enforce_zdr;

    SELECT elem INTO v_task_match
    FROM jsonb_array_elements(coalesce(v_policy.task_models, '[]'::jsonb)) AS elem
    WHERE lower(coalesce(elem->>'task_key', '')) = v_task_key
      AND nullif(trim(coalesce(elem->>'model', '')), '') IS NOT NULL
    LIMIT 1;

    IF v_task_match IS NOT NULL THEN
      v_model := trim(v_task_match->>'model');
      IF lower(coalesce(v_task_match->>'sort', '')) IN ('latency', 'price') THEN
        v_sort := lower(v_task_match->>'sort');
      END IF;
      IF coalesce(v_task_match->>'max_output_tokens', '') ~ '^\d+$' THEN
        v_max_output_tokens := greatest(64, least(32768, (v_task_match->>'max_output_tokens')::integer));
      END IF;
      IF v_task_match ? 'allow_vision' THEN
        v_allow_vision := coalesce((v_task_match->>'allow_vision')::boolean, true);
      END IF;
    END IF;
  ELSE
    v_model := 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  END IF;

  v_is_trial := EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = v_license.order_id
      AND coalesce(o.provider_payment_id, '') LIKE 'trial_%'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.orders r
    WHERE r.user_id = v_license.user_id
      AND r.product_id = v_license.product_id
      AND r.status = 'paid'
      AND coalesce(r.provider_payment_id, '') NOT LIKE 'trial_%'
  );

  IF v_has_policy THEN
    IF v_is_trial AND v_policy.trial_daily_limit > 0 THEN
      v_effective_daily := v_policy.trial_daily_limit;
    ELSE
      v_effective_daily := coalesce(v_policy.daily_limit, 0);
    END IF;

    IF v_effective_daily > 0 OR v_policy.weekly_limit > 0 OR v_policy.monthly_limit > 0 THEN
      SELECT
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
        count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
        count(*)
      INTO v_day_count, v_week_count, v_month_count
      FROM public.agent_ai_usage_logs
      WHERE license_id = v_license.id
        AND status IN ('reserved', 'completed')
        AND created_at >= now() - interval '30 days';

      IF (v_effective_daily > 0 AND v_day_count >= v_effective_daily)
         OR (v_policy.weekly_limit > 0 AND v_week_count >= v_policy.weekly_limit)
         OR (v_policy.monthly_limit > 0 AND v_month_count >= v_policy.monthly_limit)
      THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 429,
          'reason', 'cooldown',
          'error', 'Temporary AI cooldown active due to high usage. Please try again later.'
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.agent_ai_usage_logs (license_id, product_id, device_id, task_key, model_used, status)
  VALUES (v_license.id, p_product_id, nullif(trim(coalesce(p_device_id, '')), ''), v_task_key, v_model, 'reserved')
  RETURNING id INTO v_usage_log_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'usage_log_id', v_usage_log_id,
    'model', v_model,
    'sort', v_sort,
    'max_input_chars', v_max_input_chars,
    'max_output_tokens', v_max_output_tokens,
    'enforce_zdr', v_enforce_zdr,
    'allow_vision', v_allow_vision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) TO service_role;

-- 9. Update admin_gift_license to support 1-day gift trial keys
CREATE OR REPLACE FUNCTION public.admin_gift_license(
  p_email text,
  p_product_slug text,
  p_encryption_secret text,
  p_duration text DEFAULT 'lifetime'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role          text;
  v_user_id       uuid;
  v_product_id    uuid;
  v_order_id      uuid;
  v_license_id    uuid;
  v_raw_key       text;
  v_key_hash      text;
  v_encrypted_key text;
  v_interval      interval;
BEGIN
  -- 0. Permission check
  SELECT role INTO v_role
  FROM public.staff_memberships
  WHERE user_id = auth.uid() AND active = true;

  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  -- 1. Find user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Account with this email does not exist. They must register first.';
  END IF;

  -- 2. Find product by slug
  SELECT id INTO v_product_id FROM public.products WHERE slug = p_product_slug;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  -- Determine the time interval for the gift
  IF p_duration = '1_day' OR p_duration = '24h' THEN
    v_interval := interval '24 hours';
  ELSIF p_duration = '1_month' THEN
    v_interval := interval '1 month';
  ELSIF p_duration = '3_months' THEN
    v_interval := interval '3 months';
  ELSE
    v_interval := NULL; -- lifetime
  END IF;

  -- 3. Create a paid gift order with amount 0
  INSERT INTO public.orders (
    user_id, product_id, status,
    amount_minor, currency, provider_payment_id, idempotency_key, duration
  )
  VALUES (
    v_user_id, v_product_id, 'paid',
    0, 'USD',
    'gift_' || substr(md5(random()::text), 1, 10),
    'gift_' || substr(md5(random()::text), 1, 10),
    p_duration
  )
  RETURNING id INTO v_order_id;

  -- 4. Generate the license key
  v_license_id := gen_random_uuid();
  v_raw_key := 'NORVI-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4)) || '-' ||
    upper(substring(md5(random()::text) FROM 1 FOR 4));

  v_key_hash      := encode(extensions.digest(v_raw_key, 'sha256'), 'hex');
  v_encrypted_key := extensions.pgp_sym_encrypt(v_raw_key, p_encryption_secret);

  -- 5. Insert the license record
  INSERT INTO public.licenses (id, user_id, product_id, order_id, status, key_suffix, max_devices, expires_at)
  VALUES (v_license_id, v_user_id, v_product_id, v_order_id, 'active', right(v_raw_key, 4), 3, CASE WHEN v_interval IS NOT NULL THEN now() + v_interval ELSE NULL END);

  INSERT INTO private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  VALUES (v_license_id, v_key_hash, v_encrypted_key, 1);

  -- 6. Audit log
  INSERT INTO private.audit_log (actor_id, action, target_id)
  VALUES (auth.uid(), 'license.gifted', v_license_id::text || ' to ' || p_email || ' (' || p_duration || ')');

  RETURN v_license_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_gift_license(text, text, text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_gift_license(text, text, text, text) TO authenticated;

-- 10. Admin Get License Telemetry (Live quota tracker, HWID devices, token spend, recent logs)
CREATE OR REPLACE FUNCTION public.admin_get_license_telemetry(p_license_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lic RECORD;
  v_policy RECORD;
  v_ai_24h integer := 0;
  v_ai_7d integer := 0;
  v_ai_30d integer := 0;
  v_ai_tokens bigint := 0;
  v_ai_cost numeric := 0;
  v_stt_24h integer := 0;
  v_stt_7d integer := 0;
  v_stt_30d integer := 0;
  v_devices jsonb := '[]'::jsonb;
  v_recent_ai jsonb := '[]'::jsonb;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  SELECT l.id, l.user_id, l.product_id, l.status, l.expires_at, l.max_devices
  INTO v_lic FROM public.licenses l WHERE l.id = p_license_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'License not found');
  END IF;

  SELECT * INTO v_policy FROM public.agent_ai_policies WHERE product_id = v_lic.product_id;

  -- AI usage counts
  SELECT COUNT(*) INTO v_ai_24h FROM public.agent_ai_usage_logs
  WHERE license_id = p_license_id AND status IN ('reserved', 'completed') AND created_at >= (now() - interval '24 hours');

  SELECT COUNT(*) INTO v_ai_7d FROM public.agent_ai_usage_logs
  WHERE license_id = p_license_id AND status IN ('reserved', 'completed') AND created_at >= (now() - interval '7 days');

  SELECT COUNT(*) INTO v_ai_30d FROM public.agent_ai_usage_logs
  WHERE license_id = p_license_id AND status IN ('reserved', 'completed') AND created_at >= (now() - interval '30 days');

  SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0), COALESCE(SUM(estimated_cost_usd), 0)
  INTO v_ai_tokens, v_ai_cost FROM public.agent_ai_usage_logs
  WHERE license_id = p_license_id AND status = 'completed';

  -- STT usage counts
  SELECT COUNT(*) INTO v_stt_24h FROM public.agent_stt_usage_logs
  WHERE license_id = p_license_id AND status IN ('reserved', 'completed') AND created_at >= (now() - interval '24 hours');

  SELECT COUNT(*) INTO v_stt_7d FROM public.agent_stt_usage_logs
  WHERE license_id = p_license_id AND status IN ('reserved', 'completed') AND created_at >= (now() - interval '7 days');

  SELECT COUNT(*) INTO v_stt_30d FROM public.agent_stt_usage_logs
  WHERE license_id = p_license_id AND status IN ('reserved', 'completed') AND created_at >= (now() - interval '30 days');

  -- Devices with ban expiration checking
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'installation_id', d.installation_id,
    'active', d.active,
    'last_seen_at', d.last_seen_at,
    'banned_until', d.banned_until,
    'is_banned', (NOT d.active OR (d.banned_until IS NOT NULL AND d.banned_until > now())),
    'ban_reason', d.ban_reason
  )), '[]'::jsonb) INTO v_devices
  FROM public.devices d WHERE d.license_id = p_license_id;

  -- Recent 10 prompt turns
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'task_key', u.task_key,
    'model_used', u.model_used,
    'prompt_tokens', u.prompt_tokens,
    'completion_tokens', u.completion_tokens,
    'cost_usd', ROUND(u.estimated_cost_usd, 6),
    'status', u.status,
    'created_at', u.created_at
  )), '[]'::jsonb) INTO v_recent_ai
  FROM (
    SELECT * FROM public.agent_ai_usage_logs
    WHERE license_id = p_license_id
    ORDER BY created_at DESC LIMIT 10
  ) u;

  RETURN jsonb_build_object(
    'license_id', p_license_id,
    'devices', v_devices,
    'ai', jsonb_build_object(
      'used_24h', v_ai_24h,
      'limit_24h', COALESCE(v_policy.daily_limit, 0),
      'left_24h', CASE WHEN COALESCE(v_policy.daily_limit, 0) = 0 THEN -1 ELSE GREATEST(0, v_policy.daily_limit - v_ai_24h) END,
      'used_7d', v_ai_7d,
      'limit_7d', COALESCE(v_policy.weekly_limit, 0),
      'left_7d', CASE WHEN COALESCE(v_policy.weekly_limit, 0) = 0 THEN -1 ELSE GREATEST(0, v_policy.weekly_limit - v_ai_7d) END,
      'used_30d', v_ai_30d,
      'limit_30d', COALESCE(v_policy.monthly_limit, 0),
      'left_30d', CASE WHEN COALESCE(v_policy.monthly_limit, 0) = 0 THEN -1 ELSE GREATEST(0, v_policy.monthly_limit - v_ai_30d) END,
      'total_tokens', v_ai_tokens,
      'total_cost_usd', ROUND(v_ai_cost, 4)
    ),
    'stt', jsonb_build_object(
      'used_24h', v_stt_24h,
      'limit_24h', COALESCE(v_policy.stt_daily_limit, 0),
      'left_24h', CASE WHEN COALESCE(v_policy.stt_daily_limit, 0) = 0 THEN -1 ELSE GREATEST(0, v_policy.stt_daily_limit - v_stt_24h) END,
      'used_7d', v_stt_7d,
      'limit_7d', COALESCE(v_policy.stt_weekly_limit, 0),
      'left_7d', CASE WHEN COALESCE(v_policy.stt_weekly_limit, 0) = 0 THEN -1 ELSE GREATEST(0, v_policy.stt_weekly_limit - v_stt_7d) END,
      'used_30d', v_stt_30d,
      'limit_30d', COALESCE(v_policy.stt_monthly_limit, 0),
      'left_30d', CASE WHEN COALESCE(v_policy.stt_monthly_limit, 0) = 0 THEN -1 ELSE GREATEST(0, v_policy.stt_monthly_limit - v_stt_30d) END
    ),
    'recent_logs', v_recent_ai
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_license_telemetry(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_license_telemetry(uuid) TO authenticated;

-- 11. Update admin_list_licenses to include customer email, product slug, expiration and devices list
CREATE OR REPLACE FUNCTION public.admin_list_licenses()
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
      l.id,
      p.name AS product,
      p.slug AS "productSlug",
      COALESCE(pr.display_name, u.email) AS customer,
      u.email,
      l.status,
      l.key_suffix AS suffix,
      l.max_devices AS "maxDevices",
      l.expires_at AS "expiresAt",
      EXISTS(SELECT 1 FROM public.devices d WHERE d.license_id = l.id AND d.active) AS device,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', d.id,
          'installation_id', d.installation_id,
          'active', d.active,
          'last_seen_at', d.last_seen_at,
          'banned_until', d.banned_until,
          'ban_reason', d.ban_reason,
          'is_banned', (NOT d.active OR (d.banned_until IS NOT NULL AND d.banned_until > now()))
        )), '[]'::json)
        FROM public.devices d 
        WHERE d.license_id = l.id
      ) AS devices,
      l.created_at AS "createdAt"
    FROM public.licenses l 
    JOIN public.products p ON p.id = l.product_id
    JOIN auth.users u ON u.id = l.user_id 
    LEFT JOIN public.profiles pr ON pr.id = l.user_id 
    ORDER BY l.created_at DESC
  ) x;

  RETURN json_build_object('items', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_licenses() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_licenses() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
