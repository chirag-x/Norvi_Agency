# Future Files, Delivery Phases, and Decisions

## Proposed repository structure

This tree is a blueprint. No application files listed below have been created in this planning task.

```text
E:/Agency/
  README.md                         Planning entry point now; setup guide later
  docs/                             Current architecture/planning documents
  apps/
    web/
      package.json
      astro.config.mjs
      src/
        pages/
          index.astro
          agents/index.astro
          agents/[slug].astro
          pricing.astro
          about.astro
          contact.astro
          help.astro
          privacy.astro
          terms.astro
          refunds.astro
          license.astro
          register.astro
          login.astro
          verify-email.astro
          reset-password.astro
          onboarding.astro
          account/index.astro
          account/agents.astro
          account/licenses.astro
          account/billing.astro
          account/settings.astro
          account/support.astro
          checkout/[product].astro
          orders/index.astro        Authenticated shell mapped to /orders/*
          admin/login.astro
          admin/team.astro
          admin/content.astro
          admin/index.astro
          admin/customers.astro
          admin/licenses.astro
          admin/orders.astro
          admin/subscriptions.astro
          admin/products.astro
          admin/activity.astro
          admin/settings.astro
          404.astro
        layouts/                    Marketing, account, admin shells
        components/
          marketing/                Hero, product cards, demo, FAQ
          account/                  Licenses, devices, billing, profile
          admin/                    Customer table, license actions, audit
          ui/                       Accessible buttons, forms, dialogs
        styles/global.css
        lib/api-client.ts           Same-origin requests; no secrets
        content/                    Help and approved marketing copy
      public/                       Logos, optimized images, public assets
    api/
      package.json
      wrangler.jsonc                API routes + web static asset binding
      src/
        index.ts                    Hono application and static routing
        routes/
          auth.ts
          products.ts
          profile.ts
          orders.ts
          webhooks.ts
          licenses.ts
          downloads.ts
          subscriptions.ts
          agent.ts
          admin.ts
          team.ts                   Owner-managed staff invitations and roles
          content.ts                Validated marketing/help editing
          publishing.ts             Authorized revision publication and status
          support.ts
        middleware/                 Auth, MFA, CSRF, rate limits, errors
        services/
          fulfillment.ts            Atomic paid-order entitlement creation
          licensing.ts              Status, activation, devices, leases
          payments.ts               Provider API and reconciliation
          key-vault.ts              Hashing, encryption, rotation
          mail.ts                   Rendering and delivery adapter
          audit.ts                  Redacted security event recording
          permissions.ts            Fixed roles and current membership checks
          invitations.ts            Verified single-use staff onboarding
          publishing.ts             Revision snapshots and build orchestration
        repositories/               Database access and scoped RPC calls
    jobs/
      package.json
      wrangler.jsonc                Scheduled worker; bounded batches
      src/index.ts                  Outbox processing and reconciliation
  packages/
    contracts/                      Shared Zod schemas/types/error codes
    email-templates/                Purchase, renewal, recovery notices
    agent-protocol/README.md         Language-independent activation contract
  supabase/
    config.toml
    migrations/
      001_profiles_roles.sql
      002_catalog_orders_payments.sql
      003_licenses_devices_secrets.sql
      004_events_outbox_audit.sql
      005_rls_storage_policies.sql
      006_transactional_functions.sql
      007_staff_memberships_invitations.sql
      008_content_revisions_publication.sql
    seed.sql                        Synthetic products/users; no real keys
  tests/
    unit/                           State transitions and pure business rules
    integration/                    RLS, concurrency, webhook fulfillment
    e2e/                            Customer/admin browser journeys
    agent-contract/                 Activation, lease, revocation behavior
  scripts/                          Backup/restore and release validation
  .github/workflows/ci.yml
  .github/workflows/deploy.yml
  .env.example                      Variable names/placeholders only
  .gitignore
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  tsconfig.base.json
```

Static product and checkout routes use known product slugs. The Worker maps `/orders/:id` to the static order shell while the authorized API loads the record; it must never rewrite `/api/*` to HTML. Auth callbacks go to backend routes. Catalog/content publishing triggers an authenticated build of an approved revision; newly added products generate routes automatically, with visible success/failure status. Runtime checkout validates availability independently.

The future tree includes configuration/code files because they are necessary for implementation. The current deliverable consists exclusively of `.md` documentation, as requested.

## Build phases and exit criteria

