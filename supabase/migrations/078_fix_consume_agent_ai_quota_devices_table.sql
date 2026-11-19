-- Migration 078: Fix consume_agent_ai_quota() table reference (public.devices instead of public.license_devices)

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
  v_device record;
  v_policy public.agent_ai_policies%ROWTYPE;
  v_has_policy boolean := false;
  v_task_key text;
  v_model text;
  v_sort text := 'latency';
  v_max_input_chars integer := 60000;
  v_max_output_tokens integer := 2048;
  v_enforce_zdr boolean := true;
  v_allow_vision boolean := true;
  v_is_trial boolean := false;
  v_effective_daily integer := 0;
  v_day_count integer := 0;
  v_week_count integer := 0;
  v_month_count integer := 0;
  v_task_match jsonb;
  v_usage_log_id bigint;
  v_effective_key_id uuid := NULL;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'forbidden',
      'error', 'Unauthorized service role.'
    );
  END IF;

  SELECT * INTO v_license
  FROM public.licenses
  WHERE id = p_license_id
    AND product_id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 404,
      'reason', 'license_not_found',
      'error', 'License could not be verified for this agent.'
    );
  END IF;

  IF v_license.status <> 'active' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_revoked',
      'error', 'License is revoked or suspended.'
    );
  END IF;

  IF v_license.expires_at IS NOT NULL AND v_license.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status_code', 403,
      'reason', 'license_expired',
      'error', 'License has expired.'
    );
  END IF;

  -- Device verification if device_id provided (queries public.devices)
  IF nullif(trim(coalesce(p_device_id, '')), '') IS NOT NULL THEN
    SELECT * INTO v_device
    FROM public.devices
    WHERE license_id = p_license_id
      AND installation_id = trim(p_device_id);

    IF FOUND THEN
      IF v_device.banned_until IS NOT NULL AND v_device.banned_until > now() THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 403,
          'reason', 'device_banned',
          'error', CASE
            WHEN v_device.banned_until >= '9999-01-01'::timestamptz THEN 'This machine has been permanently blocked by administrator.'
            ELSE 'This device has been temporarily blocked until ' || to_char(v_device.banned_until AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC') || ' by administrator.'
          END
        );
      END IF;

      IF NOT v_device.active AND (v_device.banned_until IS NULL OR v_device.banned_until >= '9999-01-01'::timestamptz) THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 403,
          'reason', 'device_blocked',
          'error', 'This device is inactive or blocked.'
        );
      END IF;
    END IF;
  END IF;

  -- Load agent AI policy
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

  -- Determine if trial license
  v_is_trial := coalesce(v_license.is_trial, false) OR EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = v_license.order_id
      AND coalesce(o.provider_payment_id, '') LIKE 'trial_%'
  );

  IF v_has_policy THEN
    v_max_input_chars := v_policy.max_input_chars;
    v_max_output_tokens := v_policy.max_output_tokens;
    v_enforce_zdr := v_policy.enforce_zdr;

    IF v_is_trial THEN
      -- Free Trial Tier: Use single trial model for all tasks, trial key, and trial ZDR policy
      v_model := coalesce(nullif(trim(v_policy.trial_default_model), ''), 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free');
      v_effective_key_id := coalesce(v_policy.trial_ai_key_id, v_policy.ai_key_id);
      v_effective_daily := coalesce(v_policy.trial_daily_limit, 50);
      v_enforce_zdr := coalesce(v_policy.trial_enforce_zdr, false);
    ELSE
      -- Paid Customer Tier: Use task-specific models, paid key, and paid ZDR policy
      v_model := v_policy.default_model;
      v_effective_key_id := v_policy.ai_key_id;
      v_effective_daily := coalesce(v_policy.daily_limit, 0);
      v_enforce_zdr := coalesce(v_policy.enforce_zdr, true);

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
    END IF;
  ELSE
    v_model := 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
    v_effective_daily := 50;
  END IF;

  -- Rate limit verification
  IF v_has_policy THEN
    IF v_effective_daily > 0 OR (NOT v_is_trial AND (v_policy.weekly_limit > 0 OR v_policy.monthly_limit > 0)) THEN
      SELECT
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
        count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
        count(*)
      INTO v_day_count, v_week_count, v_month_count
      FROM public.agent_ai_usage_logs
      WHERE license_id = v_license.id
        AND status IN ('reserved', 'completed')
        AND created_at >= now() - interval '30 days';

      IF (v_effective_daily > 0 AND v_day_count >= v_effective_daily) THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 429,
          'reason', 'cooldown',
          'error', CASE 
            WHEN v_is_trial THEN 'Daily free trial AI limit reached. Upgrade to a paid plan for higher limits and specialized models.'
            ELSE 'Temporary AI cooldown active due to high daily usage. Please try again later.'
          END
        );
      END IF;

      IF NOT v_is_trial AND ((v_policy.weekly_limit > 0 AND v_week_count >= v_policy.weekly_limit) OR (v_policy.monthly_limit > 0 AND v_month_count >= v_policy.monthly_limit)) THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'status_code', 429,
          'reason', 'cooldown',
          'error', 'Temporary AI cooldown active due to high usage. Please try again later.'
        );
      END IF;
    END IF;
  END IF;

  -- Record usage reservation with is_trial flag
  INSERT INTO public.agent_ai_usage_logs (license_id, product_id, device_id, task_key, model_used, status, is_trial)
  VALUES (v_license.id, p_product_id, nullif(trim(coalesce(p_device_id, '')), ''), v_task_key, v_model, 'reserved', v_is_trial)
  RETURNING id INTO v_usage_log_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'usage_log_id', v_usage_log_id,
    'model', v_model,
    'sort', v_sort,
    'max_input_chars', v_max_input_chars,
    'max_output_tokens', v_max_output_tokens,
    'enforce_zdr', v_enforce_zdr,
    'allow_vision', v_allow_vision,
    'ai_key_id', v_effective_key_id,
    'is_trial', v_is_trial
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_ai_quota(uuid, uuid, text, text) TO service_role;
