-- Migration 027: Fix owner permission check in reveal_license_key
--
-- PROBLEM: The old query `select active into v_is_owner` could return NULL if no row existed,
-- and would fail to correctly authorize the owner if the `active` column state was weird.
-- FIX: Use `EXISTS` to cleanly determine if the user is an active owner.

CREATE OR REPLACE FUNCTION private.reveal_license_key(p_license_id uuid, p_encryption_secret text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE
  v_encrypted_key text;
  v_raw_key text;
  v_is_owner boolean;
BEGIN
  -- Use EXISTS for a bulletproof true/false check
  SELECT EXISTS (
    SELECT 1 FROM public.staff_memberships 
    WHERE user_id = auth.uid() AND role = 'owner' AND active = true
  ) INTO v_is_owner;
  
  -- If not an owner, verify the license belongs to the requesting customer
  IF NOT v_is_owner THEN
    IF NOT EXISTS (SELECT 1 FROM public.licenses WHERE id = p_license_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'License not found or access denied.';
    END IF;
  END IF;

  SELECT encrypted_key INTO v_encrypted_key FROM private.license_secrets WHERE license_id = p_license_id;
  IF v_encrypted_key IS NULL THEN
    RAISE EXCEPTION 'Key material missing.';
  END IF;

  v_raw_key := extensions.pgp_sym_decrypt(v_encrypted_key::bytea, p_encryption_secret);
  RETURN v_raw_key;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to decrypt license key. The encryption secret may be invalid.';
END;
$body$;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
