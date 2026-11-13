-- Phase 8: Dynamic Role Permissions, Comprehensive Administrative Audit Logging, and Support AI Stability
-- Migration: 071_audit_log_and_permissions.sql

-- 1. Ensure columns exist on private.audit_log
ALTER TABLE private.audit_log
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2. Enhanced log_action RPC supporting optional explicit actor_id for backend service workers
CREATE OR REPLACE FUNCTION public.log_action(
  p_action text,
  p_target_id text,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.audit_log (
    actor_id,
    action,
    target_id,
    reason,
    metadata,
    ip_address
  ) VALUES (
    coalesce(p_actor_id, auth.uid()),
    p_action,
    p_target_id,
    p_reason,
    p_metadata,
    p_ip_address
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_action(text, text, text, jsonb, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_action(text, text, text, jsonb, text, uuid) TO authenticated, service_role;

-- 3. Upgraded admin_list_activity returning actor email, metadata, and IP address for rich audit UI
CREATE OR REPLACE FUNCTION public.admin_list_activity()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_items json;
  v_emails json;
BEGIN
  -- Strict staff verification
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'support') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  SELECT coalesce(json_agg(row_to_json(x)), '[]'::json) INTO v_items FROM (
    SELECT
      a.id,
      coalesce(a.metadata->>'actorName', p.display_name, u.email, 'System') as actor,
      coalesce(a.metadata->>'actorEmail', u.email, '') as "actorEmail",
      a.action,
      a.target_id as target,
      a.reason,
      a.metadata,
      a.ip_address as "ipAddress",
      a.created_at as "createdAt"
    FROM private.audit_log a
    LEFT JOIN public.profiles p ON p.id = a.actor_id
    LEFT JOIN auth.users u ON u.id = a.actor_id
    ORDER BY a.created_at DESC
    LIMIT 500
  ) x;

  SELECT coalesce(json_agg(row_to_json(x)), '[]'::json) INTO v_emails FROM (
    SELECT
      id,
      kind,
      record_id as "orderId",
      case
        when completed_at is not null then 'completed'
        when attempts >= 5 then 'dead-letter'
        when attempts > 0 then 'retrying'
        else 'pending'
      end as status,
      due_at as "createdAt"
    FROM private.outbox
    ORDER BY due_at DESC
    LIMIT 100
  ) x;

  RETURN json_build_object('items', v_items, 'emails', v_emails);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_activity() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_activity() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
