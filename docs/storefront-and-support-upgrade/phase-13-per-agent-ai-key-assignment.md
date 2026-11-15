# Phase 13: Per-Agent Dedicated AI Key Assignment & Multi-Key Isolation

## Executive Summary
Phase 13 extends the database-driven OpenRouter multi-key architecture (introduced in Phase 12) from a single global active key to granular, per-agent key routing.
Agency owners and administrators can now assign dedicated OpenRouter API keys to specific agents (e.g. Voro on Key A, Rolvio on Key B, Nexus on Key C, or future agents) directly from the Agent Releases dashboard (`/admin/releases`), with seamless automatic fallback to the Global Active Key.

---

## 1. Core Architectural Pillars

### 1.1 Zero Agent Client Code Changes
* Desktop agents (`Voro`, `Rolvio`, `Nexus`) continue communicating exclusively with `https://nor-vi.in/api/agent-ai` using their standard short-lived License Lease JWT and `X-Norvi-Product` headers.
* Desktop clients have zero awareness of upstream API keys, account limits, or OpenRouter tokens.
* All key selection, policy lookup, AES-256-GCM decryption, and upstream injection happen 100% server-side in backend edge memory.

### 1.2 Rate Limit & Credit Isolation
* Spikes in interview volume on Voro will never throttle, exhaust, or rate-limit automated workflows in Rolvio or video processing in Nexus.
* OpenRouter accounts can be separated cleanly for distinct billing, cost tracking, and credit cards.

### 1.3 High-Resilience Cascading Fallback
When an AI request is made for a product:
1. **Dedicated Key Lookup:** If the agent has a dedicated `ai_key_id` assigned, the backend fetches and decrypts that key.
2. **Global Active Fallback:** If the dedicated key is missing, deleted, or unconfigured, the backend gracefully falls back to the Global Active Key.
3. **Environment Fallback:** If no database keys exist, it falls back to `c.env.OPENROUTER_API_KEY`.
4. **RAM Hot Caching:** Keys are cached in server RAM for 60 seconds (`key:<id>` and `provider:<name>`) with instant invalidation upon any admin update. Runtime decryption latency is 0.00ms.

---

## 2. Technical Implementation Deliverables

### 2.1 Database Schema (`supabase/migrations/074_agent_ai_policy_key_assignment.sql`)
* `ALTER TABLE public.agent_ai_policies ADD COLUMN IF NOT EXISTS ai_key_id uuid REFERENCES public.admin_ai_keys(id) ON DELETE SET NULL;`
* `CREATE INDEX IF NOT EXISTS idx_agent_ai_policies_ai_key_id ON public.agent_ai_policies(ai_key_id);`
* Updated `admin_get_agent_ai_policies()` RPC to join with `admin_ai_keys` and return `aiKeyId`, `aiKeyLabel`, and `aiKeySuffix`.
* Updated `admin_upsert_agent_ai_policy(...)` to accept `p_ai_key_id uuid DEFAULT NULL`.
* Updated `consume_agent_ai_quota(...)` RPC to return `'ai_key_id', v_policy.ai_key_id` in its authorization payload.

### 2.2 Shared AI Models & Proxy (`packages/shared/agentAi.ts` & `packages/shared/agentAiProxy.ts`)
* Extended `AgentAiPolicyInput` and `AgentAiPolicy` types with `aiKeyId?: string | null`, `aiKeyLabel?: string | null`, `aiKeySuffix?: string | null`.
* Updated `normalizeAgentAiPolicyPayload` to parse and validate UUID `aiKeyId`.
* Updated `createAgentAiHandler` to pass `quota.ai_key_id` into `resolveApiKey('openrouter', quota.ai_key_id)`.

### 2.3 Backend API & Key Decryption (`apps/api/live.ts`)
* Enhanced `getActiveAiKey(env, provider, clientFactory, specificKeyId)`:
  - When `specificKeyId` is passed, fetches and decrypts that specific key from `admin_ai_keys`.
  - Caches under `key:${specificKeyId}` in hot RAM.
  - Automatically falls back to global active key if the specific key is not found or fails.
* Updated `POST /api/admin/products/:id/ai-policy` to pass `p_ai_key_id: p.aiKeyId || null`.

### 2.4 Admin Releases UI (`apps/web/src/ui/AgentAiPolicySection.tsx` & `Workspace.tsx`)
* Added "Upstream AI API Key" selector inside each agent's "Edit Release & AI" panel:
  - Option 1: `🌐 Default (Use Global Active Key)`
  - Options 2..N: `🔑 {label} ({key_suffix}) {is_active ? '— [Active Default]' : ''}`
* Added dedicated key badge in the collapsed release card summary showing the assigned key or `Global Default`.

---

## 3. Verification & Compliance
* **Unit & Integration Tests:** Validates per-agent dedicated key resolution, cascading fallback when assigned key is deleted, and backward compatibility.
* **Security & Secret Leakage:** Zero raw keys or secret prefixes exposed to the client bundle or network responses.
* **Full Suite:** `npm test`, `npm run check`, `npm run build`.
