-- Phase 15 - Marketing Broadcast Engine
-- 1. Table for Broadcast History
CREATE TABLE broadcasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject text NOT NULL,
    html_body text NOT NULL,
    audience text NOT NULL,
    sent_count int DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- 2. RPC to get Audience Statistics (Counts)
CREATE OR REPLACE FUNCTION admin_get_audience_stats()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_role text;
    v_all int;
    v_customers int;
    v_leads int;
    v_affiliates int;
BEGIN
    -- Verify Permissions
    SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
    IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN 
        RAISE EXCEPTION 'Permission denied'; 
    END IF;

    -- Calculate Audiences
    SELECT count(*) INTO v_all FROM auth.users;
    SELECT count(DISTINCT user_id) INTO v_customers FROM public.orders WHERE status = 'paid';
    SELECT count(*) INTO v_leads FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.orders WHERE status = 'paid');
    SELECT count(*) INTO v_affiliates FROM public.affiliates;

    RETURN json_build_object(
        'all', v_all, 
        'customers', v_customers, 
        'leads', v_leads, 
        'affiliates', v_affiliates
    );
END;
$$;

-- 3. RPC to extract raw emails for the dispatcher
CREATE OR REPLACE FUNCTION admin_get_audience_emails(p_audience text)
RETURNS TABLE(email text) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
    IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN 
        RAISE EXCEPTION 'Permission denied'; 
    END IF;

    IF p_audience = 'customers' THEN
        RETURN QUERY SELECT DISTINCT u.email::text FROM auth.users u JOIN public.orders o ON u.id = o.user_id WHERE o.status = 'paid';
    ELSIF p_audience = 'leads' THEN
        RETURN QUERY SELECT u.email::text FROM auth.users u WHERE u.id NOT IN (SELECT user_id FROM public.orders WHERE status = 'paid');
    ELSIF p_audience = 'affiliates' THEN
        RETURN QUERY SELECT DISTINCT u.email::text FROM auth.users u JOIN public.affiliates a ON u.id = a.user_id;
    ELSE
        RETURN QUERY SELECT u.email::text FROM auth.users u;
    END IF;
END;
$$;

-- 4. RPC to get Broadcast History
CREATE OR REPLACE FUNCTION admin_list_broadcasts()
RETURNS TABLE(id uuid, subject text, audience text, sent_count int, created_at timestamp with time zone) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
    IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN 
        RAISE EXCEPTION 'Permission denied'; 
    END IF;
    
    RETURN QUERY SELECT b.id, b.subject, b.audience, b.sent_count, b.created_at 
                 FROM broadcasts b ORDER BY b.created_at DESC;
END;
$$;
