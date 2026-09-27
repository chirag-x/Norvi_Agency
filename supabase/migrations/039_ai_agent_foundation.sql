-- Enable the pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Table for AI Settings (Secure, single row)
CREATE TABLE ai_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    provider text NOT NULL DEFAULT 'google',
    api_key text,
    model text NOT NULL DEFAULT 'gemini-1.5-flash',
    system_prompt text NOT NULL DEFAULT 'You are an incredibly helpful, friendly, and concise support agent for NORVI. You answer questions strictly based on your knowledge base. If you do not know the answer, politely tell the customer to contact human support.',
    updated_at timestamp with time zone DEFAULT now()
);

-- Initialize with default row
INSERT INTO ai_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS for ai_settings (Only accessible via RPC)
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- Table for Knowledge Base
CREATE TABLE knowledge_base (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    embedding vector(768), -- Gemini text-embedding-004 uses 768 dimensions
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- RPC: Get AI Settings
CREATE OR REPLACE FUNCTION admin_get_ai_settings()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF auth.jwt() ->> 'role' NOT IN ('owner', 'administrator') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    RETURN (SELECT row_to_json(ai_settings) FROM ai_settings WHERE id = 1);
END;
$$;

-- RPC: Update AI Settings
CREATE OR REPLACE FUNCTION admin_update_ai_settings(
    p_api_key text,
    p_model text,
    p_system_prompt text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF auth.jwt() ->> 'role' != 'owner' THEN
        RAISE EXCEPTION 'Only owners can update AI API keys';
    END IF;
    UPDATE ai_settings 
    SET api_key = p_api_key, model = p_model, system_prompt = p_system_prompt, updated_at = now() 
    WHERE id = 1;
END;
$$;

-- RPC: List Knowledge Base
CREATE OR REPLACE FUNCTION admin_list_kb()
RETURNS TABLE(id uuid, title text, content text, has_embedding boolean, created_at timestamp with time zone) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF auth.jwt() ->> 'role' NOT IN ('owner', 'administrator', 'product_manager') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    RETURN QUERY SELECT k.id, k.title, k.content, (k.embedding IS NOT NULL), k.created_at FROM knowledge_base k ORDER BY k.created_at DESC;
END;
$$;

-- RPC: Add Knowledge Base Article
CREATE OR REPLACE FUNCTION admin_add_kb(p_title text, p_content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_id uuid;
BEGIN
    IF auth.jwt() ->> 'role' NOT IN ('owner', 'administrator', 'product_manager') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    INSERT INTO knowledge_base (title, content) VALUES (p_title, p_content) RETURNING knowledge_base.id INTO v_id;
    RETURN v_id;
END;
$$;

-- RPC: Delete Knowledge Base Article
CREATE OR REPLACE FUNCTION admin_delete_kb(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF auth.jwt() ->> 'role' NOT IN ('owner', 'administrator', 'product_manager') THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    DELETE FROM knowledge_base WHERE knowledge_base.id = p_id;
END;
$$;
