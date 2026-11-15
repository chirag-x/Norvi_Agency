-- Phase 12: Database-Encrypted Multi-Key AI Manager
CREATE TABLE IF NOT EXISTS public.admin_ai_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'openrouter',
  label text NOT NULL,
  encrypted_key text NOT NULL,
  key_suffix text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for instant lookup of active key by provider
CREATE INDEX IF NOT EXISTS idx_admin_ai_keys_provider_active ON public.admin_ai_keys (provider, is_active);

-- Enable RLS
ALTER TABLE public.admin_ai_keys ENABLE ROW LEVEL SECURITY;

-- Helper RPC to safely list keys without exposing encrypted_key
CREATE OR REPLACE FUNCTION public.admin_list_ai_keys()
RETURNS TABLE (
  id uuid,
  provider text,
  label text,
  key_suffix text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    k.id,
    k.provider,
    k.label,
    k.key_suffix,
    k.is_active,
    k.created_at,
    k.updated_at
  FROM public.admin_ai_keys k
  ORDER BY k.created_at DESC;
$$;

-- Helper RPC to add a new key safely
CREATE OR REPLACE FUNCTION public.admin_add_ai_key(
  p_provider text,
  p_label text,
  p_encrypted_key text,
  p_key_suffix text,
  p_make_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  -- If this key is set to active, deactivate other keys for this provider
  IF p_make_active THEN
    UPDATE public.admin_ai_keys
    SET is_active = false, updated_at = now()
    WHERE provider = p_provider;
  END IF;

  INSERT INTO public.admin_ai_keys (
    provider,
    label,
    encrypted_key,
    key_suffix,
    is_active,
    updated_by
  )
  VALUES (
    p_provider,
    p_label,
    p_encrypted_key,
    p_key_suffix,
    p_make_active,
    auth.uid()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Helper RPC to set active key
CREATE OR REPLACE FUNCTION public.admin_set_active_ai_key(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider text;
BEGIN
  SELECT provider INTO v_provider FROM public.admin_ai_keys WHERE id = p_id;
  IF v_provider IS NULL THEN
    RETURN false;
  END IF;

  -- Deactivate other keys for this provider
  UPDATE public.admin_ai_keys
  SET is_active = false, updated_at = now()
  WHERE provider = v_provider AND id <> p_id;

  -- Activate selected key
  UPDATE public.admin_ai_keys
  SET is_active = true, updated_at = now()
  WHERE id = p_id;

  RETURN true;
END;
$$;

-- Helper RPC to delete a key
CREATE OR REPLACE FUNCTION public.admin_delete_ai_key(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_ai_keys WHERE id = p_id;
  RETURN true;
END;
$$;

-- Table Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_ai_keys TO authenticated;

-- RLS Policies for admin_ai_keys
DROP POLICY IF EXISTS "Staff can view admin_ai_keys" ON public.admin_ai_keys;
CREATE POLICY "Staff can view admin_ai_keys" ON public.admin_ai_keys
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.active = true
        AND sm.role IN ('owner', 'administrator', 'product_manager')
    )
  );

DROP POLICY IF EXISTS "Admins can insert admin_ai_keys" ON public.admin_ai_keys;
CREATE POLICY "Admins can insert admin_ai_keys" ON public.admin_ai_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.active = true
        AND sm.role IN ('owner', 'administrator')
    )
  );

DROP POLICY IF EXISTS "Admins can update admin_ai_keys" ON public.admin_ai_keys;
CREATE POLICY "Admins can update admin_ai_keys" ON public.admin_ai_keys
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.active = true
        AND sm.role IN ('owner', 'administrator')
    )
  );

DROP POLICY IF EXISTS "Admins can delete admin_ai_keys" ON public.admin_ai_keys;
CREATE POLICY "Admins can delete admin_ai_keys" ON public.admin_ai_keys
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.active = true
        AND sm.role IN ('owner', 'administrator')
    )
  );

-- Function Grants
GRANT EXECUTE ON FUNCTION public.admin_list_ai_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_ai_key(text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_active_ai_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_ai_key(uuid) TO authenticated;
