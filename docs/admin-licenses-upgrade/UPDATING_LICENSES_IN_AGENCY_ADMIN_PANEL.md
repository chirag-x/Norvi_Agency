# Updating Licenses in Agency Admin Panel
## Master Architecture & Implementation Plan: HWID Management, Timed Bans, Quota Tracking & Customer Visibility

**Document Status:** Architectural Proposal & Implementation Specification  
**Location:** `/docs/admin-licenses-upgrade/UPDATING_LICENSES_IN_AGENCY_ADMIN_PANEL.md`  
**Target Pages:** Website Admin Panel (`/admin/licenses`), Customer Account (`/account/licenses`), Backend API (`/api/admin/licenses/*`), Database Schema (`supabase/migrations`).

---

## 1. Executive Summary & Goals

This specification details four major upgrades to the **Licenses** tab (`/admin/licenses`) and device management across NORVI Agency:

1. **Hardware ID (HWID) Device Visibility & Multi-Device Control:**  
   Display all hardware IDs connected to each customer's license. Provide individual actions to **Remove (Unlink)**, **Ban** (with duration), or **Unban** specific devices.
2. **Flexible Time-Based & Lifetime HWID Banning:**  
   Allow administrators to ban a hardware ID for a set duration:
   - **24 Hours**
   - **7 Days**
   - **1 Month (30 Days)**
   - **Lifetime (Permanent)**  
   Provide a 1-click **Unban** button to instantly restore access.
3. **Customer Email Visibility & Unified Search:**  
   Clearly display the customer's **Email ID** alongside their name, license key, and product. Enable instant searching by email, name, key suffix, or hardware ID.
4. **Live Per-User AI & Speech Quota Tracker:**  
   Show exactly how many questions/tokens the specific customer has used today, this week, and this month, and how many requests they have remaining before hitting their limit. Show fallback Groq STT transcriptions used and remaining.
5. **Customer Device Self-Release Bug Fix:**  
   Fix the bug where a customer unlinking their own machine in `/account/licenses` accidentally bans the device forever with `"This device has been blocked by the administrator."`

---

## 2. Feature Details & User Experience

### A. Hardware ID (HWID) Per-License Management

Currently, `/admin/licenses` only shows a boolean indicator (`Device: Yes / No`). You cannot see the actual hardware ID or manage multiple devices individually.

