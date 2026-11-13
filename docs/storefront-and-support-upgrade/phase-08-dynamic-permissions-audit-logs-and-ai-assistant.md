# Phase 08: Dynamic Role Permissions, Administrative Audit Trail & AI Support Assistant Stability

**Date:** November 2026  
**Status:** Completed & Production Verified  
**Scope:** Admin Team Dynamic Permissions, Audit & Delivery Tab Overhaul, AI Support Assistant Stability & Scroll Fixes

---

## 1. Executive Summary & Problems Solved

During system operations and administrative workflows, three operational friction points were identified and resolved in Phase 08:

1. **Dynamic Role Permissions Gaps & Owner Security Vulnerability:**
   - **Problem:** The Dynamic Role Permissions section previously omitted the **Overview** dashboard tab (`''`), making it impossible to control whether a staff role could view commercial metrics and top-selling agent leaderboards. Furthermore, the Owner role had no permanent lockout protection in the UI matrix, and there was no fine-grained setting to delegate permission management to designated roles (e.g., Administrator) while restricting others (e.g., Support or Product Manager).
   - **Solution:** 
     - Locked the Owner role permanently to full wildcard access (`*`), visually rendered as checked and disabled.
     - Added the **Overview (Main Dashboard)** section (`''`) to the permissions matrix, allowing owners to toggle overview access per role.
     - Implemented immediate automatic redirection: if a staff role is restricted from Overview, they are seamlessly routed to their first permitted section upon landing on `/admin`.
     - Introduced `manage_role_permissions` delegation: only the Owner and roles granted this security privilege can view and edit the Dynamic Role Permissions section.
     - Backend API middleware enforces strict 403 Forbidden checks on any unauthorized mutation or section access.

2. **Audit & Delivery Tab (`/admin/activity`) Gaps:**
   - **Problem:** The Activity tab only tracked a fraction of administrative mutations. Critical actions such as direct customer recruitment, team invitations, invitation cancellations, role changes, dynamic permissions updates, product status adjustments, deletions, and license mutations were not consistently captured.
   - **Solution:**
     - Connected every administrative mutation across `apps/api/live.ts` and `apps/api/app.ts` to `logAdminAudit()`.
     - Upgraded the Activity UI with a search and category filter (`All Activity`, `Team & Staff`, `Products & Agents`, `Permissions & Settings`, `Security & Keys`).
     - Enhanced each audit entry with category badges, human-readable action titles, actor name and email, target resource ID, note/reason chips, client IP address, and high-precision timestamps.
     - Maintained delivery status logs for customer purchase confirmation emails dispatched via Resend.

3. **NORVI AI Support Assistant Streaming Jitter & Button Clutter:**
   - **Problem 1 (Button Clutter):** A legacy heuristic (`m.content.length > 30`) displayed "WhatsApp Support" and "Contact Us Page" action buttons under *every single response*, even when the AI completely answered the question.
   - **Problem 2 (Viewport Scroll Jitter):** On the `/help` page, every incoming streaming token triggered `window.scrollIntoView({ behavior: 'smooth' })`, displacing the user's viewport down to the search bar and category cards below the chat box, forcing the user to manually scroll back up.
   - **Solution:**
     - Created `isEscalationNeeded(text)`: escalation buttons now render *only* when the AI explicitly indicates it cannot answer, refers the user to human help/WhatsApp/tickets, or when a network/API error occurs.
     - Replaced window-level scrolling with strictly container-scoped scrolling (`chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight`), keeping the user's browser viewport stable at all times.

---

## 2. Technical Implementation Details

