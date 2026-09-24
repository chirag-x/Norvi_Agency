# Upgrade Two — Admin Panel, Team Access, and Product Management

Status: approved planning scope from the owner's request; implementation has not started. This extends the existing admin panel into an owner-and-team management system, rather than creating a duplicate competing panel.

## What you will manage without code changes

- Add a fourth, fifth, or later agent with a reusable product editor.
- Edit descriptions, features, screenshots, demos, requirements, FAQs, prices, and release files.
- Preview, publish, unpublish, or archive a product, and select featured agents.
- Edit supported homepage text, calls to action, help content, and business/contact settings.
- View all registered customer accounts, including people who have never purchased.
- Search purchases, licenses, devices, subscription status, and recent sign-in information.
- Revoke/restore licenses, rotate keys, reset devices, and handle billing through permitted workflows.
- Invite teammates, assign a role, remove access, and inspect who changed what.

Adding the listing is a panel operation. Building the actual new agent, integrating its activation protocol, adding a new website feature, or changing payment providers still requires development. The panel will expose structured, supported settings rather than execute arbitrary code or SQL.

## Dedicated login and secure accounts

Use a fixed route such as `/admin/login`, with the panel at `/admin`. This URL may be configured in the application; knowing it does not grant any privilege. Ordinary customer login remains at `/login`.

Each staff member has an individual email/password account managed by Supabase Auth, mandatory MFA, and a server-controlled staff membership. Passwords must not be hardcoded in source, shipped in frontend JavaScript, or shared among teammates. You choose your password securely during account setup; the provider handles password hashing and recovery. An admin page is a separate entry point to the same identity system, not a second custom password database.

Initial owner setup uses a one-time privileged provisioning step to assign the owner role to your verified account ID. Disable the bootstrap afterward. Public signup, an email domain, or a browser-supplied role never grants staff rights. No default owner password is included in the repository.

Owner invites a teammate by email and role. Invitations expire after a proposed 48 hours, are single-use and revocable, and require signing in with the matching verified email plus MFA enrollment. Invitation secrets are hashed at rest and redacted from logs. Only acceptance activates the membership. Existing customer accounts may accept an invitation without duplicating their identity.

Every admin API request checks active membership, role permission, and MFA. Role changes and suspension take effect on the next protected request, even if an old session token still exists. Sensitive mutations check authorization again inside the transaction. Team removal revokes admin access without deleting that person's separate customer purchases.

## Initial role matrix

These are fixed roles for the first version. Custom permission editing is deferred to keep the policy understandable.

| Ability | Owner | Administrator | Product manager | Support |
|---|---|---|---|---|
| View customer directory and account details | Yes | Yes | No | Yes, limited support fields |
| View orders, masked licenses, device status | Yes | Yes | No | Yes, for support |
| Reveal full customer activation keys | Yes, recent MFA + audit | No | No | No |
| Revoke/restore/rotate licenses | Yes | Yes, reason required | No | No |
| Reset customer devices | Yes | Yes | No | Yes, reason required |
| Refund payments or cancel billing | Yes | Yes, confirmation + audit | No | No |
| Create/edit/publish products and releases | Yes | Yes | Yes | No |
| Edit supported marketing/help content | Yes | Yes | Yes | No |
| Suspend customer access | Yes | Yes | No | No |
| Invite staff or change/remove roles | Yes | No | No | No |
| Edit license policy and business settings | Yes | No | No | No |
| View full audit and operational failures | Yes | Yes | Own publishing results | Own support actions |
| Bulk customer export | Yes, reauthentication + audit | No | No | No |
| Raw database console or infrastructure secrets | Owner via provider tools | No | No | No |

The customer's own key-reveal permission remains unchanged. Staff cannot promote themselves, change the owner, or reset the owner's security settings. Routine account suspension routes cannot target staff identities to bypass team-management controls. Prevent removal/demotion of the last owner in a locked transaction. Ownership transfer, if later added, requires a separate verified process.

## Customer directory, including non-buyers

Create the profile record during account creation, not during first purchase. A database trigger or idempotent server provisioning step handles email signup and any supported social login. A reconciliation process detects missing profiles without exposing Auth admin APIs to the browser.

Show customer ID, name, verified email, registration time, verification/onboarding state, last successful sign-in where available, account standing, purchase count, paid total, and license count/status. Do not show passwords, session tokens, payment credentials, or full license strings in list results. Missing sign-in timestamps display as unknown, not as evidence the person never signed in.

Filters: all customers; unverified; registered with no purchases; signed in with no purchases; active license; expired/revoked access; suspended. Use a customer-first query with left joins/aggregates so accounts with zero orders are not omitted. Staff appear in Team management and are excluded from marketing/customer counts unless they also act as customers.

