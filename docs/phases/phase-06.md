# Phase 6 - Admin Operations

**Status:** Completed

## Plan:

**1. Customer & Access Management** (Completed)
- [x] Complete customer suspension/restoration from UI.
- [x] Searchable orders, licenses, payments, and support tickets.
- [x] **Gift Licenses (New):** UI in the Licenses tab to manually generate and gift a license to an email address without requiring SQL.

**2. Staff & Team Management** (Completed)
- [x] Add staff role editing (change a user's role).
- [x] Add invitation cancellation and resend.

**3. Product & Commerce Control** (Completed)
- [x] Add product version/release management.
- [x] Add price and subscription-plan management.

**4. Owner-Exclusive Powers (New)** (Completed)
- [x] **Dynamic Role Permissions:** A dedicated Owner tab to customize which admin pages/tabs each role (Support, Admin, Product Manager) is allowed to see and interact with.
- [x] **Role Impersonation:** "View As" links for the Owner to instantly see the dashboard exactly as a Support member, Administrator, or Customer sees it, without needing to log out or create dummy accounts.
- [x] **Login as Specific Customer:** Ability to click "Login as this user" on a customer's profile to troubleshoot their exact account view.

**5. Announcement System (New)** (Completed)
- [x] **Customer Announcements:** Owner can broadcast an announcement that appears as a beautiful UI pop-up/modal the next time a customer logs in or refreshes.
- [x] **Team Announcements:** A dedicated "Announcements" tab in the Admin panel where team members can read a historical feed of internal owner announcements (no pop-ups for staff).

**6. Analytics & System Tools (New)** (Completed)
- [x] **Analytics Dashboard:** Visual breakdown of Total Revenue (last 30 days), Active Licenses, and Recent Sales on the main overview page.
- [x] **Audit Logs UI:** A tab in the Admin panel to read and search the entire Supabase log history directly inside the UI.
- [x] **Maintenance Mode:** A simple On/Off toggle to temporarily prevent checkouts and downloads while you are updating agents.

**7. Premium Enterprise Features (New)** (Completed)
- [x] **Command Palette (Cmd+K):** A sleek, global search overlay to instantly jump to specific customers, orders, or admin actions from anywhere in the dashboard.
- [x] **Data Export (CSV):** Export buttons on Customers and Orders tabs to download data for marketing (Mailchimp) or accounting (QuickBooks).
- [x] **Live Activity Timeline:** A scrolling, real-time feed on the main dashboard showing the latest actions across the platform, making the business feel "alive."
