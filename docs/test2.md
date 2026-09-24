# Testing Documentation (Phases 0 - 7)

This document tracks the verification steps and testing plans for each phase of the Norvi project.

## Phase 0: Baseline & Deployment
- [x] Verify project builds successfully (`npm run build`).
- [x] Confirm environment variables (`APP_ORIGIN`, `SUPABASE_URL`, etc.) map correctly on Netlify.

## Phase 1: Authentication & Routing
- [x] Test new user registration flow (sends confirmation email).
- [x] Test login/logout and session persistence.
- [x] Verify unauthorized users are redirected to `/login` when accessing `/account` or `/admin`.

## Phase 2: Database & Workspaces
- [x] Test RLS policies (users can only see their own orders/licenses).
- [x] Validate cascading deletes (account deletion removes licenses, orders, devices).

## Phase 3: Commerce & Webhooks
- [x] Test mock checkout flow (`/api/checkout/create`).
- [x] Verify the webhook endpoint safely deduplicates idempotency keys.
- [x] Confirm `process_payment_webhook` accurately transitions an order from `pending` to `paid`.
- [x] Ensure Outbox triggers an email correctly upon payment.

## Phase 4: License & Agent Security
- [x] Test `activate_agent_license` rejects revoked or expired keys.
- [x] Verify JWT generation with 7-day offline grace period.
- [x] Validate `pgp_sym_encrypt` and `pgp_sym_decrypt` successfully encrypt and decrypt license keys at rest.
- [x] Check Admin UI can successfully generate, rotate, and revoke keys.

## Phase 5: Product Delivery & Email Automation
- [x] Test Netlify Scheduled Function (`cron.ts`) pings the Outbox processor every 5 minutes.
- [x] Verify CSRF exemptions for internal webhooks and cron paths.

## Phase 6: Admin Operations
- [x] Test inviting team members via Admin UI.
- [x] Confirm staff roles (owner, support, etc.) correctly enforce access controls.
- [x] Test resetting a customer's device limits from the admin dashboard.

## Phase 7: Public Website Content
- [x] Verify all placeholders (e.g. `billing_Term`, `name_Company`) are completely replaced.
- [x] Test formatting of Legal, Terms, and Privacy pages.
- [x] Check that the 1-day free trial messaging is accurate across the site.
- [x] Validate the Contact form submits gracefully.