Define paid purchase count using successfully captured/fulfilled orders; keep refunds visible separately. A registered customer with an abandoned or failed checkout remains a non-buyer. Anonymous visitors cannot be identified as registered customers merely because they viewed the site. Do not treat account registration as marketing consent.

## Adding a new agent from the panel

1. Choose **Products → Add agent**. The backend creates a draft and immutable product ID; it does not grant any customer licenses.
2. Enter name/slug, short and long descriptions, category, features, requirements, demo/media, FAQ, support details, and supported operating systems.
3. Select supported billing type, amount/currency, AI usage disclosure, and device policy. Create a new versioned price; changing a price does not rewrite old receipts or silently reprice existing subscriptions.
4. Upload release files to private quarantine storage through size-limited signed upload URLs. Validate file type/size, checksum, expected platform, and release metadata before publication. Scan where tooling is available; do not claim scanning guarantees a safe binary. Never execute uploaded files on the website server.
5. Integrate the assigned product ID and shared activation protocol into the actual agent, then test it with a test entitlement in the development environment.
6. Preview the draft behind authenticated authorization. Drafts and private assets must not leak through public APIs or static output.
7. Publish. A saved revision queues an authenticated build that reads approved product/content records and generates the catalog, product pages, checkout shells, pricing, navigation, and sitemap. No source edits or manual commits are needed.
8. Show **Draft → Publishing → Live**, or a clear build error with retry. Mark live only after deployment succeeds. Preserve the previous deployed revision on build failure.

Use optimistic version checks to prevent one editor overwriting another. Publish a consistent approved revision snapshot; draft edits made during a build must not sneak into that release. Build callbacks are authenticated and matched to their revision. New purchases require both an enabled current price and a deployed published product. Existing orders use their stored price snapshot.

Unpublishing disables new purchases immediately in the backend and schedules removal from public pages. Archiving a product preserves existing customer entitlements and downloads by default. Revoking existing access is a separate explicit action. Cached public text may lag until the build completes, but checkout always enforces current availability.

## Database additions and API responsibilities

Extend the previously planned `admin_roles` table as the staff membership table: user ID, fixed role, active/suspended state, inviter/grantor, timestamps, permission version. Add `staff_invitations` with email, role, hashed token, expiry, accepted/revoked timestamps, and inviter. Role changes write an audit record in the same transaction.

Add `site_content` for allowlisted text/media/settings, `product_revisions` and `content_revisions` for drafts/published snapshots, and `publication_jobs` for revision/build/deployment status. Extend products/releases with publish, archive, upload-validation, and revision fields. Extend profiles with registration and last-sign-in metadata; never log credentials to capture activity.

| API group | Access and behavior |
|---|---|
| `/api/admin/team` and `/invitations` | Owner-only membership/invitation operations; no arbitrary role from client |
| `/api/admin/invitations/accept` | Matching verified invitee, valid one-time token, MFA; only grants the stored invitation role |
| `/api/admin/customers` | Permission-filtered customer-first queries including zero-purchase accounts |
| `/api/admin/products` and `/:id/releases` | Catalog permissions; validated drafts, prices, and constrained uploads |
| `/api/admin/products/:id/publish` | Publish permission; enqueue revision, no direct customer-supplied deployment commands |
| `/api/admin/content` | Allowlisted editor fields; sanitize rich text and restrict media URLs |
| `/api/admin/publications` | Authorized build progress/retry; protect callback endpoint with service authentication |

Normal staff access is through these scoped APIs, not a general-purpose database editor. Team routes, content routes, and admin actions all need CSRF protection for cookie-authenticated mutations, pagination/rate limits, and redacted audit records.

## Additional acceptance criteria

- A newly registered account appears before buying; successful sign-in with zero purchases is filterable.
- An ordinary customer cannot enter admin APIs by changing a URL, role field, or token claim.
- Product managers cannot read customer lists, reveal keys, issue refunds, or invite staff, including by direct API calls.
- Invitation replay, expiry, wrong email, and missing MFA are rejected. Disabled members lose access on their next request.
- Concurrent owner/role edits cannot remove the last owner or apply a mutation after its required authority has been removed.
- An authorized editor publishes Agent 4 with no code edits; catalog, product route, checkout, sitemap, download, and product-specific activation all work.
- Unpublished drafts stay private; failed/stale builds do not mark a revision live; concurrent edits show a conflict instead of losing changes.
- Archiving stops new sales without deleting purchases; changing prices preserves existing order history and subscription agreements.
- Audit entries identify the actual teammate, target, action, reason, and time without storing full keys or credentials.

See [updated page inventory](./02-pages-and-sections.md) and [delivery/file plan](./06-files-and-delivery-plan.md). No new platform subscription is inherently required by this design, but additional users, emails, storage, and builds consume provider quotas.