#### The Upgrade:
Under each license card in `/admin/licenses`, we will render a dedicated **Connected Hardware Devices** section:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Connected Devices (1 / 2 Active Slots)                                 │
├────────────────────────────────────────────────────────────────────────┤
│ • DESKTOP-CHIRAG-98412491204                                          │
│   ID: win-DESKTOP-CHIRAG-4821a984f1                                    │
│   Status: 🟢 Active · Last seen: 12 minutes ago                        │
│   Actions: [ Unlink Device ]  [ 🚫 Ban Device ]                       │
├────────────────────────────────────────────────────────────────────────┤
│ • LAPTOP-WORK-7731920194                                               │
│   ID: win-LAPTOP-WORK-c018274d8e                                       │
│   Status: 🔴 Banned (Expires in 23h 14m)                               │
│   Ban Reason: "Manual test ban"                                        │
│   Actions: [ ✅ Unban Device ]  [ Unlink Device ]                      │
└────────────────────────────────────────────────────────────────────────┘
```

#### Individual Device Actions:
1. **Unlink / Remove Device (`/admin/devices/:id/remove`):**
   - Completely removes the device from the license (`DELETE FROM public.devices`).
   - Immediately frees up the slot (`active_devices` count drops).
   - Does **NOT** ban the computer. The user can cleanly re-link it later if slots are available.
2. **Ban Device (`/admin/devices/:id/ban`):**
   - Opens a clean popup modal with duration choices:
     - `○ 24 Hours`
     - `○ 7 Days`
     - `○ 1 Month (30 Days)`
     - `○ Lifetime (Permanent)`
   - Optional reason note (e.g., *"Chargeback dispute"*, *"Excessive scraping"*).
   - Marks the device as banned in the database with `banned_until` timestamp.
   - Any API or AI request from this machine is immediately rejected with:
     `"This device has been temporarily suspended until YYYY-MM-DD HH:MM."`
3. **Unban Device (`/admin/devices/:id/unban`):**
   - Clears `banned_until` and sets `active = true`.
   - Access is restored immediately without needing to regenerate keys or restart servers.

---

### B. Customer Email ID Visibility & Fast Search

#### The Current Problem:
The backend query `admin_list_licenses` already fetches `u.email`, but `Workspace.tsx` only renders `l.customer`. If the customer set their profile display name (e.g. *"Chirag Sharma"*), their email is hidden, making it difficult to search or cross-reference Stripe/Razorpay payments.

#### The Upgrade:
1. **Card Header Display:**
   ```
   [ Agent: Voro ]                                           [ Active ]
   Customer: Chirag Sharma (chirag@example.com)  [Copy Email]
   Key: NORVI-XXXX-XXXX-XXXX-A9F2                [Reveal]
   ```
2. **Search Filter Enhancement:**
   Typing into the `/admin/licenses` search bar will instantly match:
   - Customer Email (e.g. `chirag@...`)
   - Customer Name (e.g. `Chirag`)
   - Product Name (e.g. `Voro`, `Nexus`)
   - License Key Suffix (e.g. `A9F2`)
   - Hardware ID (e.g. `DESKTOP-CHIRAG`)

---

### C. Live Per-User AI & Speech Quota Tracker

Currently, `/admin/releases` only shows aggregate platform-wide numbers (e.g., 80 requests across all users). You cannot see who is using what.

#### The Upgrade:
Each license card will feature a live **📊 AI & Speech Quotas** telemetry box:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 📊 AI Brain & Speech Quotas                                            │
├────────────────────────────────────────────────────────────────────────┤
│ • AI Questions (24h):  15 / 300 used  ➔  285 remaining [██░░░░░░░░]  │
│ • AI Questions (7d):   45 / 1500 used ➔  1,455 remaining               │
│ • AI Questions (30d): 110 / 4000 used ➔  3,890 remaining               │
│ • Token Usage:        24,500 tokens (~$0.0031 USD total cost)          │
│ • Groq STT Fallback:   8 / 500 chunks used ➔  492 remaining (54.2s)    │
│                                                                        │
│ [ 📜 View Recent Request Log (Latest 10 Prompts) ]                     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Recent Request Log Modal:
Clicking **"View Recent Request Log"** opens a table of their latest activity:
- **Timestamp:** e.g. `Nov 13, 01:05 AM`
- **Task:** `voice_text` (Interview Q&A) / `coding` / `vision`
- **Model:** `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
- **Tokens:** `Prompt: 450 | Answer: 120`
- **Status:** `Completed` (or `Failed: character limit`)

---

### D. Fixing the Customer Self-Release Lockout Bug

#### The Root Cause:
In migration `055_customer_device_release.sql`, releasing a device executed:
```sql
UPDATE public.devices SET active = false WHERE id = p_device_id;
```
Then, when the customer launched Voro again on that same machine, the system checked:
```sql
IF FOUND THEN
  IF NOT v_device.active THEN 
    RETURN jsonb_build_object('error', 'This device has been blocked by the administrator.'); 
  END IF;
```
Because the row remained in the database with `active = false`, the system treated a voluntary slot release as a permanent administrative ban!

#### The Fix:
1. Releasing a device will delete the row (`DELETE FROM public.devices`), exactly as the admin device reset does.
2. In `activate_agent_license`, if a device row exists with `active = false` (or expired ban), but the user presents their valid license key and has open slots, it automatically reactivates cleanly.
3. Automatically unban any currently blocked device records so your PC can use Voro again immediately.

---

## 3. Technical Architecture & Database Design

### A. Schema Enhancements (`supabase/migrations/065_admin_license_device_management.sql`)

