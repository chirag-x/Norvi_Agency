# Phase 14: Real-Time AI Key Verification & Live System Health Diagnostics

## Executive Summary
Phase 14 delivers real-time proactive observability and upstream validation across the NORVI Agency platform.
It solves two primary operational needs:
1. **Real-Time OpenRouter Key Verification (`/admin/releases`):** Administrators no longer need to wait for desktop agent errors to know if an API key is working, expired, or out of credits. Active keys and backup keys are verified live against OpenRouter with latency, credit limits, and health status indicators.
2. **Live Infrastructure Telemetry Dashboard (`/admin`):** Replaces the static, hardcoded "A Strong Start" card on the Admin Overview with a dynamic, live service health center running parallel diagnostics across the Supabase Database, OpenRouter AI, Razorpay Checkout, Resend Email Delivery, Groq STT, and the Commercial Agent Catalog.

---

## 1. Core Architectural Pillars

### 1.1 Zero Secret Exposure & Zero Token Cost
* **Zero Client-Side Secret Leakage:** Raw API keys and provider secrets are never sent to the browser.
* **OpenRouter Auth Endpoint:** Upstream verification queries `GET https://openrouter.ai/api/v1/auth/key` with the decrypted key in serverless memory.
  * This official OpenRouter endpoint is completely free, consumes 0 tokens/credits, and validates key status, credit limits, and rate limits in ~200ms.
* **Ephemeral In-Memory Unsealing:** Keys are decrypted using AES-256-GCM only within the server function and discarded immediately.

### 1.2 Non-Blocking Concurrent Diagnostics
* All subsystem health checks run in parallel using `Promise.allSettled`.
* Every external ping has a strict 3000ms timeout controller (`AbortController`), ensuring the admin page loads instantly without blocking or hanging.
* Results include microsecond timestamps, latency in milliseconds, masked credentials (`rzp_live...5678`), and deep-link navigation shortcuts (`Fix ↗`, `Setup ↗`, `View ↗`).

### 1.3 Zero Desktop Agent Code Changes
* Desktop agents (`Voro`, `Rolvio`, `Nexus`) require zero code changes or updates.
* Proxy routing, key testing, and health checks operate entirely server-side.

---

## 2. Technical Implementation Deliverables

### 2.1 Backend Endpoints (`apps/api/live.ts`)

#### 1. `POST /api/admin/ai/keys/:id/test`
* **Access Control:** Restricted to staff (`owner`, `administrator`, `product_manager`).
* **Target Resolution:** Accepts specific key UUID or `:id === 'active'`. Unseals target key from `admin_ai_keys` or environment fallback.
* **Upstream Verification:** Pings `https://openrouter.ai/api/v1/auth/key` with Bearer auth and a 4000ms timeout.
* **Payload Response:**
  ```json
  {
    "ok": true,
    "working": true,
    "label": "Primary High-Speed",
    "keySuffix": "d5d2",
    "latencyMs": 215,
    "usage": 0.15,
    "limit": null,
    "isFreeTier": false
  }
  ```
  Or on upstream rejection:
  ```json
  {
    "ok": false,
    "working": false,
    "label": "Primary High-Speed",
    "keySuffix": "d5d2",
    "latencyMs": 215,
    "error": "Upstream returned HTTP 401: Invalid API key"
  }
  ```

#### 2. `GET /api/admin/system/health`
* **Access Control:** Restricted to staff (`owner`, `administrator`, `product_manager`, `support`).
* **Parallel Subsystems Tested:**
  1. **Supabase Database & Auth Engine:** Ping query to `public.products`, measuring SQL query latency.
  2. **OpenRouter AI Provider:** Resolves active key and pings `auth/key` for live status.
  3. **Razorpay Payments Gateway:** Pings Razorpay API with Basic Auth credentials to ensure checkout readiness.
  4. **License Email Delivery (Resend):** Pings Resend API with Bearer token to ensure instant license delivery.
  5. **Groq STT Voice Engine:** Pings Groq models endpoint to ensure whisper transcription availability.
  6. **Commercial Agent Catalog:** Queries published agent catalog and verification pipeline.
* **Payload Response:**
  ```json
  {
    "ok": true,
    "allOk": true,
    "hasErrors": false,
    "summary": "All systems operational",
    "timestamp": "2026-11-16T01:10:00.000Z",
    "checks": [ ... ]
  }
  ```

---

### 2.2 UI Upgrades

#### 1. Interactive Key Testing (`apps/web/src/ui/AdminAiKeyManager.tsx`)
* **Auto-Test on Selection:** When `/admin/releases` opens or the active key is changed, the UI automatically tests the key.
* **Dynamic Active Key Badge:**
  * ⏳ *Testing:* `⚡ Testing main (...d5d2)...` with animated spinner.
  * 🟢 *Working:* `✓ Working (210ms): main (...d5d2)` with pulsing green dot. Clicking re-tests.
  * 🔴 *Error:* `✗ Offline: main (Invalid API key) · Retry ↻` with alert badge.
* **Per-Key Test Buttons:** In the expanded `Manage Keys` table, each key row has a dedicated `⚡ Test Key` button to verify backup keys before activating them.

#### 2. Live Infrastructure Telemetry (`apps/web/src/ui/AdminSystemDiagnostics.tsx` & `Workspace.tsx`)
* Replaced the hardcoded "A Strong Start" block on `/admin` with `AdminSystemDiagnostics`.
* **Left Panel:**
  * Status dot indicating overall health (Green = All Operational, Amber = Warning/Setup needed, Red = Error).
  * Headline: `All systems operational.` / `Service alert: action required.`
  * `[↻ Run Diagnostics]` on-demand re-ping button with spinner.
  * `[Manage Agents & AI →]` shortcut button.
* **Right Panel:**
  * Live status items for Database, AI, Razorpay, Email, Groq STT, and Catalog.
  * Displays latency in milliseconds, masked credentials, and direct action links (`Fix ↗`, `Setup ↗`, `View ↗`).

---

## 3. Verification & Compliance
* **Unit Test Suite:** Added `tests/admin-system-health.test.ts` covering:
  * Authentication and role verification (401/403 for unauthorized users).
  * Upstream OpenRouter ping verification and error handling.
  * Comprehensive 6-subsystem health diagnostics aggregation.
* **Full Verification:**
  * `npm test`: 39/39 test files passed (272/272 tests passing).
  * `npm run check`: Zero TypeScript errors.
  * `npm run build`: Production static build succeeds with zero errors.
