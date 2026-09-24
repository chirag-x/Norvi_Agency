# Pages, Navigation, and Sections

## Launch scope and counting

Plan **35 page templates**: 11 public, 5 customer authentication/onboarding, 8 customer/checkout, and 11 admin (including admin login). Three products each instantiate both the product-detail and checkout templates, so the baseline is **39 page instances**, before customer-specific order/detail URLs. This also corrects the earlier count, which omitted the extra checkout instances. API endpoints, redirects, error screens, modal dialogs, and dynamic record instances are not counted as extra templates.

The tables below specify **148 content sections** across those 35 templates. Headers, footers, sidebar navigation, and repeated section instances are excluded. This is a planning inventory, not a requirement to make every section a large visual block.

## Public website: 11 templates, 58 sections

| # | Page / route | Named sections |
|---|---|---|
| 1 | Home `/` | Hero and value proposition; Problems solved; Featured-agent showcase; How it works; Demo; Benefits; Pricing preview; Trust and security; FAQ; Final call to action (10) |
| 2 | Agent catalog `/agents` | Introduction; Published product cards; Comparison; Selection guidance (4) |
| 3 | Agent detail `/agents/[slug]` | Product introduction; Intended users; Features; Workflow demo; Integrations; System requirements; Pricing and included usage; Activation instructions; Product FAQ; Purchase call to action (10) |
| 4 | Pricing `/pricing` | Plan cards; Feature comparison; AI usage costs; Billing and refund summary; Payment methods; Pricing FAQ (6) |
| 5 | About `/about` | Mission; Company story; Operating principles; Contact invitation (4) |
| 6 | Contact `/contact` | Contact form; Support channels; Business details (3) |
| 7 | Help `/help` | Getting started; Installation and activation; Billing help; Troubleshooting; Contact support (5) |
| 8 | Privacy `/privacy` | Data collected; Purpose and sharing; Retention and deletion; Contact and requests (4) |
| 9 | Terms `/terms` | Service scope; Acceptable use; Account and license conditions; Suspension and termination (4) |
| 10 | Refunds `/refunds` | Eligibility; Request process; Processing expectations (3) |
| 11 | License agreement `/license` | Allowed use; Devices and sharing; Updates and service dependency; Expiry and revocation; Restrictions and support (5) |

Use truthful demos and evidence. Do not invent testimonials, customer logos, usage counts, certifications, or guaranteed earnings. Public pricing must disclose recurring charges, usage caps, and whether customers supply their own AI-provider account.

## Authentication and onboarding: 5 templates, 15 sections

| # | Page / route | Named sections |
|---|---|---|
| 12 | Register `/register` | Account form; Terms/privacy acknowledgment; Sign-in link (3) |
| 13 | Login `/login` | Sign-in form; Recovery link; MFA challenge state (3) |
| 14 | Verify email `/verify-email` | Verification status; Resend action; Change-email/help guidance (3) |
| 15 | Password recovery `/reset-password` | Request reset; Set new password after verification; Completion state (3) |
| 16 | Complete profile `/onboarding` | Name and optional business; Country/billing needs; Completion summary (3) |

Request only necessary personal details. Do not block login recovery behind profile completion. Email confirmation and password-reset callbacks are technical routes, not additional designed pages.

## Customer area and checkout: 8 templates, 32 sections

| # | Page / route | Named sections |
|---|---|---|
| 17 | Dashboard `/account` | Welcome; Owned agents; Recent orders; Notices (4) |
| 18 | My agents `/account/agents` | Owned products; Access status; Download actions; Setup guides (4) |
| 19 | Keys and devices `/account/licenses` | Masked keys and reveal; Product/status/expiry; Active devices; Deactivate or request rotation (4) |
| 20 | Billing `/account/billing` | Subscription status; Renewal/cancellation controls; Purchase history; Receipts/refund status (4) |
| 21 | Profile and security `/account/settings` | Profile; Email/password change; MFA and sessions; Account data/deletion request (4) |
| 22 | Support `/account/support` | New request; Request history; Troubleshooting links (3) |
| 23 | Checkout `/checkout/[product]` | Order summary; Billing details; Terms acceptance; Hosted payment action; Pending/error state (5) |
| 24 | Order status `/orders/[id]` | Confirmed/pending/failed status; Receipt summary; Key/download when fulfilled; Next steps (4) |

The order-status page must wait for server-confirmed payment and fulfillment. It never exposes another customer's order. Keys are masked by default and remain listed when expired or revoked, with clear status. For a rotated key, show the current key and mark the old record as replaced.

## Owner and team administration: 11 templates, 43 sections

| # | Page / route | Named sections |
|---|---|---|
| 25 | Overview `/admin` | Revenue summary; Customer/license summary; Payment/email failures; Recent activity (4) |
| 26 | Customers `/admin/customers` | Search/filter including non-buyers; Customer profile and sign-in panel; Purchases/licenses; Permitted access/account actions (4) |
| 27 | Licenses `/admin/licenses` | Search by customer/product/key ID; Status/details; Revoke/restore/rotate; Device controls; Action history (5) |
| 28 | Orders `/admin/orders` | Payment search; Order/payment details; Refund/dispute actions; Reconciliation failures (4) |
| 29 | Subscriptions `/admin/subscriptions` | Recurring agreements; Renewal/payment state; Cancel timing; Provider reconciliation status (4) |
| 30 | Products and releases `/admin/products` | Catalog; Prices/plans; Release upload/metadata; Publish/archive controls (4) |
| 31 | Audit and delivery `/admin/activity` | Admin audit; Activation anomalies; Webhook/job failures; Email status/retry (4) |
| 32 | Settings `/admin/settings` | Business/support details; License policy; Integration health (3) |
| 33 | Admin login `/admin/login` | Staff sign-in; MFA enrollment/challenge; Recovery and invitation acceptance state (3) |
| 34 | Team `/admin/team` | Members and roles; Invitations; Suspend/remove access; Role-change history (4) |
| 35 | Content `/admin/content` | Homepage and help fields; Media; Draft preview/revisions; Publication status (4) |

No raw payment, database, encryption, or email secrets appear in settings. Integration health shows configured/missing status. Admin panels support inline detail views rather than creating additional templates.

## Shared layout and states

- Public header: logo, Agents, Pricing, About, Help, Login, primary purchase/browse button.
- Public footer: contact/business information and legal links.
- Customer sidebar: Dashboard, My Agents, Keys & Devices, Billing, Support, Settings.
- Admin sidebar: Overview, Customers, Licenses, Orders, Subscriptions, Products, Activity, Settings, Team (owner only), Content (per role).
- Shared states: loading, empty, validation error, payment pending, access expired, revoked, forbidden, not found, maintenance, and offline.
- Mobile navigation, visible keyboard focus, screen-reader labels, sufficient contrast, reduced-motion support, and meaningful form errors are required throughout.

## Scope deliberately deferred

A full blog/arbitrary-layout CMS, affiliate program, marketplace for other sellers, customer organization seats, coupons, shopping cart, live chat, and elaborate analytics are later additions. The initial catalog starts with three products and can grow through the panel. Staff team access and structured content editing are included in Upgrade Two; customer organization seats are a separate future feature.

See [Upgrade Two](./07-upgrade-two-admin-and-team.md) for permissions, customer filters, and publishing behavior.
