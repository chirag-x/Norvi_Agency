# Phase 1: Database Schema, RPCs & Security Fixes

**Goal:** Create Supabase migration `065_admin_license_device_management.sql` providing all underlying database functions, hardware ban logic, quota calculation, customer self-release bug fix, and gift trial key support.

---

## 1. Schema Modifications (`public.devices`)

Add ban duration tracking and ban reasons:
```sql
ALTER TABLE public.devices 
  ADD COLUMN IF NOT EXISTS banned_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ban_reason text DEFAULT NULL;
```

---

## 2. Functions to Implement

### A. Device Management RPCs
1. **`admin_ban_device(p_device_id uuid, p_duration text, p_reason text)`:**
   - Supported durations: `'24h'`, `'7d'`, `'1m'`, `'lifetime'`.
   - Computes exact `banned_until` timestamp (`now() + 24 hours`, `now() + 7 days`, `now() + 30 days`, or `'9999-12-31'`).
   - Sets `active = false`, logs to `private.audit_log`.
2. **`admin_unban_device(p_device_id uuid)`:**
   - Clears `banned_until = NULL`, `ban_reason = NULL`, sets `active = true`.
   - Access is restored immediately.
3. **`admin_remove_device(p_device_id uuid)`:**
   - Deletes device row (`DELETE FROM public.devices WHERE id = p_device_id`).
   - Cleanly frees up the slot without banning the machine.

### B. Bug Fix for Customer Self-Release
4. **`release_device(p_device_id uuid, p_license_id uuid)`:**
   - Replace flawed `UPDATE public.devices SET active = false` from migration `055`.
   - Use clean `DELETE FROM public.devices WHERE id = p_device_id AND license_id = p_license_id;`.
   - Frees up the device slot without leaving a permanent ban artifact in the database.

### C. Authentication & Activation Updates
5. **`activate_agent_license` & `verify_online_lease`:**
   - Check if `banned_until IS NOT NULL AND banned_until > now()`: reject with clear message:
     `"This device has been temporarily blocked until YYYY-MM-DD HH:MM by administrator."`
   - If previous ban has expired (`banned_until <= now()`), automatically unban and permit registration if active slots `< max_devices`.

### D. 1-Day Trial Option for Gift Licenses
6. **`admin_gift_license(p_email, p_product_slug, p_encryption_secret, p_duration)`:**
   - Extend duration check:
     ```sql
     IF p_duration = '1_day' OR p_duration = '24h' THEN
       v_interval := interval '24 hours';
     ELSIF p_duration = '1_month' THEN
       v_interval := interval '1 month';
     ELSIF p_duration = '3_months' THEN
       v_interval := interval '3 months';
     ELSE
       v_interval := NULL; -- lifetime
     END IF;
     ```

### E. Telemetry & Per-User Quota Calculation RPC
7. **`admin_get_license_telemetry(p_license_id uuid)`:**
   - Returns on-demand per-license telemetry:
     - Connected devices list (ID, machine hash, status, `last_seen_at`, ban expiration countdown).
     - AI requests used in last 24h, 7d, 30d, daily limit, and remaining questions.
     - Total tokens consumed & dollar cost spent on OpenRouter.
     - Groq STT fallback voice transcriptions used in 24h, daily STT limit, and remaining voice chunks.
     - Recent 10 prompt turns log (timestamp, task, model, tokens, status).

---

## 3. Phase 1 Verification Criteria
- [x] PGlite test suite verifying `admin_ban_device` applies 24h, 7d, 1m, and lifetime timestamps accurately.
- [x] PGlite test verifying expired bans auto-unlock.
- [x] PGlite test verifying `release_device` deletes cleanly and does not trigger administrator ban error on reactivation.
- [x] PGlite test verifying `admin_gift_license` with `'1_day'` creates an order and license expiring in 24 hours.
- [x] PGlite test verifying `admin_get_license_telemetry` calculates usage counts, limits, remaining, tokens, costs, devices, and recent logs accurately.
- [x] PGlite test verifying `admin_list_licenses` returns customer email, devices list, and active status.
- [x] PGlite test verifying `admin_unban_device` and `admin_remove_device`.
