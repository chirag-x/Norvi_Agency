# Admin Panel Upgrades & Enhancements

This documentation covers the completed upgrades across the **Overview Dashboard (`/admin`)**, **Coupons & Promotions (`/admin/promotions`)**, **Orders (`/admin/orders`)**, **Products (`/admin/products`)**, and **Activity Logs (`/admin/activity`)** sections of the NORVI Agency Admin Panel.

---

## 1. Summary of Upgrades

| Tab | Feature | Description | Status |
| :--- | :--- | :--- | :--- |
| **Overview (`/admin`)** | **Revenue Breakdown (Today, 7d, 30d, All-Time)** | 4 distinct metric cards displaying revenue in ₹ INR and paid order counts for each timeframe. | ✅ Completed |
| **Overview (`/admin`)** | **Top-Selling Agents Leaderboard** | Full ranking table displaying agent name, status, paid orders, active licenses, and total revenue. | ✅ Completed |
| **Coupons (`/admin/promotions`)** | **Redemption Progress & Limits** | Displays `used_count / max_uses` (e.g. `12 / 50 uses` or `Unlimited`) with Exhausted & Expired badges. | ✅ Completed |
| **Coupons (`/admin/promotions`)** | **Configurable Usage Limits** | Input to set max redemptions when creating promo codes; enforced at checkout. | ✅ Completed |
| **Orders (`/admin/orders`)** | **Customer Email & 1-Click Copy** | Displays customer registered email directly in the table with an instant copy button. | ✅ Completed |
| **Orders (`/admin/orders`)** | **Gateway Payment ID (`pay_...`)** | Displays Razorpay payment ID with 1-click copy for fast verification in Razorpay Dashboard. | ✅ Completed |
| **Orders (`/admin/orders`)** | **Search & Status Filtering** | Filter by `All`, `Paid`, `Pending`, `Refunded` or search by customer name, email, order ID, payment ID, or agent. | ✅ Completed |
| **Orders (`/admin/orders`)** | **Linked License Badges** | Shows associated activation key suffix (`NORVI-••••-ABCD`) linking to the Licenses tab. | ✅ Completed |
| **Orders (`/admin/orders`)** | **Summary Metrics & CSV Export** | Stat cards showing total order count and total paid revenue; enhanced CSV export with emails and payment IDs. | ✅ Completed |
| **Products (`/admin/products`)** | **Quick Status Selector** | Auto-saving dropdown (`Published`, `Draft`, `Archived`) directly on each product card without opening the modal. | ✅ Completed |
| **Products (`/admin/products`)** | **Live Page Link** | Direct `[ View Page ↗ ]` button opening `/agents/[slug]` in a new tab. | ✅ Completed |
| **Activity (`/admin/activity`)** | **Search & Filter** | Instant search filter to find actions (e.g. `delete`, `suspend`, `gift`, `impersonate`, `ban`) or actor emails. | ✅ Completed |

---

## 2. Detailed Upgrade Guides

- [Overview Dashboard & Coupons Tab Upgrades](file:///e:/Agency/docs/admin-panel-upgrades/overview-and-coupons-upgrades.md)
- [Orders, Products & Activity Upgrades](file:///e:/Agency/docs/admin-panel-upgrades/orders-and-catalog-upgrades.md)

---

## 3. Database Migrations

- `066_admin_customer_purchases_and_impersonation.sql`: Customer purchases, order modal RPC, account deletion RPC.
- `067_admin_orders_and_activity_enhancements.sql`: Orders customer email & payment ID telemetry, product status RPC.
- `068_overview_analytics_and_coupons.sql`: Revenue timeframes (Today, 7d, 30d, All-Time), Agent Leaderboard, Coupon max_uses and used_count tracking.
