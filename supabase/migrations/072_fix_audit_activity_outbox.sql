-- Fix for admin_list_activity RPC reading private.outbox schema correctly
-- Migration: 072_fix_audit_activity_outbox.sql

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
