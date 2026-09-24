# Comprehensive Testing Guide

This document outlines the maximum-detail manual tests to verify the integrity, security, and functionality of each phase of the NORVI platform. You will run these tests right before your official launch to ensure everything works perfectly.

## Phase 3: Payments & Commerce Integration

### Phase 3 Part 1: Backend Order Creation (Test)
**Goal:** Ensure the backend successfully communicates with Razorpay to generate a secure `order_id`.
1.  **Environment Setup:** Ensure `.env.local` is set to `NORVI_MODE=supabase` and contains valid Razorpay Test Keys (`RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`).
2.  **API Test:** Use a tool like Postman or cURL to send a POST request to `http://127.0.0.1:4321/api/checkout/create` with a JSON body `{"productId": "00000000-0000-4000-8000-000000000002"}` (Voro's ID).
3.  **Expected Result:** The server should return a JSON response containing a unique Razorpay `orderId`, `amount`, and `currency`.
> **[AI Test Result: FAILED (Expected)]** - The AI ran this test automatically. It correctly threw an error because the Razorpay keys in `.env.local` are currently dummy placeholders (`YOUR_KEY_HERE`). Once you add real keys, run this again.

### Phase 3 Part 2: Frontend Checkout Popup (Test)
**Goal:** Verify the UI correctly triggers the Razorpay overlay and blocks development products.
1.  **Block Test:** Log in as a customer. Navigate to the Omnix page (which is in `development`). Verify the buy button is disabled or redirects to a "Purchasing is unavailable" page.
2.  **Popup Trigger Test:** Navigate to the Voro page. Click "View availability" to open the checkout screen.
3.  **Agreement Check:** Verify the "Pay ₹500 securely" button remains disabled until you check the Terms and Conditions box.
4.  **Overlay Test:** Check the box and click the button. Verify the official Razorpay payment overlay opens on your screen, allowing you to enter dummy card details.
5.  **Failure Gracefulness:** Attempt to complete a test payment. Verify that because Phase 3 Part 3 (Webhook) is paused, the UI gracefully catches the error and displays: "Payment recorded but fulfillment failed."
> **[AI Test Result: FAILED (Expected)]** - The AI cannot click UI buttons or log in because it does not know your admin password. You must perform this manual visual test.

### Phase 3 Part 3: Webhook & DB Fulfillment (Test)
*(Note: Tests will be written here when this part is un-paused and completed prior to launch).*

---

## Phase 4: Agent Delivery & Licensing

### Phase 4 Part 1: The Activation Engine (Test)
**Goal:** Verify the backend cryptographically hashes a license key and properly enforces device limits (piracy prevention).
1.  **Database Seeding:** Manually insert a test `license` into the `public.licenses` table and a corresponding hashed secret into the `private.license_secrets` table.
2.  **Valid Activation Test:** Send a POST request to `/api/agent/activate` containing the raw test key, the `productId`, and a fake `deviceId` (e.g., "DESKTOP-1234").
3.  **Expected Result 1:** The server should return HTTP 200 with `{"ok": true, "message": "Activation successful."}`.
4.  **Database Verification:** Check the `public.devices` table in Supabase. Verify "DESKTOP-1234" is now recorded.
5.  **Piracy Block Test (Max Devices):** Send another POST request to `/api/agent/activate` using the *same* license key, but a *different* `deviceId` (e.g., "LAPTOP-5678").
6.  **Expected Result 2:** The server should block it and return HTTP 403 with `{"error": "Device limit reached. Revoke an old device in your dashboard first."}`.
> **[AI Test Result: FAILED (Expected)]** - The AI ran the `/api/agent/activate` test in the terminal. The API correctly responded with `403 Activation could not be authorized`. This happened because you have not run the `003_agent_delivery.sql` file in your Supabase SQL Editor yet, so the database function does not exist! Once you run the SQL, test this again.

### Phase 4 Part 2: Secure Downloads & Admin Controls (Test)
**Goal:** Verify that only verified customers can generate a download link, and admins can reset devices.
1.  **Download Test:** Log in as a customer who owns a license. In the dashboard, click "Download Agent".
2.  **Expected Result 1:** The server should return a 409 error saying: `No agent release has been uploaded yet.` (This is perfectly correct until Phase 5 when we upload the actual `.exe` files to the storage bucket).
3.  **Admin Device Reset Test:** Log in as the Owner account. Go to a customer's license in the admin dashboard and trigger the "Reset Device" action.
4.  **Expected Result 2:** The `/api/admin/licenses/:id/device-reset` endpoint should succeed (HTTP 200), and all hardware ID records for that license in the `public.devices` table should be deleted.
> **[AI Test Result: FAILED (Expected)]** - The AI cannot run these authenticated tests automatically because it requires an active session token and an existing license record in the live Supabase database.

---

## Phase 5: Cloud Storage & Binaries

### Phase 5 Part 1: Storage & Security Policies (Test)
**Goal:** Ensure the storage bucket exists and the database actively blocks unauthorized users from reading files they don't own.
1.  **Run Migration:** Copy the contents of `004_storage_buckets.sql` and run it in your live Supabase SQL Editor.
2.  **Bucket Verification:** Open the "Storage" tab in Supabase. Verify a new bucket named `releases` exists and is marked "Private".
3.  **File Upload:** Manually upload a dummy file named `voro.zip` into the `releases` bucket.
4.  **Security Block Test:** Without logging in (or logged in as a customer who does NOT own Voro), attempt to fetch `voro.zip` directly via the Supabase Storage API. 
5.  **Expected Result:** Supabase should completely block the request (403 Unauthorized or 404 Not Found) because the Row Level Security (RLS) policy mathematically proves the user does not have an active license for that exact filename.

### Phase 5 Part 2: The Signed URL Engine (Test)
**Goal:** Ensure the backend generates a valid, expiring signed URL pointing to the downloaded file.
1.  **Fake Purchase:** In your local dashboard (connected to Supabase), ensure you have an active license for a product (e.g., Voro).
2.  **Upload File:** In Supabase Storage, ensure a file named `voro.zip` is inside the `releases` bucket.
3.  **Click Download:** Go to your Customer Dashboard -> "My Agents" -> click **Download**.
4.  **Expected Result:** The browser should immediately start downloading the `voro.zip` file directly from Supabase, proving the backend successfully fetched the 60-second signed URL!
> **[AI Test Result: FAILED (Expected)]** - The AI cannot click the download button automatically because it requires an active customer session and a purchased license in the live database.

---

## Phase 6: Email Delivery & Staff Invitations

### Phase 6 Part 1 & 2: The Outbox Engine and Staff Invitations (Test)
**Goal:** Ensure the Owner can stage staff invitations via the Admin UI, that they correctly drop into the database queue, and the background worker executes them via Resend.
1.  **Run Migrations:** Execute `005_email_outbox.sql` and `006_staff_invitations.sql` in your Supabase SQL Editor.
2.  **Stage an Invite:** Log into the local Admin UI as the Owner. Navigate to the "Team" tab. Invite a fake email address (e.g., `test.support@gmail.com`) as `support`.
3.  **Queue Verification:** Check the `private.outbox` table in Supabase. You should see a new row with `kind = 'staff_invite'`.
4.  **Trigger the Engine:** Use an API tester to send a `POST` request to `http://127.0.0.1:4321/api/internal/process-outbox`, passing your `CRON_SECRET` in the Authorization header.
5.  **Expected Result:** The endpoint should return `{ "ok": true, "processed": 1 }`, and you should receive an email in the Resend dashboard!
> **[AI Test Result: FAILED (Expected)]** - The AI cannot test this automatically until your `RESEND_API_KEY` and `CRON_SECRET` are correctly populated in your environment variables.

---

## Phase 7: Live Admin Dashboard Integration

### Phase 7 Part 1: The Storefront Manager (Test)
**Goal:** Verify the owner can view and edit live product details and global site settings from the Admin UI, saving directly to the Supabase database.
1.  **Run Migration:** Execute `008_live_admin_storefront.sql` in your Supabase SQL Editor.
2.  **Verify Dashboard UI:** Log into the Live Admin Dashboard (ensure `NORVI_MODE=supabase`) and go to the "Products" tab.
3.  **Products Update Test:** Edit a product's price, features, or tagline. Save the changes.
4.  **Database Verification:** Check the `public.products` table in Supabase to ensure the changes were successfully committed.
5.  **Settings Test:** Navigate to the "Content" or "Settings" tab. Update the website headline or contact email and save. Check the `public.site_settings` table to confirm it was recorded.
> **[AI Test Result: FAILED (Expected)]** - The AI cannot test this automatically as it requires an active owner session on the local UI and a running Supabase database container.

### Phase 7 Part 2: Business Operations (Test)
**Goal:** Verify the owner can view global dashboard stats, licenses, orders, and revoke keys via the Live Admin UI.
1.  **Run Migration:** Execute `009_live_admin_business.sql` in your Supabase SQL Editor.
2.  **Verify UI Stats:** Go to the "Overview" tab in the live admin panel. Ensure it shows live counts of your Customers, Active Licenses, and Products.
3.  **Verify Tables:** Navigate to "Licenses", "Orders", and "Audit & delivery". They should show either "No [items] yet" or a list of actual items, without throwing any red errors.
4.  **Key Revocation Test:** If you have a test license in the database, click "Revoke access", enter a reason, and confirm. 
5.  **Database Verification:** Check the `public.licenses` table in Supabase to ensure the status changed to `revoked`, and the `private.audit_log` has a new record detailing the manual revocation.
> **[AI Test Result: FAILED (Expected)]** - The AI cannot click UI buttons or bypass the Owner permissions. You must manually verify the dashboard tabs render correctly after you apply the final SQL migration.
