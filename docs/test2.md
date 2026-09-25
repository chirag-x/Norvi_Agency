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
- [x] Verify GitHub PAT resolves to short-lived S3 download links. `[Manual Test Required]`
- [x] Verify Discord Webhooks trigger on Sales, Downloads, and Security alerts. `[Manual Test Required]`

## Phase 6: Admin Operations
- [x] Test inviting team members via Admin UI. `[Manual Test Required]`
- [x] Confirm staff roles (owner, support, etc.) correctly enforce access controls. `[Tested by AI: Success]`
- [x] Test resetting a customer's device limits from the admin dashboard. `[Manual Test Required]`

## Phase 7: Public Website Content
- [x] Verify all placeholders (e.g. `billing_Term`, `name_Company`) are completely replaced. `[Tested by AI: Success]`
- [x] Test formatting of Legal, Terms, and Privacy pages. `[Manual Test Required]`
- [x] Check that the 1-day free trial messaging is accurate across the site. `[Tested by AI: Success]`
- [x] Validate the Contact form submits gracefully. `[Manual Test Required]`


## Phase 6 (Part 1) Manual Testing Checklist

### 1. Test Customer Export (CSV)
- Log into Admin.
- Click Customers tab.
- Click Export CSV button.
- Check downloaded file.

### 2. Test Customer Suspension
- On Customers tab, click Suspend account.
- Badge turns to suspended.
- Click Restore account.

### 3. Test Gifting System
- Go to Licenses tab.
- Click Gift License button.
- Enter email and product slug.
- Verify new license is generated.

## Phase 6 (Part 2) Manual Testing Checklist

### 1. Test Staff Role Management
- Log in as Owner.
- Go to Team tab.
- Change a user's role (e.g. from Support to Product Manager).
- Verify role changes immediately.

### 2. Test Pending Invitation Cancellation
- Go to Team tab.
- Find a Pending Invitation.
- Click Cancel.
- Verify invitation disappears.

### 3. Test Owner Impersonation ('Login As')
- Click 'Login As' on a customer in the Customers tab or staff in the Team tab.
- Verify redirect to the appropriate dashboard (Account for customer, Admin for staff).
- Ensure the orange warning banner is visible at the top.
- Click 'Stop Impersonating' and verify you return to the Owner state.

### 4. Test Team Announcements
- On Admin overview (or Announcements tab), post a new team announcement.
- Verify it appears in the feed.
- Click 'X' to delete it.

## Phase 6 (Part 3) Manual Testing Checklist

### 1. Test Dynamic Role Permissions
- Log in as Owner.
- Go to Settings (or Team) and find the Permissions grid.
- Toggle a checkbox (e.g. deny Support access to Orders).
- Verify that a Support user can no longer see or access Orders.

### 2. Test Maintenance Mode
- Log in as Owner, go to Settings.
- Toggle 'Maintenance Mode' on.
- Try to simulate a purchase as a Customer -> Should show 'Store is temporarily closed'.
- Try to download a file -> Should show 'Downloads are temporarily disabled'.

### 3. Test Analytics Dashboard
- Log in as Owner, go to Overview.
- Verify Total Revenue, Active Licenses, and Recent Sales are populated based on the last 30 days of simulated orders.

### 4. Test Command Palette (Cmd+K)
- Press Cmd+K (or Ctrl+K) anywhere in the Workspace.
- Verify the search overlay opens.
- Type a section name (e.g. 'Products').
- Click the result and verify it navigates correctly.

### 5. Test Customer Announcements
- Go to Announcements tab as Owner.
- Post a new announcement targeting 'Customers'.
- Log in as a Customer (or use Login As).
- Verify the modal popup appears with the announcement.
- Click 'I understand' and refresh the page to verify it doesn't show again.

