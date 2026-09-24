# NORVI - Comprehensive Repair & Upgrade Plan

This document outlines the recommended upgrade phases to fix, secure, and complete the current website architecture.

## Phase 0 — Emergency security repair
*Do this first.*
- Revoke public and anonymous execution from privileged RPC functions.
- Rewrite every role check so missing identities are rejected explicitly.
- Require authenticated identity, active membership, correct role, and AAL2 inside every privileged database function.
- Add a global default privilege policy for future functions.
- Add role-matrix tests for migrations 003–009.
- Repair the broken activity/outbox schema references.
- Review the live Supabase function permissions if these migrations were already applied.

## Phase 1 — Make the current foundation coherent
- Pass all required server variables through Netlify.
- Separate development, staging, and production environments.
- Move public catalog reads to Supabase or create a dependable publish/build process.
- Use database UUIDs consistently across website, orders, licenses, and agents.
- Add dynamic routing for products created in the admin panel.
- Remove stale preview wording from real accounts.
- Make the admin integration status come from real configuration checks.

## Phase 2 — Complete authentication and account management
- Finish custom-domain email delivery.
- Add email-change verification.
- Add customer account deletion and data export.
- Add session/device management.
- Create an MFA recovery procedure.
- Add staff invitation tokens, expiry, revocation, and acceptance confirmation.
- Add staff removal and role changes with owner reauthentication.
- Test registration, recovery, MFA, suspension, and staff access end to end.

## Phase 3 — Complete commerce
- Create real price records in the database.
- Load the amount and currency server-side.
- Create a pending database order before calling Razorpay.
- Verify checkout signatures server-side.
- Implement signed Razorpay webhooks.
- Store and deduplicate webhook events.
- Fulfill licenses only after a verified paid event.
- Handle failed, pending, refunded, and disputed payments.
- Add receipts, invoices, taxes, refund workflows, and reconciliation.
- Test in Razorpay test mode before requesting live activation.
- Define whether products are one-time purchases, subscriptions, or both.
- Add international currency and card policies after provider approval.

## Phase 4 — Complete license and agent security
- Design one consistent license-key format.
- Hash keys consistently.
- Encrypt recoverable keys with a dedicated server encryption key.
- Make issue, rotate, revoke, and restore operations transactional.
- Build owner and customer key-reveal endpoints with auditing and reauthentication.
- Return short-lived signed activation leases to agents.
- Include product, license, device, version, and expiry claims in the lease.
- Define offline behavior and grace periods.
- Rate-limit activation attempts separately.
- Add device naming and customer-managed release.
- Add agent update checking and minimum supported versions.
- Add binary checksums and code signing.

## Phase 5 — Product delivery and email automation
- Choose one release store: Supabase Storage or GitHub Releases.
- Map each product/version/platform to an exact release asset.
- Generate short-lived authorized download URLs.
- Validate license ownership for every download.
- Record download audit events.
- Create a real scheduled outbox processor.
- Add retry limits and a dead-letter state.
- Use APP_ORIGIN in email links instead of hardcoded domains.
- Add welcome, receipt, license, renewal, payment failure, refund, invitation, and support emails.
- Display delivery status accurately in the admin panel.

## Phase 6 — Admin operations
- Complete customer suspension/restoration.
- Add searchable orders, licenses, payments, and support tickets.
- Add staff role editing.
- Add invitation cancellation and resend.
- Add product version/release management.
- Add price and subscription-plan management.
- Add refund operations.
- Add support responses and email notifications.
- Add customer notes with audit history.
- Add CSV exports with permission controls.
- Add business dashboards for revenue, failed payments, active users, and activation failures.

## Phase 7 — Public launch content
- Finalize pricing.
- Finalize terms, privacy, refund, and license documents.
- Add business name, address, support email, response times, and jurisdiction.
- Replace every placeholder.
- Add product demos and screenshots.
- Add security/privacy explanations for desktop automation.
- Add FAQs for AI costs and supported platforms.
- Add a real domain and branded email.
- Remove the preview banner when sales are truly ready.

## Phase 8 — SEO, performance, and accessibility
- Enable indexing only after legal and product pages are final.
- Add unique titles and descriptions.
- Add sitemap and robots files.
- Add canonical URLs and social cards.
- Add organization, product, and FAQ structured data.
- Self-host/subset fonts where practical.
- Reduce the initial JavaScript bundle.
- Add image optimization.
- Run Lighthouse and accessibility audits.
- Test keyboard, screen reader, reduced motion, zoom, and color contrast.
- Add useful server-rendered page content for search engines.

## Phase 9 — Operations and growth
- Add CI for checks, tests, migrations, and builds.
- Add database migration tracking.
- Add staging deployments.
- Add error and uptime monitoring.
- Add security-event alerts.
- Test database backup restoration.
- Document incident response and key rotation.
- Add privacy-aware analytics.
- Track registration, verification, checkout, purchase, download, and activation funnels.
- Add waitlists for unreleased agents.
- Add onboarding tours, product documentation, changelogs, and feedback collection.
- Later, add case studies, testimonials, referral programs, and business/team licensing.
