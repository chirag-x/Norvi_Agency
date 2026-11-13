# Phase 6: Direct Team Recruitment, Auto-Claim on Login & Strict 2FA Security

**Document Version:** 1.0.0  
**Status:** In Progress / Implementation  
**Target Environments:** Live Supabase & Synthetic Preview Mode  

---

## 1. Problem Statement & Root Cause Analysis

### The Issue
When an administrator attempts to recruit an existing registered customer to the Norvi Agency team via `/admin/team`:
1. The Owner sends an invitation to the teammate's email (e.g., `kartikchauhan2021feb@gmail.com`) for a staff role (e.g., `Administrator`).
2. An invitation record is inserted into `public.staff_invitations` with `status = 'pending'`.
3. The teammate receives the email containing an invitation link directing them to `/register`.
4. Because the user is **already registered** as a customer on the platform:
   - They cannot register a new account.
   - When they log in using their existing email and password, Supabase simply verifies credentials and generates a session JWT.
5. **The Glitch:** The database trigger responsible for claiming invitations (`claim_staff_invitation_trigger`) was configured as `AFTER INSERT ON auth.users`. Because logging in does **not** insert a new row into `auth.users`, the trigger never fired.
6. The user was never added to `public.staff_memberships`. Consequently:
   - Their role remained locked as `'customer'`.
   - The invitation remained permanently stuck in `Pending` state.
   - When attempting to navigate to `/admin`, access was denied.

---

## 2. Mandatory Security Invariant: Strict Two-Factor Authentication (2FA / AAL2)

> [!IMPORTANT]
> **Zero Admin Access Without 2FA:** Under no circumstances is 2FA bypassed for promoted staff. Whether a member is recruited via Direct Promotion or accepts an invitation link, **two-factor authorization (MFA / TOTP) remains strictly mandatory** before any access to the admin panel or admin APIs is granted.

### The 2FA Enforcement Architecture:
1. **Role Promotion:** When a user is promoted to `administrator`, `product_manager`, or `support`, their role in `public.staff_memberships` updates from `customer` to their assigned staff role.
2. **Immediate Lockout on Login:**
   - In `apps/api/live.ts`, the auth middleware checks:
     ```typescript
     c.set('mfaRequired', (userObj.role !== 'customer' || assurance.data.nextLevel === 'aal2') && assurance.data.currentLevel !== 'aal2');
     ```
   - For all non-customer roles (`role !== 'customer'`), if `currentLevel !== 'aal2'` (i.e. TOTP code has not been entered for the active session), `mfaRequired` evaluates to **`true`**.
3. **Frontend Intercept Screen (`apps/web/src/ui/Workspace.tsx`):**
   - The moment a newly promoted staff member opens `/admin`, the page blocks all navigation and data:
     ```tsx
     if (identity.mfaRequired) {
       return (
         <div className="container page">
           <Notice>Complete authenticator verification to access your account.</Notice>
           <a className="button primary" href="/account/security">Open account security</a>
         </div>
       );
     }
     ```
   - No administrative tabs (Orders, Customers, Licenses, Content, Releases, Settings) are visible or accessible.
4. **Setup Flow at `/account/security`:**
   - The promoted member clicks **"Open account security"**.
   - They scan their secret QR code using Google Authenticator, Microsoft Authenticator, or Authy.
   - They submit their 6-digit TOTP code.
   - Upon successful verification, Supabase upgrades their session assurance level to `aal2`.
   - Only then does `/admin` unlock.
5. **Database Hard Check (PostgreSQL Defense-in-Depth):**
   - All privileged administrative RPCs (e.g. `admin_list_products`, `admin_list_customers`, `admin_list_licenses`, `admin_update_staff_role`) enforce:
     ```sql
     if coalesce(auth.jwt()->>'aal', '') != 'aal2' then
       raise exception 'Permission denied: MFA (AAL2) required.';
     end if;
     ```
   - Even direct API calls cannot execute administrative commands without an `aal2` verified JWT.

---

## 3. Upgrades & Solutions Implemented

### Feature A: Direct Recruit Registered Member Panel
Added to `/admin/team` between "Your team" and "Invite a teammate":
- **Input Fields:**
  - `Registered account email`: Text/email input.
  - `Assign staff role`: Dropdown (`Administrator`, `Product Manager`, `Support`).
- **Action Button:** `Direct Recruit to Team ⚡`
- **Behavior:**
  - Checks if the user exists in `auth.users` / `public.profiles`.
  - Directly creates/updates an active entry in `public.staff_memberships`.
  - Marks any pending invitations for that email as `accepted`.
  - Emits an entry to `private.audit_log`.
  - The user immediately appears in **"Your team"** list.
  - When the teammate logs in, they are immediately prompted for mandatory 2FA enrollment.

### Feature B: Auto-Claim Invitation on Login
Added to the API authentication middleware (`apps/api/live.ts`):
- When an authenticated user connects, if they do not yet have a staff membership:
  - Check if their verified email has a `status = 'pending'` record in `public.staff_invitations`.
  - If a pending invitation exists, automatically promote them to `public.staff_memberships` with the invited role and update the invitation status to `'accepted'`.
  - Immediately flag `mfaRequired = true`, locking them to the 2FA setup screen until verified.

---

## 4. Technical Specifications & File Manifest

| File | Purpose |
|------|---------|
| `docs/storefront-and-support-upgrade/phase-06-team-direct-recruit-and-invitation-claim.md` | This architectural and verification specification |
| `supabase/migrations/069_team_direct_recruit_and_claim.sql` | PostgreSQL RPC functions: `admin_direct_promote_staff` and `claim_pending_staff_invitation` |
| `apps/api/live.ts` | Endpoint `POST /api/admin/team/promote` + auth middleware invite auto-claim |
| `apps/api/app.ts` | Endpoint `POST /api/admin/team/promote` for synthetic preview mode |
| `apps/web/src/ui/Workspace.tsx` | UI form component for "Direct Recruit Registered Customer" in `Team()` |

---

## 5. Verification Checklist

- [ ] `npm run check`: Zero TypeScript errors.
- [ ] `npm test`: 31 test suites, 232+ tests passing.
- [ ] Database verification: `admin_direct_promote_staff` callable by Owner only.
- [ ] Test direct recruit with `kartikchauhan2021feb@gmail.com`:
  - Verified added to `staff_memberships` as `administrator`.
  - Verified pending invitation marked as `accepted`.
  - Verified 2FA gate blocks admin until TOTP verification is complete.
