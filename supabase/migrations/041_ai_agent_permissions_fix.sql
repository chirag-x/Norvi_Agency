-- Fix RPC: Get AI Settings
CREATE OR REPLACE FUNCTION admin_get_ai_settings()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
    IF coalesce(v_role, '') NOT IN ('owner', 'administrator') THEN
        RAISE EXCEPTION 'Permission denied.';
    END IF;
    RETURN (SELECT row_to_json(ai_settings) FROM ai_settings WHERE id = 1);
END;
$$;

-- Fix RPC: Update AI Settings
CREATE OR REPLACE FUNCTION admin_update_ai_settings(
    p_api_key text,
    p_model text,
    p_system_prompt text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
    IF coalesce(v_role, '') != 'owner' THEN
        RAISE EXCEPTION 'Only owners can update AI API keys';
    END IF;
    UPDATE ai_settings 
    SET api_key = p_api_key, model = p_model, system_prompt = p_system_prompt, updated_at = now() 
    WHERE id = 1;
END;
$$;

-- Fix RPC: List Knowledge Base
CREATE OR REPLACE FUNCTION admin_list_kb()
RETURNS TABLE(id uuid, title text, content text, has_embedding boolean, created_at timestamp with time zone) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
    IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN
        RAISE EXCEPTION 'Permission denied.';
    END IF;
    RETURN QUERY SELECT k.id, k.title, k.content, (k.embedding IS NOT NULL), k.created_at FROM knowledge_base k ORDER BY k.created_at DESC;
END;
$$;

-- Fix RPC: Add Knowledge Base Article
CREATE OR REPLACE FUNCTION admin_add_kb(p_title text, p_content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_id uuid;
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
    IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN
        RAISE EXCEPTION 'Permission denied.';
    END IF;
    INSERT INTO knowledge_base (title, content) VALUES (p_title, p_content) RETURNING knowledge_base.id INTO v_id;
    RETURN v_id;
END;
$$;

-- Fix RPC: Delete Knowledge Base Article
CREATE OR REPLACE FUNCTION admin_delete_kb(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
    IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'product_manager') THEN
        RAISE EXCEPTION 'Permission denied.';
    END IF;
    DELETE FROM knowledge_base WHERE knowledge_base.id = p_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
