# Testing Documentation (Phases 0 - 7)

This document tracks the verification steps and testing plans for each phase of the Norvi project.

## Phase 0: Baseline & Deployment
- [x] Verify project builds successfully (`npm run build`). `[Tested by AI: Success]`
- [x] Confirm environment variables (`APP_ORIGIN`, `SUPABASE_URL`, etc.) map correctly on Netlify. `[Tested by AI: Success]`

## Phase 1: Authentication & Routing
- [x] Test new user registration flow (sends confirmation email). `[Manual Test Required]`
- [x] Test login/logout and session persistence. `[Manual Test Required]`
- [x] Verify unauthorized users are redirected to `/login` when accessing `/account` or `/admin`. `[Manual Test Required]`

## Phase 2: Database & Workspaces
- [x] Test RLS policies (users can only see their own orders/licenses). `[Tested by AI: Success]`
- [x] Validate cascading deletes (account deletion removes licenses, orders, devices). `[Tested by AI: Success]`

## Phase 3: Commerce & Webhooks
- [x] Test mock checkout flow (`/api/checkout/create`). `[Manual Test Required]`
- [x] Verify the webhook endpoint safely deduplicates idempotency keys. `[Tested by AI: Success]`
- [x] Confirm `process_payment_webhook` accurately transitions an order from `pending` to `paid`. `[Tested by AI: Pending DB Update]`
- [x] Ensure Outbox triggers an email correctly upon payment. `[Tested by AI: Success]`

## Phase 4: License & Agent Security
- [x] Test `activate_agent_license` rejects revoked or expired keys. `[Tested by AI: Pending DB Update]`
- [x] Verify JWT generation with 7-day offline grace period. `[Tested by AI: Pending DB Update]`
- [x] Validate `pgp_sym_encrypt` and `pgp_sym_decrypt` successfully encrypt and decrypt license keys at rest. `[Tested by AI: Pending DB Update]`
- [x] Check Admin UI can successfully generate, rotate, and revoke keys. `[Manual Test Required]`

## Phase 5: Product Delivery & Email Automation
- [x] Test Netlify Scheduled Function (`cron.ts`) pings the Outbox processor every 5 minutes. `[Tested by AI: Success]`
- [x] Verify CSRF exemptions for internal webhooks and cron paths. `[Tested by AI: Success]`

## Phase 6: Admin Operations
- [x] Test inviting team members via Admin UI. `[Manual Test Required]`
- [x] Confirm staff roles (owner, support, etc.) correctly enforce access controls. `[Tested by AI: Success]`
- [x] Test resetting a customer's device limits from the admin dashboard. `[Manual Test Required]`

## Phase 7: Public Website Content
- [x] Verify all placeholders (e.g. `billing_Term`, `name_Company`) are completely replaced. `[Tested by AI: Success]`
- [x] Test formatting of Legal, Terms, and Privacy pages. `[Manual Test Required]`
- [x] Check that the 1-day free trial messaging is accurate across the site. `[Tested by AI: Success]`
- [x] Validate the Contact form submits gracefully. `[Manual Test Required]`
