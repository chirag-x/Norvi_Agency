-- The new gemini-embedding-2 model uses 3072 dimensions by default
-- We need to update the knowledge_base table and the RPCs to support 3072 dimensions instead of 768.

-- 1. Drop the old RPCs that depend on vector(768)
DROP FUNCTION IF EXISTS match_kb_articles(vector(768), float, int);
DROP FUNCTION IF EXISTS admin_update_kb_embedding(uuid, vector(768));

-- 2. Alter the table column type
ALTER TABLE knowledge_base ALTER COLUMN embedding TYPE vector(3072);

-- 3. Recreate the RPCs with vector(3072)
CREATE OR REPLACE FUNCTION admin_update_kb_embedding(
    p_id uuid,
    p_embedding vector(3072)
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE knowledge_base SET embedding = p_embedding WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION match_kb_articles(
    query_embedding vector(3072),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    similarity float
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        1 - (kb.embedding <=> query_embedding) AS similarity
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL AND 1 - (kb.embedding <=> query_embedding) > match_threshold
    ORDER BY kb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
