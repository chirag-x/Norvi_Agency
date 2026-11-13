# Phase 2: Backend API Endpoints & Business Logic

**Status:** ✅ Completed and Verified (8/8 API unit tests passing, zero regressions across 195 platform tests)

**Goal:** Update `apps/api/live.ts` and related shared packages to expose customer email in license listings, handle HWID actions (ban, unban, remove), serve on-demand license telemetry, and support 1-day gift trials.

---

## 1. Updates to Existing Endpoints

### A. `GET /api/admin/licenses`
- Query and response serializer updated to always include `email: u.email` alongside `customer: coalesce(pr.display_name, u.email)`.
- Returns full `devices` array with HWID (`installation_id`), `active`, `last_seen_at`, `banned_until`, `ban_reason`, and `is_banned`.

### B. `POST /api/admin/licenses/gift`
- Zod validation schema updated:
  ```ts
  duration: z.enum(['1_day', '1_month', '3_months', 'lifetime']).optional().default('lifetime')
  ```
- Forwards duration `'1_day'` to `admin_gift_license` RPC, creating a 24-hour trial key (`interval '24 hours'`).

---

## 2. Admin Endpoints Implemented in `apps/api/live.ts`

### A. Device Management Endpoints
1. **`POST /api/admin/devices/:id/ban`:**
   - Role check: `owner`, `administrator`.
   - Payload: `{ duration: '24h' | '7d' | '1m' | 'lifetime', reason?: string }`.
   - Calls `admin_ban_device` RPC.
   - Audits action and sends Discord security notification via `fireLog`.
2. **`POST /api/admin/devices/:id/unban`:**
   - Role check: `owner`, `administrator`.
   - Calls `admin_unban_device` RPC.
   - Audits action.
3. **`POST /api/admin/devices/:id/remove`:**
   - Role check: `owner`, `administrator`, `support`.
   - Calls `admin_remove_device` RPC (clean deletion, frees slot cleanly).

### B. Per-License Telemetry Endpoint
4. **`GET /api/admin/licenses/:id/telemetry`:**
   - Role check: `owner`, `administrator`, `support`.
   - Calls `admin_get_license_telemetry(p_license_id)` RPC.
   - Returns `{ devices: [...], ai: { used_24h, limit_24h, left_24h, used_7d, limit_7d, left_7d, used_30d, limit_30d, left_30d, total_tokens, total_cost_usd }, stt: { used_24h, limit_24h, left_24h, used_7d, limit_7d, left_7d, used_30d, limit_30d, left_30d }, recent_logs: [...] }`.

---

## 3. Phase 2 Verification Checklist
- [x] Vitest API tests verifying `POST /api/admin/licenses/gift` handles `'1_day'` and sets 24-hour expiration.
- [x] Vitest API tests verifying `POST /api/admin/devices/:id/ban` rejects invalid durations and applies ban.
- [x] Vitest API tests verifying `POST /api/admin/devices/:id/unban` clears ban.
- [x] Vitest API tests verifying `GET /api/admin/licenses/:id/telemetry` returns accurate counts and logs.
- [x] Zero TypeScript errors (`npm run check`).
- [x] Test suite: `tests/admin-license-api.test.ts` (8 passed).