### A. Dynamic Role Permissions (`apps/web/src/ui/Workspace.tsx`)
- **Owner Permanent Lock:** The table header and rows now explicitly render the `Owner` column with checked, disabled inputs and tooltip `Owner permanently has full access`. The backend rejects any attempt to modify or strip owner rights (`permissions.owner = ['*']`).
- **Overview Inclusion:** Added `['', 'Overview (Main Dashboard)']` to `sectionsList`. Removed the hardcoded `['', ...updated]` array from the toggle function so that Overview can be enabled or disabled freely per role.
- **Auto-Redirect on Land:** If a staff member with a restricted Overview lands on `/admin`, a `useEffect` detects `!canAccessSlug('')` and performs a `window.location.replace(base + nav[0][0])` to their first accessible tab.
- **Permissions Delegation (`manage_role_permissions`):**
  - Added `manage_role_permissions` as a configurable privilege in the permissions matrix.
  - In `Team`: `const canManagePermissions = isOwner || (settings?.permissions?.[user?.role || ''] || []).includes('manage_role_permissions');`
  - Only authorized staff can view and modify permissions.
- **Live Sync:** Upon saving permissions via `api('/admin/permissions', { method: 'PATCH', body })`, `onCatalogChange()` is invoked, triggering an instant refresh of `settings` across the application without requiring a manual browser reload.

### B. Comprehensive Audit Logging (`apps/api/live.ts` & `supabase/migrations/071_audit_log_and_permissions.sql`)
- **`logAdminAudit` Helper:**
  ```ts
  const logAdminAudit = async (c: any, action: string, targetId: string, reason?: string, metadata?: any) => {
    const user = c.get('user');
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const enrichedMetadata = {
      ...(metadata || {}),
      actorEmail: user?.email || 'system',
      actorName: user?.name || 'Staff'
    };
    await adminDb.rpc('log_action', {
      p_action: action,
      p_target_id: targetId,
      p_reason: reason || null,
      p_metadata: enrichedMetadata,
      p_ip_address: ip
    });
  };
  ```
- **Tracked Mutations:**
  - `staff.promoted_direct`: Direct recruitment from customer to staff role.
  - `staff.invited`: Sent team invitation email.
  - `staff.invite_cancelled`: Cancelled pending invitation.
  - `staff.invite_resent`: Resent invitation email.
  - `staff.role_changed`: Staff role promotion/demotion.
  - `staff.access_toggled`: Staff suspension or reactivation.
  - `settings.permissions_updated`: Dynamic role permissions matrix updates.
  - `settings.updated`: Global agency business profile changes.
  - `content.updated`: Homepage copywriting changes.
  - `product.created`, `product.updated`, `product.deleted`: Agent catalog lifecycle.
  - `product.status_changed`: Release status changes (`draft`, `published`, `archived`).
  - `coupon.created`, `coupon.deleted`: Discount coupon management.
  - `security.impersonation_started`, `security.impersonation_stopped`: Impersonation audit tracking.
  - `license.revoked`, `license.restored`, `license.rotated`: Key management actions.

### C. UI & Visual Upgrade in `/admin/activity`
- Category pills with distinct theme colors:
  - **Team & Staff:** Green (`#4ade80`, `rgba(34, 197, 94, 0.12)`)
  - **Products & Agents:** Blue (`#60a5fa`, `rgba(59, 130, 246, 0.12)`)
  - **Settings & Config:** Amber (`#fbbf24`, `rgba(245, 158, 11, 0.12)`)
  - **Security & Keys:** Coral Red (`#f87171`, `rgba(239, 68, 68, 0.12)`)
  - **System Action:** Lime (`#a3e635`, `rgba(163, 230, 53, 0.12)`)
- Human-readable action titles (e.g., `Direct Staff Promotion`, `Saved Dynamic Role Permissions`, `Staff Impersonation Session`).
- Detailed metadata display including actor name, email, target identifier, IP address, and note/reason box.

### D. AI Support Assistant Stabilization (`apps/web/src/ui/SupportChat.tsx` & `apps/web/src/ui/App.tsx`)
- **`isEscalationNeeded(text)`:** Checks for escalation signals (`whatsapp`, `contact support`, `contact us`, `human support`, `submit a ticket`, `outside my capability`, `unable to resolve`, `cannot answer`, `don't have this information`).
- Button rendering updated from `m.content.length > 30` to `!isUser && (isError || isEscalationNeeded(m.content))`.
- Fixed viewport scrolling:
  ```ts
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);
  ```

