# NORVI - Future Phases: Enterprise Upgrades

This document outlines the visionary roadmap for NORVI after the initial public launch. These phases are designed to transition the platform from a Minimum Viable Product (MVP) to a world-class, enterprise-grade AI software business.

---

## Phase 8: Two-Step Account-Tied Licensing (Anti-Piracy)
**Goal:** Prevent piracy by tying software access to personal email credentials, which users will not share with strangers.
*   **Two-Step Desktop Login:** When a user opens the desktop agent, they must first log in using their NORVI Email and Password (Step 1). On the second screen, they must enter their specific Activation Key (Step 2).
*   **Strict Database Validation:** The backend API will strictly verify that the provided Activation Key actually belongs to the authenticated Email Address. If a pirate tries to use a leaked key with their own email account, the API will reject it.
*   **Session Limits:** Enforce a "1 Active Session" rule. If a user shares their email/password with a friend, the friend logging in will immediately kick the original owner out of the software.
*   **Bulletproof Revocation:** If abuse is detected, the admin can simply click "Rotate Key" in the dashboard. The desktop agent will instantly lock the user out until the new key is provided.

## Phase 9: Over-The-Air (OTA) Auto-Updates
**Goal:** Eliminate the friction of manual `.zip` file downloads for software updates.
*   **Updater API:** Create a new `/api/internal/check-updates` endpoint.
*   **Background Fetching:** When the desktop agent launches, it pings the server with its current version. If the server detects a newer version on GitHub Releases, it generates a signed download URL.
*   **Silent Install:** The desktop app downloads the patch in the background and gracefully restarts the agent, providing a seamless Google Chrome-style update experience.

## Phase 10: Credit-Based Billing & Recurring Revenue
**Goal:** Transition from one-time "Lifetime" purchases to a scalable recurring revenue model based on actual AI usage.
*   **Usage Tracking:** Track every AI inference/task executed by the agents in a new `usage_logs` table.
*   **Credit Wallets:** Assign a monthly credit balance to user accounts (e.g., 1,000 tasks/month).
*   **Top-Up Engine:** Integrate Razorpay one-click billing so users can buy "Refill Packs" directly from their dashboard when they run out of credits.
*   **Subscription Plans:** Introduce Basic, Pro, and Enterprise monthly subscriptions utilizing Razorpay Subscriptions.

## Phase 11: The Partner & Affiliate Engine
**Goal:** Create a viral, incentive-driven marketing loop using influencers and power users.
*   **Referral Generation:** Allow users to generate unique referral links (e.g., `norvi.ai/?ref=techbro`).
*   **Cookie Tracking:** Build middleware that tracks referral cookies for 30 days. If the user buys an agent, the sale is credited to the affiliate.
*   **Affiliate Portal:** Build a dedicated UI where partners can see their clicks, conversion rates, total earnings, and request commission payouts.

## Phase 12: Automated AI Support Agent (RAG)
**Goal:** Dramatically reduce support ticket volume and wait times.
*   **Knowledge Base:** Vectorize all product documentation, FAQs, and common troubleshooting steps into a Supabase pgvector database.
*   **Chat Widget:** Embed a custom AI chat interface in the bottom right of the website.
*   **Actionable AI:** The AI won't just talk; it can trigger backend functions (e.g., "The AI sees you are struggling to activate; it has just automatically reset your license key for you.").

## Phase 13: Admin Marketing & Broadcast Engine
**Goal:** Turn the Admin Dashboard into a powerful CRM for driving upsells and retention.
*   **Audience Filtering:** Query users based on behavior (e.g., "Users who bought Voro 3 months ago but never bought Omnix").
*   **Newsletter Editor:** Add a rich-text HTML email editor inside the Admin Panel.
*   **Mass Dispatch:** Connect directly to the Resend API to blast thousands of marketing emails instantly, completely bypassing the need for expensive third-party tools like Mailchimp.

## Phase 14: Workflow Template Marketplace
**Goal:** Foster a community ecosystem where users create content for the platform.
*   **Template Export:** Allow users to export their custom agent setups/prompts as shareable JSON files.
*   **Community Gallery:** Build a public marketplace on the website where users can browse top-rated workflows created by others.
*   **One-Click Import:** A "Copy to my Agent" button that instantly imports the complex workflow into the user's local desktop app.

## Phase 15: Real-Time Telemetry & Admin Analytics
**Goal:** Provide the founder with deep insights into how the software is actually used.
*   **Anonymous Telemetry:** The desktop agents stream lightweight usage events back to the Supabase database.
*   **Admin Charts:** Build a gorgeous analytics dashboard in the Admin Panel using a charting library (like Recharts) to display Monthly Recurring Revenue (MRR), active users right now, geographic heatmaps, and most-used features.

## Phase 16: Zapier & Developer Webhooks
**Goal:** Capture the B2B market by allowing Norvi to integrate into existing corporate tech stacks.
*   **Developer Portal:** A dashboard where users can generate their own API keys.
*   **Open API:** Documented REST endpoints allowing tools like Zapier, Make.com, or Slack to remotely trigger Norvi agents.
*   **Custom Webhooks:** Allow users to register URLs so that when their Norvi agent finishes a task, it automatically sends the results to their company's internal servers.

## Phase 17: Multi-Seat Team Workspaces (B2B Enterprise)
**Goal:** Sell large volume licenses to corporate managers and agencies.
*   **Organizational Hierarchy:** Upgrade the database to support "Organizations" that own licenses, rather than just individual users.
*   **Seat Management:** A manager can purchase a 50-seat license. They get a dashboard to invite employees via email.
*   **Centralized Billing:** The system automatically issues sub-licenses to employees and bills the manager's corporate card, with centralized invoice generation.

## Phase 18: Dynamic Careers & Hiring Portal
**Goal:** Build a fully customizable, in-house job board to scale the company's team.
*   **Admin Job Manager:** Add a new "Careers" tab to the Admin Dashboard (accessible only to `owner` and specific team members like HR/Managers) where you can draft, publish, edit, and close job postings.
*   **Public Careers Page:** Build a beautiful `/careers` page on the frontend that automatically fetches and displays active job postings from the Supabase database.
*   **Application Pipeline:** Allow candidates to submit their resume and cover letter directly through the website.
*   **Database Schema:** Create `job_postings` and `job_applications` tables with strict Row Level Security (RLS) so only authorized staff can view applicant data.