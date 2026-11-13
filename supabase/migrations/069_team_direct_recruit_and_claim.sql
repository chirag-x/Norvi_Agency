-- Migration 069: Direct Team Recruitment and Login Invitation Auto-Claim
-- Enforces strict MFA (AAL2) security for Owner promotion

BEGIN;

-- 1. RPC: admin_direct_promote_staff
CREATE OR REPLACE FUNCTION public.admin_direct_promote_staff(p_email text, p_role text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role text;
  v_target_user_id uuid;
  v_display_name text;
BEGIN
  -- Security check: Caller must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Permission denied: Not authenticated.';
  END IF;

  -- Security check: Caller must have completed MFA (AAL2)
  IF coalesce(auth.jwt()->>'aal', '') != 'aal2' THEN
    RAISE EXCEPTION 'Permission denied: MFA (AAL2) required.';
  END IF;

  -- Security check: Only Owner can directly promote staff
  SELECT role INTO v_caller_role 
  FROM public.staff_memberships 
  WHERE user_id = auth.uid() AND active = true;

  IF coalesce(v_caller_role, '') != 'owner' THEN
    RAISE EXCEPTION 'Permission denied: Only the agency owner can directly promote team members.';
  END IF;

  -- Validate target role
  IF p_role NOT IN ('administrator', 'product_manager', 'support') THEN
    RAISE EXCEPTION 'Invalid role: must be administrator, product_manager, or support.';
  END IF;

  -- Find user in auth.users by email
  SELECT id INTO v_target_user_id 
  FROM auth.users 
  WHERE lower(email) = lower(trim(p_email));

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'No registered account found with email "%". The customer must register first.', trim(p_email);
  END IF;

  -- Prevent modifying owner
  IF EXISTS (SELECT 1 FROM public.staff_memberships WHERE user_id = v_target_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Cannot modify owner role.';
  END IF;

  -- Upsert staff membership
  INSERT INTO public.staff_memberships (user_id, role, active)
  VALUES (v_target_user_id, p_role, true)
  ON CONFLICT (user_id) DO UPDATE SET role = p_role, active = true;

  -- Accept pending invitations for this email if any
  UPDATE public.staff_invitations
  SET status = 'accepted'
  WHERE lower(email) = lower(trim(p_email)) AND status = 'pending';

  -- Fetch display name
  SELECT coalesce(display_name, trim(p_email)) INTO v_display_name 
  FROM public.profiles 
  WHERE id = v_target_user_id;

  -- Audit log
  INSERT INTO private.audit_log (actor_id, action, target_id)
  VALUES (auth.uid(), 'staff.promoted_direct', v_target_user_id::text || ' (' || trim(p_email) || ') -> ' || p_role);

  RETURN json_build_object(
    'ok', true,
    'userId', v_target_user_id,
    'email', trim(p_email),
    'name', v_display_name,
    'role', p_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_direct_promote_staff(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_direct_promote_staff(text, text) TO authenticated;


-- 2. RPC: claim_pending_staff_invitation
-- Automatically claims any pending invitation when an existing user logs in
CREATE OR REPLACE FUNCTION public.claim_pending_staff_invitation()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_invite_id uuid;
  v_invite_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('claimed', false);
  END IF;

  -- If already in staff_memberships, nothing to claim
  IF EXISTS (SELECT 1 FROM public.staff_memberships WHERE user_id = auth.uid()) THEN
    RETURN json_build_object('claimed', false);
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN json_build_object('claimed', false);
  END IF;

  SELECT id, role INTO v_invite_id, v_invite_role
  FROM public.staff_invitations
  WHERE lower(email) = lower(v_email) AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invite_role IS NOT NULL THEN
    INSERT INTO public.staff_memberships (user_id, role, active)
    VALUES (auth.uid(), v_invite_role, true)
    ON CONFLICT (user_id) DO UPDATE SET role = v_invite_role, active = true;

    UPDATE public.staff_invitations
    SET status = 'accepted'
    WHERE id = v_invite_id;

    INSERT INTO private.audit_log (actor_id, action, target_id)
    VALUES (auth.uid(), 'invitation.auto_claimed_on_login', v_email || ' -> ' || v_invite_role);

    RETURN json_build_object('claimed', true, 'role', v_invite_role);
  END IF;

  RETURN json_build_object('claimed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_staff_invitation() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_pending_staff_invitation() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
