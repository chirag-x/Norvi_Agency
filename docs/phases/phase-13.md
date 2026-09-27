# Phase 13 - The Partner & Affiliate Engine

**Status:** Completed

## Implementation Summary:
Instead of relying on fragile cookie-tracking links, we implemented a robust **Referral Code System** natively embedded into the checkout flow. This creates a highly incentivized loop: buyers receive a discount, partners earn commissions, and the agency secures guaranteed sales.

### 1. Database Foundation
- Created the `affiliates` table to store unique referral codes (e.g. `CHIRAG10`) tied to user accounts.
- Created `affiliate_commissions` and `payout_requests` tables.
- Updated `process_payment_webhook` (`038_affiliate_commissions.sql`) to automatically credit 15% of the final `amount_minor` to the affiliate's balance upon successful payment.

### 2. The Customer Dashboard (Partner Program)
- **Code Generation:** Customers can choose and generate their own unique referral code directly from the `Partner Program` tab in their Workspace.
- **Live Statistics:** The dashboard displays Total Sales, Pending Earnings, and Total Earned.
- **Automated Payouts:** Once the pending balance crosses the ₹2000 threshold, the UI unlocks a "Request Payout" form requiring their UPI ID or Bank Details.

### 3. The Checkout Page (Buyer Incentive)
- Added an optional **Referral Code** input directly above the payment details on the checkout page.
- Implemented real-time debounced validation. If a valid code is entered, the UI renders a green tick (✅ Applied) and visually slashes the original price with a strikethrough, rendering the new **10% discounted price** in bold green text.
- The `create_checkout_order` backend RPC applies this 10% discount to the final amount sent to Razorpay and attaches the `affiliate_id` to the order.

### 4. Admin Affiliate Manager
- Added the **Partners & Payouts** tab to the Admin Workspace.
- **Payout Requests:** Admins can view pending requests, manually transfer the funds via UPI, and click "Mark Paid" to clear the affiliate's pending balance.
- **Active Partners Table:** Displays all partners alongside their code, sales, and total earnings.
- **Moderation:** Admins can instantly **Suspend** an affiliate (invalidating their code at checkout and locking their payout requests) or permanently **Delete** them from the program.