| Phase | Deliverable | Ready when |
|---|---|---|
| 1. Product decisions and infrastructure spike | Confirm products, pricing, AI-cost model; prototype deployment/auth/crypto in isolated test setup | Worker CPU/compatibility, private downloads, email domain setup, and payment onboarding feasibility verified |
| 2. Design and marketing | Brand tokens, responsive public pages, real demos, legal drafts | Mobile/keyboard review passes; accurate product and pricing information supplied |
| 3. Accounts and database | Registration, verification, recovery, profile, schema, RLS | Two test customers cannot access each other's records; role escalation fails |
| 4. Commerce and email | Test checkout, signed webhook processing, outbox, purchase email | One successful capture yields one entitlement despite retries; failed payments grant none |
| 5. Licensing and agent integration | Key vault, device protocol, downloads, SDK examples in the agents' actual languages | Correct product activates; wrong product and revoked/expired keys fail; running agent observes expiry |
| 6. Admin, team, and subscriptions | Dedicated staff login, roles/invitations, non-buyer directory, catalog/content editors, license and billing controls | Role isolation passes; Agent 4 publishes without code edits; disabled staff lose access; provider cancellation failures remain visible |
| 7. Hardening and recovery | Security review, realistic load test, backup restore, monitoring | Critical acceptance cases pass; actual free-tier limits/costs documented |
| 8. Controlled launch | Production accounts, verified domain/mail, approved payment methods, owner handover | Production checklist completed and live end-to-end payment/refund test performed under owner's launch authorization |

Do not advertise paid agent access until the downloadable agent actually implements and passes the licensing protocol. A website alone cannot retrofit enforcement into an unrelated agent binary.

## Essential acceptance cases

1. Customer A buys Agent 1 and Agent 2: keys differ. Customer B buys Agent 1: their key differs from both.
2. A product key cannot activate another product, and changing the client-supplied product ID cannot grant another server capability.
3. Concurrent duplicate webhook deliveries create one fulfillment record and one email job. A worker crash after commit does not duplicate the license on retry.
4. Forged signature, incorrect amount/currency, unpaid authorization, mismatched provider order, and another customer's order are rejected.
5. Purchase still appears if the browser closes, email fails, or the provider event arrives late. Refund-before-capture ordering does not improperly grant access.
6. The customer can reauthenticate and reveal the original key; another customer cannot reveal it or generate a download link.
7. Revocation blocks new activation and protected server calls. An honest running client loses access within the documented ten-minute lease bound, including during connection loss.
8. Renewal after manual revocation does not restore access. License expiry is checked at request time, not only by a nightly job.
9. Cancel-at-period-end retains current access; immediate revocation and provider cancellation display separate outcomes.
10. Concurrent activations cannot exceed the device cap. Customer device deactivation and key rotation invalidate the old sessions.
11. Account suspension, logout/session invalidation, password recovery, and MFA changes produce the intended access behavior.
12. No keys, passwords, card details, provider credentials, or refresh tokens appear in logs, URLs, analytics, or public build files.
13. Backup restore recovers required data and secret-decryption capability without reviving revoked entitlements; private assets restore separately.
14. Production-sized pages and crypto/API paths fit measured performance budgets or trigger a documented paid-tier decision.

15. Verify the staff role matrix, invite expiry/replay/MFA checks, non-buyer visibility, last-owner protection, and role-change concurrency from [Upgrade Two](./07-upgrade-two-admin-and-team.md).
16. Add and publish Agent 4 using only the panel; confirm generated pages, checkout, download, and activation. Failed builds preserve the previous publication; drafts remain private.

## Decisions needed before implementation

These do not block the architecture documents. They affect what we build next.

| Decision | Proposed default / information needed |
|---|---|
| Staff access | Start with Owner, Administrator, Product Manager, and Support roles; invite teammates individually |
| Editable content | Structured product, homepage, help, and contact fields; new layouts/features require development |
| Business/brand | Company name, logo direction, domain, support address |
| Merchant location | Assume India; confirm entity type and gateway eligibility |
| Three agents | Names, actual workflows, screenshots/demos, supported operating systems |
| Existing agent code | Languages/frameworks and whether the valuable work runs locally or remotely |
| Pricing | Monthly subscription or fixed-term/one-time access; exact prices and currencies |
| AI charges | Customer-provided provider key, included metered usage, or hybrid |
| Device policy | Default one active device with controlled self-service deactivation |
| Offline policy | Default online startup, five-minute refresh, ten-minute maximum lease |
| Email key policy | Include full activation key in first purchase email as requested |
| Refund and suspension | Published reasons, appeal/support process, timing, partial-refund treatment |
| International launch | Countries/currencies to support and provider approval status |
| Budget | Free development target; willingness to fund domain, fees, AI, and reliability upgrades |
| Expected scale | Launch users, concurrent agents, downloads/file sizes, support volume |

## Owner handover requirements

You own all provider accounts and recovery methods. Supply secrets through secure environment configuration during implementation, not Markdown files or chat. Deliver setup/runbook instructions, database migrations, license-management instructions, backup/restore steps, and a clear list of recurring costs. No real provider accounts, payments, emails, or deployments are created by this planning task.
