# Phase 14 - Automated AI Support Agent (RAG)

**Status:** Completed

## Implementation Summary:
We built an autonomous, Retrieval-Augmented Generation (RAG) AI support agent directly into the platform, utilizing Google AI Studio's modern Gemini models and Supabase's `pgvector` extension.

### 1. Vector Database & Knowledge Base
- Enabled the `vector` extension in Supabase.
- Created a highly secure `ai_settings` table to protect the API key, and a `knowledge_base` table to store FAQS and Policies.
- **Model Upgrade:** We bypassed the deprecated models and integrated the state-of-the-art **`gemini-embedding-2`** engine.
- When an article is added via the Admin panel, the backend automatically calls the Gemini API to generate a massive **3,072-dimensional vector** and saves it to the database for mathematical similarity searches.

### 2. The Chat Engine (Backend RAG)
- Implemented a blazing-fast `/api/chat` RAG pipeline.
- It calculates the cosine similarity between the customer's query vector and the `knowledge_base` embeddings to inject relevant context.
- **AI Brain:** Utilizing the **`gemini-3.5-flash`** model (the latest free-tier standard), the backend streams the conversational response back to the client using Server-Sent Events (SSE) and native Web Streams.

### 3. The Customer Chat Widget (Frontend)
- Built `<ChatWidget />`, a sleek, floating dark-mode chat interface accessible on all public pages.
- Includes real-time typing indicators, auto-scrolling, and robust error boundaries that cleanly display API rejection messages (e.g., Invalid API Keys).

### 4. Admin Control Center
- Added an "AI Support Agent" dashboard in the Admin panel.
- Admins can dynamically update the Google AI Studio API key, specify the system prompt (Agent Persona), and toggle the active model (defaulting to `gemini-3.5-flash`) with zero hardcoded restrictions.
- Replaced basic browser alerts with native, professional `<Notice>` UI components.
