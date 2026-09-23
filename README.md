# Current update — September 23, 2026

Omnix, Voro, and Rolvio are now in the catalog. Supabase account integration is implemented locally and awaits project setup. [Current phase status](./docs/10-phase-1-and-2-status.md) · [Supabase setup](./SUPABASE-SETUP.md) · [Product definitions](./docs/09-product-definitions.md).

# NORVI — Website and Planning Documents

Prepared: 22 September 2026. Status: first local website preview implemented; production integrations and deployment are pending.

## Open the website

See [START-NORVI.md](./START-NORVI.md) for startup instructions and preview entry points. Run 
pm run dev` in this directory, then open http://127.0.0.1:4321/.

## The business we are planning

A website selling three downloadable AI agents, with customer accounts, verified payments, unique licenses, purchase emails, downloads, and an owner-and-team administration area. The backend generates keys after payment; customers do not generate their own entitlements.

Each customer receives a different key for each purchased agent. The dashboard keeps the purchase and license record available, including expired or revoked status. You can view customer/license associations, reveal keys with additional authentication, revoke access, rotate keys, reset devices, and request cancellation of recurring billing.

## Read these documents

| Document | Contents |
|---|---|
| [Architecture](./docs/01-architecture.md) | Recommended technologies, responsibilities, deployment, performance, API design |
| [Pages and sections](./docs/02-pages-and-sections.md) | 35 page templates, 39 initial page instances, navigation, named sections |
| [Database and licensing](./docs/03-database-and-licensing.md) | Customer records, key generation/storage, agent activation, revocation, admin controls |
| [Payments and email](./docs/04-payments-and-email.md) | UPI/cards/international payments, subscription lifecycle, reliable fulfillment, email content |
| [Security and costs](./docs/05-security-and-costs.md) | Security boundaries, free-tier limits, unavoidable costs, backup and incident response |
| [Files and delivery plan](./docs/06-files-and-delivery-plan.md) | Proposed future file tree, build phases, acceptance criteria, decisions still needed |

## Upgrade Two

The plan now includes a dedicated `/admin/login`, individual staff accounts with MFA, Owner/Administrator/Product Manager/Support roles, a directory including non-buyers, and product/content editors. A fixed URL is fine; passwords are managed securely rather than hardcoded. See [Upgrade Two — admin and team](./docs/07-upgrade-two-admin-and-team.md) for permissions and publishing workflows.

## Recommended starting stack

Astro + React + TypeScript for the frontend; Hono on Cloudflare Workers for the backend; Supabase PostgreSQL, Auth, and private Storage; Razorpay Checkout for payments; Resend for transactional email. Use open-source libraries and provider free tiers for development and a small pilot. These are recommendations for this project's needs, not a claim that one stack is universally best.

## Important boundaries

- A completely free commercial operation cannot be promised. Payment processing, a branded domain, AI usage, and growth beyond free quotas have costs.
- No honest design can promise that nobody will ever hack it. The plan uses layered protection and measurable security checks.
- Revoking a license and canceling billing are separate actions. Deleting a database row must not be the normal management workflow.
- Downloaded software can be modified. Critical functionality performed by your server gives stronger enforcement than a local activation screen alone.
- Proposed local-agent policy: online activation, checks every five minutes while running, and a maximum ten-minute authorization lease. Server operations check current access on every request. These are product defaults to confirm, not implemented guarantees.
- Full license keys are recoverable in the profile and included in the first purchase email as requested. That requires encrypted recoverable storage, not just an irreversible hash. Email copies cannot be remotely withdrawn.

## Working assumptions

You operate an India-based business, initially sell three individual products, and start as the owner with the ability to invite staff. Start with one product per checkout, one device per license, and INR domestic pricing. International sales and automatic renewals launch only when the provider approves the relevant payment methods. Product names, prices, operating systems, brand identity, and who pays the agents' AI costs remain undecided.

The original documents describe the target architecture. See [current implementation status](./docs/08-implementation-status.md) for what is working now.