```sql
-- 1. Add ban duration and reason fields to public.devices
ALTER TABLE public.devices 
  ADD COLUMN IF NOT EXISTS banned_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ban_reason text DEFAULT NULL;

-- 2. Function for Admin to Ban a Hardware ID with duration
CREATE OR REPLACE FUNCTION public.admin_ban_device(
  p_device_id uuid,
  p_duration text, -- '24h', '7d', '1m', 'lifetime'
  p_reason text DEFAULT 'Admin ban'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_until timestamptz;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator']);
  
  IF p_duration = '24h' THEN
    v_until := now() + interval '24 hours';
  ELSIF p_duration = '7d' THEN
    v_until := now() + interval '7 days';
  ELSIF p_duration = '1m' THEN
    v_until := now() + interval '30 days';
  ELSIF p_duration = 'lifetime' THEN
    v_until := '9999-12-31 23:59:59+00'::timestamptz;
  ELSE
    RAISE EXCEPTION 'Invalid ban duration. Use 24h, 7d, 1m, or lifetime.';
  END IF;

  UPDATE public.devices 
  SET active = false, 
      banned_until = v_until, 
      ban_reason = p_reason 
  WHERE id = p_device_id;

  INSERT INTO private.audit_log(actor_id, action, target_id, reason)
  VALUES(auth.uid(), 'device.banned', p_device_id::text, p_duration || ': ' || COALESCE(p_reason, ''));

  RETURN jsonb_build_object('ok', true, 'banned_until', v_until);
END;
$$;

-- 3. Function for Admin to Unban a Hardware ID
CREATE OR REPLACE FUNCTION public.admin_unban_device(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator']);

  UPDATE public.devices 
  SET active = true, 
      banned_until = NULL, 
      ban_reason = NULL 
  WHERE id = p_device_id;

  INSERT INTO private.audit_log(actor_id, action, target_id)
  VALUES(auth.uid(), 'device.unbanned', p_device_id::text);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4. Function for Admin or Customer to Unlink/Remove a Hardware ID cleanly
CREATE OR REPLACE FUNCTION public.admin_remove_device(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  DELETE FROM public.devices WHERE id = p_device_id;

  INSERT INTO private.audit_log(actor_id, action, target_id)
  VALUES(auth.uid(), 'device.removed', p_device_id::text);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. Fix customer release_device to delete cleanly rather than setting active = false
CREATE OR REPLACE FUNCTION public.release_device(p_device_id uuid, p_license_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.licenses WHERE id = p_license_id;
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Permission denied or license not found.';
  END IF;

  -- Delete the device so the slot is cleanly freed without marking as banned
  DELETE FROM public.devices WHERE id = p_device_id AND license_id = p_license_id;

  INSERT INTO private.audit_log(actor_id, action, target_id) 
  VALUES(auth.uid(), 'device.released', p_device_id::text);
END;
$$;
```

---

### B. Per-User Quota & Usage Calculator Function

To avoid heavy queries on every page load, a dedicated PostgreSQL RPC function will calculate usage and remaining quotas on demand:

