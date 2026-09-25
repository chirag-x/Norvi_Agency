
-- Phase 7: Omniscient Dual Logging System

ALTER TABLE private.audit_log
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE OR REPLACE FUNCTION public.log_action(
  p_action text,
  p_target_id text,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL
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
    auth.uid(),
    p_action,
    p_target_id,
    p_reason,
    p_metadata,
    p_ip_address
  );
END;
$$;

