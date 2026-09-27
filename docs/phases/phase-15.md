# Phase 15 - Admin Marketing & Broadcast Engine

**Status:** Completed

## Implementation Summary:
We built a robust, segmented marketing engine that allows admins to send rich-text HTML email blasts to targeted audiences using the Resend API, without the need for external marketing platforms like Mailchimp.

### 1. The Audience Filter & Database
- Created a `broadcasts` table in PostgreSQL with Row Level Security to securely log all historical marketing emails and metrics.
- Built advanced SQL Remote Procedure Calls (RPCs) to dynamically filter and segment audiences in real-time based on purchase behavior:
  - **All Users:** Full registered userbase.
  - **Paying Customers:** Users with at least one `paid` order.
  - **Warm Leads:** Users who created an account but have zero purchases.
  - **Active Affiliates:** Users enrolled in the partner program.

### 2. The Broadcast UI (Frontend)
- Injected the `<MarketingManager />` dashboard into `Workspace.tsx`.
- The dashboard fetches live audience statistics so admins can instantly see exactly how many people belong to each segment before sending.
- Features a Compose tab with a full HTML editor for the email body, and a History tab to track previously dispatched broadcasts.

### 3. The Dispatch Engine (Backend)
- Implemented `POST /api/admin/marketing/send` in `live.ts`.
- Uses the **Resend Batch API** to securely dispatch emails. 
- Because serverless functions can timeout on massive arrays, we implemented an asynchronous queue that slices the target audience into chunks of 100 (Resend's batch limit) and executes the network requests safely in the background.
