# NORVI — First Implementation Status

> Historical baseline from September 22, 2026. Account and catalog progress is now tracked in [Phase 1 and 2 status](./10-phase-1-and-2-status.md); follow [Supabase setup](../SUPABASE-SETUP.md) for the new integration.

The founder selected **NORVI** after the original planning documents were written. The implementation now uses NORVI; product names, prices, capabilities, requirements, business identity, domain, and support details remain placeholders.

## Delivered locally

- Responsive storefront with homepage, searchable product collection, product details, pricing, about, help, contact, and clearly marked draft policy pages.
- Separate customer and admin login interfaces with explicit synthetic preview entry points.
- Customer dashboard, owned products, recoverable sample keys, devices, sample orders, profile editing, and locally saved support requests.
- Admin overview, product editor, customer directory including non-buyers, license revocation/restoration/rotation, role-filtered screens, staged invitations, content/settings editors, audit history, and sample email-job visibility.
- Server-side Hono preview API, scoped session authorization, role checks, input validation, same-origin mutation checks, serialized local persistence, randomized hashed/encrypted sample keys, and product/device binding.
- Public catalog snapshot updates and static route generation when products are published locally.
- A separate production-safe Worker boundary that cannot start preview sessions or simulate purchases.
- An initial PostgreSQL/Supabase migration with ownership constraints and restricted read policies. It is not applied to a database.

## Honest implementation boundaries

| Feature | Current state |
|---|---|
| Site design and navigation | Implemented with placeholders |
| Real accounts, email verification, recovery, MFA | UI only; live provider and server integration pending |
| Local roles and access checks | Implemented for synthetic sessions; not a replacement for production authentication |
| Customer and product persistence | Local preview JSON only; production PostgreSQL integration pending |
| Product creation/edit/publish | Working locally; updates public snapshot and routes; remote deployment orchestration pending |
| Keys | Synthetic random keys, hash lookup, encrypted recovery, revocation, rotation, device binding implemented locally |
| Agent runtime | No actual agents supplied; production signed leases, refresh, offline-expiry enforcement, and integration tests pending |
| Payments | Explicit simulation only; real payment collection, verification, reconciliation, refunds and recurring billing pending |
| Purchase emails | Preview job records only; no external email sent, full email rendering/delivery pending |
| Team invitations | Staged records only; delivery, acceptance, expiry, and secure owner provisioning pending |
| Uploads/downloads | Actual release assets unavailable; downloads return a clear unavailable message |
| Contact form | Validation preview only; does not send or persist a message |
| Account support | Requests persisted in local preview; no email notifications or staff reply workflow yet |
| Subscription screens | Honest empty state; no subscription or cancellation capability yet |
| Privacy/terms/refunds/license pages | Clearly labeled drafts requiring business details and review |
| Hosting | Deployed to Netlify (norvi-agency.netlify.app) as a live public preview |

## Implementation choices versus the original blueprint

The first slice uses one root package and shared React screens within Astro rather than separate package workspaces. It uses custom CSS tokens and native accessible HTML controls rather than Tailwind. The backend remains Hono/TypeScript as proposed. This keeps the initial reviewable site compact; the larger schema and service decomposition remain a roadmap.

All public pages are generated with Astro; interactive views hydrate with React. They currently share a client bundle. Splitting account/admin code and reducing homepage hydration are subsequent performance work, so the original performance targets are not claimed achieved.

Local publishing directly refreshes a public JSON snapshot. The production pipeline for approval snapshots, builds, deployment callbacks, private release uploads, and rollback remains to be implemented. New public product routes are generated from the snapshot rather than a fixed list of three agents.

The preview key reveal does not simulate password reauthentication or MFA. Production must implement those controls before enabling secret recovery. No sample security behavior is presented as production readiness.

## Validation

TypeScript checking, static build, API tests, dependency audit, and browser flow/responsive checks are used for this slice. The API tests exercise unauthorized access, role restrictions, non-buyer visibility, concurrent duplicate purchases, distinct product keys, device limits, key isolation, revocation/rotation, staff suspension, and draft privacy.

These checks do not validate a payment provider, actual email delivery, PostgreSQL RLS execution, a real agent binary, or production hosting. Those require integration work and their own acceptance tests.

### Verified on September 22, 2026

- TypeScript check passed; all 10 API tests passed.
- Static build generated 40 pages, including the 404 page.
- npm dependency audit reported zero vulnerabilities at the time of verification.
- Browser checks passed for owner preview entry, product creation/publication, a newly generated product page, archival, customer preview entry, sample checkout fulfillment, and key recovery.
- Mobile storefront and customer license views fit a 390px viewport without page-level horizontal overflow; mobile navigation opened successfully.
- The temporary verification product was archived. A synthetic customer order remains so the owner can explore the license-management screens.
- Local startup now keeps Astro and the API running together. The installed React integration emits Vite deprecation warnings during builds; the build completes successfully.

## Next integration milestones

1. Connect an isolated Supabase project; complete the schema, verified session cookies, customer provisioning, staff membership, MFA, and audited mutations.
2. Replace the preview repository with transactional PostgreSQL operations and apply/test RLS using two real test identities.
3. Complete payment order creation, raw-body signature verification, idempotent fulfillment, reconciliation, and refund/subscription operations against provider test mode.
4. Add encrypted key recovery with recent authentication, signed agent leases, refresh revocation, and the first actual agent's activation integration.
5. Complete email templates/outbox delivery, staff invitations, private release storage, and production publication builds.
6. Fill business/product placeholders, review policies, test backups/recovery and abuse controls, then perform a controlled deployment.

The full business/architecture plans remain the target scope. This file and `START-NORVI.md` describe what exists now.
