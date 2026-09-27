-- RPC: Update Embedding
CREATE OR REPLACE FUNCTION admin_update_kb_embedding(
    p_id uuid,
    p_embedding vector(768)
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE knowledge_base SET embedding = p_embedding WHERE id = p_id;
END;
$$;

-- RPC: Match KB Articles (Vector Similarity Search)
CREATE OR REPLACE FUNCTION match_kb_articles(
    query_embedding vector(768),
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