---

## 3. Database Migration (`071_audit_log_and_permissions.sql`)

```sql
ALTER TABLE private.audit_log
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE OR REPLACE FUNCTION public.log_action(
  p_action text,
  p_target_id text,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.audit_log (
    actor_id, action, target_id, reason, metadata, ip_address
  ) VALUES (
    coalesce(p_actor_id, auth.uid()), p_action, p_target_id, p_reason, p_metadata, p_ip_address
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_activity()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text; v_items json; v_emails json;
BEGIN
  SELECT role INTO v_role FROM public.staff_memberships WHERE user_id = auth.uid() AND active = true;
  IF coalesce(v_role, '') NOT IN ('owner', 'administrator', 'support') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  SELECT coalesce(json_agg(row_to_json(x)), '[]'::json) INTO v_items FROM (
    SELECT
      a.id,
      coalesce(a.metadata->>'actorName', p.display_name, u.email, 'System') as actor,
      coalesce(a.metadata->>'actorEmail', u.email, '') as "actorEmail",
      a.action, a.target_id as target, a.reason, a.metadata,
      a.ip_address as "ipAddress", a.created_at as "createdAt"
    FROM private.audit_log a
    LEFT JOIN public.profiles p ON p.id = a.actor_id
    LEFT JOIN auth.users u ON u.id = a.actor_id
    ORDER BY a.created_at DESC LIMIT 500
  ) x;

  SELECT coalesce(json_agg(row_to_json(x)), '[]'::json) INTO v_emails FROM (
    SELECT id, order_id as "orderId", status, created_at as "createdAt"
    FROM private.outbox ORDER BY created_at DESC LIMIT 100
  ) x;

  RETURN json_build_object('items', v_items, 'emails', v_emails);
END;
$$;
```

---

## 4. Test & Verification Matrix

| Test Suite | Tests Run | Result | Key Assertions Verified |
| :--- | :---: | :---: | :--- |
| `phase8-permissions-audit-ai.test.ts` | 7 | Passed | Owner wildcard lock, `manage_role_permissions` delegation, Overview toggle restriction, `isEscalationNeeded` accuracy, audit category mapping |
| `tests/analytics.test.ts` | 13 | Passed | Meta Pixel purchase tracking & consent enforcement |
| `tests/admin-license-devices.test.ts` | 12 | Passed | License activation & machine telemetry |
| `tests/admin-customers.test.ts` | 6 | Passed | Customer management & direct promotion |
| `tests/phase7-security-audit.test.ts` | 5 | Passed | Secret scanning & environment boundary validation |
| Full Test Run (`vitest run`) | **239** | **All Passed** | 32 total test files passed with 0 failures |
| TypeScript Type Check (`tsc --noEmit`) | Full Repo | **0 Errors** | Strict type adherence across Astro and React codebases |

---

## 5. Summary of Upgraded Files
- `apps/web/src/ui/SupportChat.tsx`: Added `isEscalationNeeded`, container-scoped scroll, smart action buttons.
- `apps/web/src/ui/App.tsx`: Synchronized chat widget with container-scoped scroll and escalation logic.
- `apps/api/live.ts`: Implemented `logAdminAudit`, wired audit logging to all admin endpoints, enforced `manage_role_permissions` and owner lock.
- `apps/api/app.ts`: Updated preview mode permissions endpoint to enforce `manage_role_permissions` and lock owner permissions.
- `apps/web/src/ui/Workspace.tsx`: Added Activity category filtering, rich audit trail UI, Overview toggle in permissions matrix, Owner lockout protection, and role permission delegation checks.
- `supabase/migrations/071_audit_log_and_permissions.sql`: Created database migration for enriched audit logging and RPCs.
- `tests/phase8-permissions-audit-ai.test.ts`: Added automated test suite for Phase 08 capabilities.
