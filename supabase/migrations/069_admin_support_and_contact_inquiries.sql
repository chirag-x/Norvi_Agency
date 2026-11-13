-- Migration 069: Admin Customer Support & Contact Inquiries Tracking
-- 1. Creates public.contact_inquiries table to persist website contact form submissions
-- 2. Creates admin_list_inquiries() RPC to return a unified inbox of customer tickets and contact emails
-- 3. Creates admin_set_inquiry_status() RPC to mark inquiries resolved or open

BEGIN;

-- 1. Create public.contact_inquiries table
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated visitors to submit contact inquiries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contact_inquiries' AND policyname = 'anyone_can_submit_contact'
  ) THEN
    CREATE POLICY anyone_can_submit_contact ON public.contact_inquiries
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Create public.admin_list_inquiries() RPC
CREATE OR REPLACE FUNCTION public.admin_list_inquiries()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_items json;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  WITH all_inquiries AS (
    -- Registered Customer Support Tickets
    SELECT 
      sr.id::text AS id,
      'support_ticket' AS source,
      sr.user_id::text AS "userId",
      COALESCE(p.display_name, 'Registered Customer') AS name,
      COALESCE(u.email::text, 'Unknown') AS email,
      sr.subject,
      sr.message,
      sr.status,
      sr.created_at AS "createdAt",
      (SELECT COUNT(*) FROM public.licenses l WHERE l.user_id = sr.user_id AND l.status = 'active') AS "activeLicenses"
    FROM public.support_requests sr
    LEFT JOIN auth.users u ON u.id = sr.user_id
    LEFT JOIN public.profiles p ON p.id = sr.user_id

    UNION ALL

    -- Public Website Contact Submissions
    SELECT 
      ci.id::text AS id,
      'contact_form' AS source,
      NULL AS "userId",
      ci.name,
      ci.email,
      'Website Contact Inquiry' AS subject,
      ci.message,
      ci.status,
      ci.created_at AS "createdAt",
      0 AS "activeLicenses"
    FROM public.contact_inquiries ci
  )
  SELECT COALESCE(json_agg(row_to_json(i) ORDER BY i."createdAt" DESC), '[]'::json)
  INTO v_items
  FROM all_inquiries i;

  RETURN v_items;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_inquiries() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_inquiries() TO authenticated;

-- 3. Create public.admin_set_inquiry_status() RPC
CREATE OR REPLACE FUNCTION public.admin_set_inquiry_status(p_id uuid, p_source text, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  IF p_source = 'support_ticket' THEN
    UPDATE public.support_requests SET status = p_status WHERE id = p_id;
  ELSE
    UPDATE public.contact_inquiries 
    SET status = p_status, 
        resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END 
    WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_inquiry_status(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_inquiry_status(uuid, text, text) TO authenticated;

COMMIT;
