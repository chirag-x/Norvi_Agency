# Phase 1: Database Schema, RPCs & Backend Impersonation Engine

**Status:** ✅ Completed and Verified (4/4 DB tests, 5/5 API tests passing, 0 TypeScript errors)

**Goal:** Upgrade backend customer APIs, RPCs, and session impersonation mechanics so the customer's real data (licenses, orders, devices) loads seamlessly when using "Login As", and customer purchases include total spend and purchased agents.

---

## 1. Database Schema & RPC Updates

### A. Migration: `supabase/migrations/066_admin_customer_purchases_and_impersonation.sql`
1. **Updated `public.admin_list_customers()`:**
   - Queries `auth.users` for real email.
   - Aggregates paid order total spend:
     ```sql
     COALESCE((
       SELECT ROUND(SUM(o.amount_minor) / 100.0, 2)
       FROM public.orders o 
       WHERE o.user_id = p.id AND o.status = 'paid'
     ), 0.0) AS "totalSpent"
     ```
   - Aggregates distinct purchased products array:
     ```sql
     COALESCE((
       SELECT json_agg(json_build_object(
         'id', prod.id,
         'slug', prod.slug,
         'name', prod.name
       ))
       FROM (
         SELECT DISTINCT prod.id, prod.slug, prod.name
         FROM public.orders o
         JOIN public.products prod ON prod.id = o.product_id
         WHERE o.user_id = p.id AND o.status = 'paid'
       ) prod
     ), '[]'::json) AS "purchasedProducts"
     ```
   - Returns `orderCount`, `activeLicenses`, `totalSpent`, `purchasedProducts`, `status`, `createdAt`.

2. **New RPC: `public.admin_get_customer_orders(p_customer_id uuid)`:**
   - Security Definer requiring `owner`, `administrator`, or `support`.
   - Returns full order list for that specific customer:
     - `order_id`, `product_id`, `product_name`, `product_slug`
     - `amount_minor`, `currency`, `amount_formatted`
     - `status`, `provider_order_id`, `provider_payment_id`
     - `created_at`
     - `license_suffix`: key suffix of the associated license (`NORVI-••••-ABCD`).

---

## 2. Backend API Updates in `apps/api/live.ts`

### A. Impersonation Middleware & Endpoint Fixes
1. **Role Access:**
   - Updated `POST /api/admin/impersonate` to allow both `'owner'` and `'administrator'`.
   - Updated route section checking: mapped `first === 'impersonate' ? '/customers'` so administrators with customer permissions can impersonate.
2. **Real Customer Email Resolution:**
   - Look up real customer email from `auth.users` via `adminDb` instead of placeholder `'impersonated@hidden'`.
3. **RLS Bypass in `GET /api/account`:**
   - When `user.isImpersonated === true`, use `adminDb` (service role client) to fetch the customer's actual:
     - Licenses (`licenses`)
     - Connected devices (`devices`)
     - Orders (`orders`)
     - Support requests (`support_requests`)
   - This ensures the owner/admin sees the customer's live account state accurately without 0-row RLS blockage.

### B. Customer Orders Endpoint
4. **`GET /api/admin/customers/:id/orders`:**
   - Role check: `owner`, `administrator`, `support`.
   - Calls `admin_get_customer_orders` RPC.
   - Returns `{ customerId, customerName, customerEmail, orders: [...] }`.

---

## 3. Phase 1 Verification Checklist
- [x] Migration `066_admin_customer_purchases_and_impersonation.sql` applied.
- [x] Vitest database tests (`tests/admin-customers.test.ts`): 4/4 passed.
- [x] Vitest API tests (`tests/admin-customers-api.test.ts`): 5/5 passed.
- [x] Zero TypeScript errors (`npm run check`).
