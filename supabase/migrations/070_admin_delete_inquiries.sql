-- Migration 070: Admin Delete Inquiries RPC
-- Enables support staff to permanently remove customer tickets or contact inquiries

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_delete_inquiry(p_id uuid, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  IF p_source = 'support_ticket' THEN
    DELETE FROM public.support_requests WHERE id = p_id;
  ELSE
    DELETE FROM public.contact_inquiries WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_inquiry(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_inquiry(uuid, text) TO authenticated;

COMMIT;
