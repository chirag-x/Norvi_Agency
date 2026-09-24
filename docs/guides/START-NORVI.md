# NORVI — Open the Website

NORVI runs locally in preview mode by default. Phase 1 now contains Omnix, Voro, and Rolvio. Phase 2 account integration is implemented but awaits a Supabase project. See [Supabase setup](./SUPABASE-SETUP.md) and [current phase status](./docs/10-phase-1-and-2-status.md).

## Start

Open a terminal in `E:\Agency` and run:

```powershell
npm install
npm run dev
```

Keep that terminal running. Open [NORVI](http://127.0.0.1:4321/).

| Area | Address | How to enter |
|---|---|---|
| Website | [Home](http://127.0.0.1:4321/) | Browse normally |
| Customer | [Login](http://127.0.0.1:4321/login) | Choose **Preview customer account** |
| Owner | [Admin login](http://127.0.0.1:4321/admin/login) | Choose **Preview owner workspace** |
| Staff role preview | [Admin login](http://127.0.0.1:4321/admin/login) | Choose Product manager or Support role |

There are no hardcoded passwords. These are explicitly labeled synthetic preview sessions, not real authentication. Do not enter real customer information. The API binds only to the local computer. Never expose this development server through a public tunnel.

## Try the main journeys

1. Open the customer preview, explore Voro or Rolvio, open checkout, acknowledge the sample-order notice, and choose **Simulate purchase — no charge**.
2. Open **Keys & devices**, reveal the synthetic activation key, and view the order in **Billing & orders**.
3. Open the owner preview and visit **Customers**. Accounts with no purchases are included.
4. Visit **Licenses**, revoke the sample key with a reason, then see the updated customer license status.
5. Visit **Products & releases → Add agent**, enter placeholder details, select **Published — local preview**, and save. The catalog and generated routes update from public catalog data; no manual code edits are required.
6. Change the homepage headline in **Content** or company placeholders in **Settings**, then revisit the homepage.
7. Explore staff-role restrictions, staged invitations, support requests, and the audit log.

Switching preview roles replaces the session in that browser. Preview sessions expire after one hour and reset when the API restarts. Sample records persist in the ignored `.local/preview.json`; the local encryption key is in `.local/key`. Neither should be shared or committed.

Public product/content data is copied to `packages/shared/catalog.json` for rendering and static builds. This snapshot deliberately excludes accounts, orders, licenses, and secrets. Drafts and archived products are omitted from it.

## What still needs connecting

Registration/login, verification, recovery, MFA, and account persistence now have a Supabase integration. Follow SUPABASE-SETUP.md to create/configure the project, apply migrations, configure email templates, provision the owner, and complete real-provider tests. Payment capture, subscriptions, purchase emails, invitation acceptance, downloads, and signed agent leases remain future implementation work.

The production Worker supports the account integration and fails closed when it is unconfigured. Commerce operations still return unavailable responses. It does not import the local preview server or provide preview role switching. No production deployment has been made.

## Developer commands

```powershell
npm run check
npm test
npm run build
```

The initial three-agent build generates 42 route instances plus the 404 page. `npm run build` first refreshes the public catalog snapshot. `npm run preview` serves built static assets only; use `npm run dev` for the interactive local API.

The two database migrations in `supabase/migrations` have passed local PostgreSQL-engine policy tests. They have not been applied or verified against hosted Supabase. Do not point it at an unrelated existing project.

See [Implementation status](./docs/08-implementation-status.md) for current scope and remaining launch work.
