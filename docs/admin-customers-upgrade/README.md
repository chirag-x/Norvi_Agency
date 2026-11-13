# Admin Customers & Impersonation Upgrade

This directory tracks the plan, architecture, and execution phases for upgrading the **Customers Tab** (`/admin/customers`) in the NORVI Agency Admin Panel.

---

## Objectives

1. **Fix "Login As" (Customer Impersonation):**
   - Resolve PostgreSQL Row-Level Security (RLS) blocking customer records (`licenses`, `orders`, `devices`, `support_requests`) from rendering during impersonation.
   - Replace placeholder email (`'impersonated@hidden'`) with the customer's actual registered email address from `auth.users`.
   - Allow both `owner` and `administrator` roles to impersonate customer accounts.
   - Ensure the top impersonation banner is responsive and provides a 1-click **"Stop Impersonating"** exit button returning to `/admin/customers`.

2. **Make Purchases Meaningful & Transparent:**
   - Replace the bare count number (e.g. `0`, `1`) in the **Purchases** column with:
     - **Total Spend Pill:** e.g. `₹499 spent (1 order)` or `₹0 (Free / Trial)`.
     - **Purchased Agent Badges:** e.g. `[Voro]`, `[Rolvio]`.
     - **Interactive Button:** `[ 🛍️ View Orders (X) ]`.
   - **Customer Orders Modal (`CustomerOrdersModal`):**
     - Detailed purchase receipts showing Order ID, Agent name & slug, Amount in ₹ INR, Razorpay payment ID (`pay_...`), date & timestamp, status badge, and linked license key suffix (`NORVI-••••-ABCD`).

3. **Permanent Customer Account Deletion:**
   - Dedicated `[ Delete account ]` button in `/admin/customers` actions column (accessible by `owner` and `administrator`).
   - Browser confirmation prompt warning about permanent data deletion.
   - Database RPC `public.admin_delete_customer()` cascades removal of licenses, secrets, devices, orders, profiles, and `auth.users`.
   - Supabase Admin SDK user deletion and team audit notification.

---

## 2 Concise Execution Phases

| Phase | Title | Documentation | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Database Schema, RPCs & Backend Impersonation Engine | [phase-01-database-and-backend.md](./phase-01-database-and-backend.md) | ✅ Completed |
| **Phase 2** | Customer Purchases UI, Order Details Modal & Login As Polish | [phase-02-customers-ui-and-verification.md](./phase-02-customers-ui-and-verification.md) | ✅ Completed |
