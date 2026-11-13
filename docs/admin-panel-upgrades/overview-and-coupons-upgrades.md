# Overview Dashboard & Coupons Tab Upgrades

This document details the upgrades implemented in the **Overview Dashboard (`/admin`)** and **Coupons & Promotions Tab (`/admin/promotions`)**.

---

## 1. Overview Dashboard (`/admin`)

### Revenue Period Breakdown Cards
Replaced the single 30-day metric card with 4 period-specific breakdown cards displaying commercial volume in ₹ INR alongside paid order counts:
1. **Revenue (Today):** Orders captured since 00:00:00 UTC/IST today.
2. **Revenue (7 Days):** Orders captured within the past rolling 7 days.
3. **Revenue (30 Days):** Orders captured within the past rolling 30 days.
4. **Revenue (All-Time):** Cumulative all-time paid gross revenue.

### Operational Metrics Cards
Displays operational health indicators:
- **Active Licenses:** Real-time count of active deployment licenses across all agents.
- **Total Customers:** Registered customer accounts (excluding staff members).
- **Total Orders (Paid):** Strictly counts **actual commercial paid orders** where money was paid (`amount_minor > 0` with real payment ID). Displays `+X trials & gifts` to indicate separate promotional volume.

### Separation of Commercial Sales vs Promotional Activations
Previously, the database marked free trials (`trial_%`), gifted licenses (`gift_%`), and 100% discount coupons (`free_%`) as `status = 'paid'` with `amount_minor = 0`. As a result, the dashboard counted all 39 promotional activations (18 gifts, 14 free trials, 7 zero-rupee coupons) alongside the 8 actual commercial test purchases, displaying a false total of 47 paid orders and incorrectly attributing paid orders to Rolvio and Nexus.

The upgraded analytics engine strictly segregates:
- **Commercial Paid Orders:** `status = 'paid' AND amount_minor > 0 AND provider_payment_id NOT LIKE 'trial_%' AND NOT LIKE 'gift_%' AND NOT LIKE 'free_%'`.
  - **Voro:** 8 paid orders (₹15.80 revenue).
  - **Rolvio:** 0 paid orders (₹0 revenue, 8 gifts/trials).
  - **Nexus:** 0 paid orders (₹0 revenue, 4 gifts/trials).
  - **Total Commercial Paid Orders:** **8**.
- **Promotional Activations:** Tracked separately under `Trials & Gifts` column in the leaderboard and in order lists with distinct badges: `Free Trial`, `Gifted`, and `100% Promo`.

### Top-Selling Agents Leaderboard
A dedicated performance panel ranking all agents (e.g. Voro, Rolvio, Nexus) by commercial revenue in descending order:
- **Rank Badge:** Highlighting `#1`, `#2`, `#3` positions.
- **Agent Identity:** Name with a direct link to the storefront listing (`/[slug] ↗`).
- **Catalog Status:** `Published`, `Draft`, or `Archived`.
- **Paid Orders Count:** Total volume of orders fulfilled for this product.
- **Active Licenses Count:** Active hardware machines currently deployed for this product.
- **Total Revenue:** Gross amount earned in ₹ INR highlighted in brand lime green.

---

## 2. Coupons Tab (`/admin/promotions`)

### Redemption Progress & Usage Tracking
- **Usage Tracking Columns:** Displays actual redemptions against the configured limit (e.g. `12 / 50 uses`, `10 / 10 uses`, or `5 / Unlimited`).
- **Exhausted Badging:** When a coupon reaches its limit (`used_count >= max_uses`), it displays an `Exhausted` alert badge and automatically rejects further checkout usage.
- **Expiration Dates:** Formatted expiration timestamp with real-time `Expired` indicator if past due.

### Configurable Usage Limit
- **Max Redemptions Input:** Form field `Usage Limit (Max Redemptions)` (defaults to 50, or left blank for unlimited redemptions).
- **Checkout Enforcement:** `validate_promo_code()` and `create_checkout_order()` verify that `(max_uses IS NULL OR used_count < max_uses)` before granting discounts.

---

## 3. Migration & Verification

- **Database Migration:** [`supabase/migrations/068_overview_analytics_and_coupons.sql`](file:///e:/Agency/supabase/migrations/068_overview_analytics_and_coupons.sql)
- **API Server Handlers:** [`apps/api/live.ts`](file:///e:/Agency/apps/api/live.ts) & [`apps/api/app.ts`](file:///e:/Agency/apps/api/app.ts)
- **Frontend Workspace:** [`apps/web/src/ui/Workspace.tsx`](file:///e:/Agency/apps/web/src/ui/Workspace.tsx)
- **Automated Tests:**
  - [`tests/admin-overview-and-coupons.test.ts`](file:///e:/Agency/tests/admin-overview-and-coupons.test.ts) (Database logic & API endpoints)
  - [`tests/admin-overview-and-coupons-ui.test.tsx`](file:///e:/Agency/tests/admin-overview-and-coupons-ui.test.tsx) (UI component rendering)