```sql
CREATE OR REPLACE FUNCTION public.admin_get_license_telemetry(p_license_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lic RECORD;
  v_policy RECORD;
  v_ai_24h integer;
  v_ai_7d integer;
  v_ai_30d integer;
  v_ai_tokens bigint;
  v_ai_cost numeric;
  v_stt_24h integer;
  v_devices jsonb;
  v_recent_ai jsonb;
BEGIN
  PERFORM private.require_staff(ARRAY['owner', 'administrator', 'support']);

  SELECT l.id, l.user_id, l.product_id, l.status, l.expires_at, l.max_devices
  INTO v_lic FROM public.licenses l WHERE l.id = p_license_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'License not found');
  END IF;

  SELECT * INTO v_policy FROM public.agent_ai_policies WHERE product_id = v_lic.product_id;

  -- AI usage counts
  SELECT COUNT(*) INTO v_ai_24h FROM public.agent_ai_usage_logs
  WHERE license_id = p_license_id AND status = 'completed' AND created_at >= (now() - interval '24 hours');

  SELECT COUNT(*) INTO v_ai_7d FROM public.agent_ai_usage_logs
  WHERE license_id = p_license_id AND status = 'completed' AND created_at >= (now() - interval '7 days');

  SELECT COUNT(*) INTO v_ai_30d FROM public.agent_ai_usage_logs
  WHERE license_id = p_license_id AND status = 'completed' AND created_at >= (now() - interval '30 days');

  SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0), COALESCE(SUM(cost_usd), 0)
  INTO v_ai_tokens, v_ai_cost FROM public.agent_ai_usage_logs
  WHERE license_id = p_license_id AND status = 'completed';

  -- STT usage count
  SELECT COUNT(*) INTO v_stt_24h FROM public.agent_stt_usage_logs
  WHERE license_id = p_license_id AND status = 'completed' AND created_at >= (now() - interval '24 hours');

  -- Devices with ban expiration checking
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'installation_id', d.installation_id,
    'active', d.active,
    'last_seen_at', d.last_seen_at,
    'banned_until', d.banned_until,
    'is_banned', (NOT d.active OR (d.banned_until IS NOT NULL AND d.banned_until > now())),
    'ban_reason', d.ban_reason
  )), '[]'::jsonb) INTO v_devices
  FROM public.devices d WHERE d.license_id = p_license_id;

  -- Recent 10 turns
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'task_key', u.task_key,
    'model_used', u.model_used,
    'prompt_tokens', u.prompt_tokens,
    'completion_tokens', u.completion_tokens,
    'cost_usd', u.cost_usd,
    'status', u.status,
    'created_at', u.created_at
  )), '[]'::jsonb) INTO v_recent_ai
  FROM (
    SELECT * FROM public.agent_ai_usage_logs
    WHERE license_id = p_license_id
    ORDER BY created_at DESC LIMIT 10
  ) u;

  RETURN jsonb_build_object(
    'license_id', p_license_id,
    'devices', v_devices,
    'ai', jsonb_build_object(
      'used_24h', v_ai_24h,
      'limit_24h', COALESCE(v_policy.daily_limit, 0),
      'left_24h', CASE WHEN COALESCE(v_policy.daily_limit, 0) = 0 THEN -1 ELSE GREATEST(0, v_policy.daily_limit - v_ai_24h) END,
      'used_7d', v_ai_7d,
      'limit_7d', COALESCE(v_policy.weekly_limit, 0),
      'used_30d', v_ai_30d,
      'limit_30d', COALESCE(v_policy.monthly_limit, 0),
      'total_tokens', v_ai_tokens,
      'total_cost_usd', ROUND(v_ai_cost, 4)
    ),
    'stt', jsonb_build_object(
      'used_24h', v_stt_24h,
      'limit_24h', COALESCE(v_policy.stt_daily_limit, 0),
      'left_24h', CASE WHEN COALESCE(v_policy.stt_daily_limit, 0) = 0 THEN -1 ELSE GREATEST(0, v_policy.stt_daily_limit - v_stt_24h) END
    ),
    'recent_logs', v_recent_ai
  );
END;
$$;
```

---

## 4. UI Implementation Plan (`Workspace.tsx`)

1. **Card Header:**
   - Display `l.customer` and `l.email` side-by-side with a copy pill.
2. **Device Hardware Sub-Card:**
   - Lists every connected HWID.
   - Shows live ban status with countdown badge (e.g. `Banned (Expires in 5 days)`).
   - Action buttons:
     - `[ Remove Device ]` (confirms removal and frees slot)
     - `[ 🚫 Ban Device ]` (opens duration select modal: 24h, 7d, 1m, Lifetime)
     - `[ ✅ Unban ]` (instantly unlocks)
3. **Usage Bar & Limits Badge:**
   - Inline mini telemetry: `AI 24h: 12/300 (288 left) | STT 24h: 4/500 (496 left) | $0.002 spent`.
   - `[ 📊 Details ]` button opening a modal with full 7d/30d stats and the 10 recent prompt turns.

---

## 5. Verification Plan

1. **Unit & Database Tests:**
   - Verify `admin_ban_device` applies 24h, 7d, 1m, and lifetime intervals properly.
   - Verify an active ban rejects `activate_agent_license` and `verify_online_lease` with HTTP 403 and the exact ban expiration time.
   - Verify `admin_unban_device` clears the ban and allows activation immediately.
   - Verify customer `release_device` deletes the record without banning the machine.
2. **Admin UI Tests:**
   - Verify customer email renders and can be searched.
   - Verify clicking "Ban" prompts for duration and updates device status in the UI.
   - Verify usage telemetry calculates used vs left correctly.
3. **Desktop Agent Verification:**
   - Verify Voro unblocks and runs normally on your unblocked device.

---

## 6. Next Steps

Once you review and confirm this plan:
1. We will generate the migration `065_admin_license_device_management.sql`.
2. Update backend endpoints in `apps/api/live.ts`.
3. Enhance the `/admin/licenses` view in `apps/web/src/ui/Workspace.tsx`.
4. Run full automated test suites to ensure zero regressions across the platform.
