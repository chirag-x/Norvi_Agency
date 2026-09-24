# Current Development Status

This document tracks the real-time progress of our phase-by-phase development, detailing what is successfully completed, what is pending, and the reasoning behind deferred tasks.

## Phase 3: Payments & Commerce Integration
**Status:** Partially Complete (Paused for Launch)

### Completed:
*   **Part 1 (Backend Order Creation):** Built `/api/checkout/create` endpoint securely inside `apps/api/live.ts` using modern Edge-compatible native `fetch` and Razorpay APIs. Configured environment variables.
*   **Part 2 (Frontend Checkout):** Replaced the simulated checkout button with a dynamic Razorpay popup in `PublicPages.tsx`. It intelligently loads the Razorpay script only in live mode and securely requests an `order_id` from the backend without bloating the Astro bundle.

### Left Pending:
*   **Part 3 (Webhook & DB Fulfillment):** We need to build the `/api/webhooks/razorpay` endpoint to cryptographically verify payments and securely insert official `orders` and `licenses` into the Supabase database.
*   **Why it was left:** Razorpay compliance requires a live domain and published legal policies to approve the account for Live API keys. Furthermore, inserting an order into the database strictly requires a `price_id`, which cannot be created until the official prices are synced between Razorpay and Supabase. Writing this code right now would require messy SQL hacks that bypass database constraints. It is safely paused until the official launch when the domain and products are finalized.

## Phase 4: Agent Delivery & Licensing
**Status:** In Progress

### Completed:
*   **Part 1 (Activation Engine):** 
    *   Created `003_agent_delivery.sql` migration with a highly secure `activate_agent_license` RPC function. It mathematically verifies the hashed key against the private `license_secrets` table, checks if the license is active, and issues hardware-locked "Device Leases" to prevent piracy.
    *   Built the `/api/agent/activate` endpoint in `live.ts` using Web Crypto API to securely hash the raw key before it touches the database, protecting the Edge from timing attacks. Added CORS bypass so desktop apps can hit the endpoint.
*   **Part 2 (Secure Downloads):** Built the `/api/licenses/:id/download` endpoint in `live.ts`. It securely validates the logged-in user's license ownership against the database before initiating a download. Currently returns a 409 placeholder until the storage bucket is configured.
*   **Part 3 (Admin Controls):** Added the `reset_license_devices` RPC to the `003_agent_delivery.sql` migration, and built the `/api/admin/licenses/:id/device-reset` endpoint. This allows owners/admins to wipe a customer's hardware bindings so they can move their software to a new computer.

### Left Pending:
*   None. Phase 4 API logic is fully complete. Waiting on manual `.exe` uploads in future phases.

## Phase 5: Cloud Storage & Binaries
**Status:** Completed

### Completed:
*   **Part 1 (Storage & Security Policies):** Switched from Supabase Storage to **GitHub Private Releases** to securely host multi-gigabyte agent files for free. The architecture relies on a strict `GITHUB_PAT` (Personal Access Token) to keep the repository invisible to the public.
*   **Part 2 (The Signed URL Engine):** Rewrote the `/api/licenses/:id/download` endpoint in `live.ts`. It securely contacts the GitHub API, finds the latest release, uses fuzzy-matching to find the `.zip` or `.exe` asset containing the product slug (e.g., `voro_setup.exe`), intercepts the 302 redirect, and returns a direct, self-destructing Amazon S3 link to the customer's browser for instant downloading.

### Left Pending:
*   None. Phase 5 is fully complete in code. The founder just needs to upload the real `.zip` or `.exe` files to their GitHub releases before launch.

## Phase 6: Email Delivery & Staff Invitations
**Status:** Completed

### Completed:
*   **Part 1 (Email Outbox Engine):** Wrote `005_email_outbox.sql` to establish secure RPC functions (`claim_outbox_tasks`, `complete_outbox_task`) that use `for update skip locked` to prevent race conditions. Built the highly-scalable `/api/internal/process-outbox` endpoint in `live.ts` that safely loops over pending emails and sends them via Resend, authenticated via a strict `CRON_SECRET`.
*   **Part 2 (Staff Invitations):** Created `006_staff_invitations.sql` with a robust `staff_invitations` table. Engineered a secure Postgres Trigger to automatically grant staff access the exact second a team member registers via Auth. Built the `/api/admin/team`, `/api/admin/team/invite`, and `/api/admin/team/:id/suspend` endpoints in `live.ts` to power the live dashboard. When an invite is staged, it drops a job into the `private.outbox` queue perfectly.
*   **Part 3 (Transactional Templates):** Built `007_transactional_triggers.sql` to automatically queue `welcome_email` and `order_receipt` jobs into the Outbox upon user signup and order completion. Upgraded `/api/internal/process-outbox` with beautifully styled HTML templates for staff invitations, welcome emails, purchase receipts, and support replies.

### Left Pending:
*   None. Phase 6 is fully complete. The email engine is ready for production.

## Phase 7: Live Admin Dashboard Integration
**Status:** Completed

### Completed:
*   **Part 1 (The Storefront Manager):** Wired up the Products, Content, and Settings tabs in the Live Admin UI to Supabase. Created `008_live_admin_storefront.sql` to manage settings and product schema upgrades. Implemented `GET/POST` endpoints in `live.ts` and updated `Accounts.tsx` to mount the live editors.
*   **Part 2 (Business Operations):** Created `009_live_admin_business.sql` with highly secure functions to fetch aggregate overview stats, lists of orders, licenses, and the audit log. Built the revocation and key rotation endpoints in `live.ts`, and removed the placeholder notices in the `Accounts.tsx` UI to expose the live management features.

### Left Pending:
*   None. The entire admin dashboard is fully wired to the live Supabase database!
