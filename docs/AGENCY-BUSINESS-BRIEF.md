> Product update: NORVI now lists Omnix (in development), Voro, and Rolvio (both preparing for launch). See [product definitions](./docs/09-product-definitions.md) for the current scope and [implementation status](./docs/10-phase-1-and-2-status.md) for account progress.

# AI Agent Business — Complete Project Brief

**Agency name:** NORVI, selected by the founder after the initial planning stage.

**Document status:** Planning brief, consolidating the original concept and the admin/team upgrade. The first local website preview has been implemented. Production integrations and launch remain pending; see docs/08-implementation-status.md for the current build status.

**Audience:** Potential teammates, designers, developers, collaborators, and anyone who needs to understand the proposed business. This document stands on its own; no other planning file is required to understand it.

## 1. Business vision

The founder wants to build a company that develops and sells AI agents to help people automate their work. The website will be the central place to discover the products, understand their capabilities, create an account, purchase access, receive an activation key, and download the software.

The business starts with three agents and should support additional products over time. The owner and authorized teammates will manage routine operations through an admin panel, including adding product listings, managing customers and licenses, and updating supported website content.

Although the founder describes this as an agency, the initial business model is a catalog of the company's own software products. Custom consulting, client-specific development, and a marketplace for other sellers are not currently committed services.

The intended outcome is a professional, responsive, secure, and maintainable sales and licensing platform that can grow with the business.

## 2. What is decided and what is still a proposal

| Item | Current position |
|---|---|
| Agency identity | Name: NORVI. Domain and final brand identity remain to be finalized. |
| Initial catalog | Three agents, with more added later through the admin panel |
| Agent capabilities | Exact functions, names, platforms, and integrations are still to be supplied |
| Customers | People and businesses seeking work automation; the first specific customer segment is undecided |
| Customer accounts | Registration, login, profile, purchase history, licenses, and downloads are required |
| Payments | UPI, cards, and international payments are desired |
| Licensing | Unique activation credentials for each customer and purchased agent |
| Owner control | Customer/license visibility, revocation, device management, and billing controls |
| Team access | Individual staff accounts with role-based permissions |
| Purchase email | Thank-you message, account login information, activation key, and setup guidance |
| Budget preference | Free development and low operating costs, subject to provider limits and unavoidable costs |
| Merchant location | India is a working assumption, not a confirmed business registration |
| Pricing model | Subscription, fixed-term, or one-time access is still to be selected |
| Technical choices | Proposed stack described below; compatibility must be tested during implementation |
| Initial license defaults | One active device; online startup; five-minute refresh; ten-minute authorization lease, subject to confirmation |

## 3. Product offer and customer value

Each agent should solve a clearly stated task for a clearly identified customer. Before selling an agent, its product page should explain:

- The work it performs and the problem it addresses.
- Who it is intended for and when it is useful.
- A real demonstration of its workflow and output.
- Required operating system, accounts, permissions, and integrations.
- What is included in the price, including support and updates.
- Whether the customer pays separately for AI-provider usage.
- Device limits, internet requirements, access duration, and important limitations.

No particular agent capability, customer result, revenue outcome, or performance claim is established yet. Product descriptions and demonstrations must reflect what the agents actually do.

## 4. End-to-end customer experience

1. **Discover:** A visitor finds the website and browses the catalog, demos, features, and pricing.
2. **Register:** They create an account, verify their email, and complete the necessary profile details.
3. **Purchase:** They select an agent and pay using an available supported method.
4. **Verify:** The backend confirms payment with the payment provider. A browser success message alone does not grant access.
5. **Issue access:** The backend creates a license and a unique activation key for that customer and that product.
6. **Deliver:** The purchase and key appear in the account. A transactional email provides the key and instructions.
7. **Download:** The customer downloads the correct agent release through an authorized download link.
8. **Activate:** The agent asks for the activation key and validates access through the backend.
9. **Use and manage:** The customer uses the agent, checks billing, manages permitted devices, and contacts support from their account.
10. **Recover:** If they forget the key, they sign back in and reveal it after the required identity check.

Purchase and license records remain available while the account and service are maintained, subject to the published retention and deletion policy. Keeping a record does not mean that a subscription or license never expires.

## 5. Customer accounts and visibility

The platform will support registration, email verification, login/logout, password recovery, profile updates, and account security controls. Authentication will be handled by a managed identity service rather than a custom password database.

The customer dashboard will contain owned products, access status, masked keys with a reveal action, downloads, active devices, purchase history, subscription information, receipts, and support access.

The owner will also be able to view registered people who have not purchased anything. Profiles are created during registration, not only after a sale. The customer directory will support filters such as:

- All registered customers.
- Unverified or incomplete accounts.
- Registered with no purchases.
- Signed in with no purchases, where sign-in data is available.
- Customers with active, expired, or revoked licenses.
- Suspended accounts.

Directory records can include name, email and verification status, registration date, last successful sign-in where available, purchase count, and license status. Anonymous visitors are not identifiable customer accounts. Registration does not automatically imply consent to marketing messages.

## 6. Activation keys and product access

### Unique customer and product combinations

Keys are issued by the server after a verified purchase. They are not chosen by customers.

| Example | Required behavior |
|---|---|
| Customer A buys Agent 1 | Receives a key bound to Customer A's Agent 1 license |
| Customer A buys Agent 2 | Receives a different key bound to Agent 2 |
| Customer B buys Agent 1 | Receives a different key from Customer A |
| An Agent 1 key is entered into Agent 2 | Access is denied |

The backend enforces the product association. Merely changing a prefix or product name cannot turn one license into another.

### Generation and recovery

The proposed design generates keys from 256 bits of cryptographically secure randomness and enforces uniqueness in the database. There is no small predefined list of keys, although actual storage capacity depends on infrastructure limits.

To support retrieving the original key later, store an encrypted recoverable copy and a separate lookup hash. Encryption secrets stay outside the database in protected backend configuration. Customers see masked keys by default and reauthenticate to reveal them. Staff access to full customer keys is limited to the owner, with MFA and an audit record.

An activation key is the business's product license credential. It is distinct from an AI provider's API key, payment credentials, and the customer's account password.

### Activation and continued validation

On activation, the backend checks the key, product, license duration, account standing, manual revocation status, and allowed devices. It then grants a short-lived authorization tied to that product and device.

The proposed default is online validation at startup, refresh every five minutes during use, and a maximum ten-minute authorization lease without extra offline grace. Server-hosted protected operations check current access on every request. Device allocation must be atomic so concurrent activation attempts cannot exceed the device allowance.

These are design defaults, not capabilities already implemented or guaranteed for every future agent.

## 7. Owner control over licenses and billing

The owner can inspect customer/license relationships, revoke or restore access, replace a compromised key, reset devices, and manage subscription cancellation through the panel.

Normal revocation changes the license status and invalidates device sessions while retaining the record and reason. Deleting rows is not the routine cancellation workflow because it loses business history and can interfere with payment reconciliation.

| Action | Meaning |
|---|---|
| Revoke license | Block entitlement to use the agent |
| Restore license | Remove the manual block; paid entitlement must still be valid |
| Rotate key | Replace the secret and invalidate the old key and sessions |
| Reset device | Release an activation slot under the device policy |
| Cancel at period end | Stop future renewal while preserving already-paid access until expiry |
| Cancel immediately | Request the provider's immediate billing cancellation; access treatment must be explicit |
| Refund | Request money back through the provider and apply the published entitlement policy |

Revoking access does not automatically stop future charges. The interface must show billing cancellation and license revocation as distinct outcomes, including pending or failed provider requests. A later renewal event must never silently clear an owner's manual revocation.

New activations are denied after revocation. An unmodified running local agent stops at its next failed refresh or lease expiry under the proposed policy. Previously downloaded files cannot be recalled, and entirely local software can be modified to bypass checks. Stronger enforcement depends on keeping valuable functionality behind an authorized server service.

## 8. Admin panel and team access

The planned admin entry point is `/admin/login`, with the panel at `/admin`. Customer login remains separate in the interface. A fixed address is acceptable, but the address itself is not a security mechanism.

Every staff member receives an individual account and must use multi-factor authentication. Passwords will not be hardcoded, shared, or embedded in the application. The founder's verified account is granted the initial owner role through a controlled one-time setup.

The owner invites teammates with a fixed role. Invitations are proposed to expire after 48 hours, can be revoked, and require acceptance by the matching verified email and MFA setup. Membership and permissions are checked on every protected request. Removing staff access does not delete any separate customer purchases that person owns.

| Role | Main permissions |
|---|---|
| Owner | Full business controls, staff management, owner-only key reveal/customer export, policy/settings management, and provider-account ownership |
| Administrator | Customer and license operations, refunds/cancellations, catalog/content management, and operational audit visibility; no staff-role management or full-key reveal |
| Product Manager | Product listings, prices, releases, supported content, and publishing; no customer directory or billing access |
| Support | Limited customer/order/license metadata and device resets with reasons; no full-key reveal, refunds, or license revocation |

The system records who performed sensitive actions, when, and why. Staff cannot promote themselves or remove the final owner. The panel gives controlled access to business records; it is not an unrestricted SQL console or a way to expose infrastructure secrets.

## 9. Adding agents and updating content without code edits

An authorized user will choose **Products → Add agent**, enter the product details, configure a supported price and license policy, upload release files, preview the draft, and publish it.

Editable product information includes name, description, features, media, demonstration links, requirements, supported platforms, FAQs, prices, usage disclosures, release versions, and download files. Supported homepage, help, and contact content will also be editable.

Publishing saves an approved revision and automatically builds the relevant catalog, product, checkout, pricing, and sitemap pages. The panel shows Draft, Publishing, Live, or a useful failure state. Failed builds preserve the previous live version. Drafts remain private.

Adding a fourth or later listing will not require manual source changes. However, building the actual agent, implementing its licensing integration, adding a new website capability, or creating a new payment-provider integration still requires development.

Prices are versioned so changes do not rewrite old receipts or silently alter existing subscriptions. Unpublishing stops new purchases; archiving a product preserves existing entitlements and downloads by default. Revoking customer access is a separate action.

## 10. Payments and financial operations

The proposed initial provider is Razorpay with hosted Checkout, assuming an eligible India-based business. The desired payment methods are UPI, debit/credit cards, and international payments. Actual methods and currencies depend on merchant onboarding and provider approval.

One-time UPI payments and recurring UPI mandates are different capabilities. International acceptance and international subscription support also need separate verification. If automatic renewals are unavailable, clearly labeled fixed-term purchases with manual renewal are a possible starting model.

The application will never collect or store card numbers, CVV, UPI PINs, or banking passwords. The provider handles sensitive payment entry.

Payment processing must include server-calculated prices, verified signed provider notifications, amount/currency/order checks, duplicate-event protection, and reconciliation of uncertain results. A database transaction creates exactly one entitlement for a purchase even if notifications repeat. Failed or merely authorized-but-uncaptured payments do not unlock access.

Refunds, disputes, renewals, cancellations, and delayed payment notifications must be reflected in account and admin views. Business-specific refund terms, invoicing, tax treatment, and international selling requirements must be finalized before launch.

## 11. Purchase and account emails

The first purchase email will go to the verified customer email and contain:

- A thank-you message and product name.
- Order reference, date, amount, currency, and receipt access.
- The login email and website login link, never the account password.
- The purchased product's activation key.
- Dashboard/download access, installation instructions, access term, and device limit.
- Support contact information.

The full key is included to meet the founder's request. Email leaves a copy in the customer's mailbox and delivery infrastructure; that copy cannot be recalled, although rotating the key invalidates it. Renewal notices normally use a masked key rather than repeatedly sending the full secret.

Email jobs are saved durably and retried when appropriate. An email outage must not remove a paid license from the customer's dashboard. Delivery failures are visible to administrators. Verified sending-domain configuration and production authentication-email setup are part of launch preparation.

## 12. Website pages and user-facing sections

The current complete plan has **35 page templates**. With three initial product-detail pages and three product-specific checkout pages, this represents **39 initial page instances**, before customer-specific order records and other dynamic URLs. There are **148 planned content sections** across the templates, excluding shared navigation and repeated instances. These counts describe the planning inventory, not completed screens.

| Area | Templates | Pages |
|---|---|---|
| Public website | 11 | Home, Agent Catalog, Agent Detail, Pricing, About, Contact, Help, Privacy, Terms, Refunds, License Agreement |
| Customer authentication/onboarding | 5 | Register, Login, Verify Email, Password Recovery, Complete Profile |
| Customer and checkout | 8 | Dashboard, My Agents, Keys and Devices, Billing, Profile and Security, Support, Checkout, Order Status |
| Administration | 11 | Overview, Customers, Licenses, Orders, Subscriptions, Products and Releases, Audit and Delivery, Settings, Admin Login, Team, Content |

The homepage will explain the offer through a hero/value proposition, problems solved, featured agents, how it works, a demo, benefits, pricing preview, trust/security information, FAQ, and a final call to action.

Each product page will explain its intended users, features, workflow demo, integrations, requirements, pricing/usage, activation instructions, and FAQs. Account screens focus on purchases and access; admin screens focus on manageable records and permitted actions.

Shared design requirements include mobile layouts, keyboard navigation, visible focus, readable contrast, accessible forms, reduced-motion support, and clear loading/error/empty states. Marketing will use real demonstrations and evidence rather than invented testimonials or unsupported claims.

## 13. Proposed technology and architecture

| Component | Proposed technology | Responsibility |
|---|---|---|
| Public frontend | Astro | Fast, indexable marketing and product pages |
| Interactive frontend | React and TypeScript | Customer and admin interfaces |
| Styling | Tailwind CSS and accessible components | Consistent responsive appearance |
| Backend | Hono and TypeScript on Cloudflare Workers | Accounts, payments, licensing, administration, and APIs |
| Database | Supabase PostgreSQL | Related customer, purchase, subscription, and license records |
| Authentication | Supabase Auth | Managed credentials, verification, recovery, and MFA |
| Downloads | Supabase private Storage initially | Protected release files with expiring download links |
| Payments | Razorpay hosted Checkout | Payment collection and provider events |
| Email | Resend API/SMTP | Purchase notices and authentication email transport |
| Validation/testing | Zod, Vitest, Playwright, database integration checks | Request validation and critical behavior verification |
| Delivery | Git, GitHub Actions, Wrangler | Version history, checks, builds, and deployment |

These choices are the current proposal, not a universal ranking of technologies. The implementation phase will validate compatible stable versions and runtime limits.

The basic flow is: customer or agent → backend → authentication/database/payment services. Public content is served as generated assets. Private data is obtained only through authorized requests. A background worker processes persistent email jobs and payment reconciliation. Database changes create the entitlement and delivery job together, so a crash does not lose a paid purchase.

Actual AI execution is a separate architectural decision. Long-running automation, browser execution, or GPU workloads may require separate services; they are not assumed to fit the licensing backend.

## 14. Database and information management

The planned records cover:

- Authentication identities, customer profiles, staff memberships, and invitations.
- Products, versioned prices, releases, editable content, and publication revisions.
- Orders, order items, payments, refunds, and subscriptions.
- Licenses, encrypted key material, devices, and device sessions.
- Provider events, durable background jobs, email delivery status, and publication jobs.
- Administrative audit history and support requests.

Relations and database constraints enforce ownership and prevent duplicate fulfillment. Prices use integer minor currency units, and timestamps use UTC. Normal customers can access only their own information; staff access is limited by role. Full keys, credentials, and private customer details must not appear in public assets or logs.

The owner retains ownership of the database project and infrastructure accounts. Routine management happens through the application; exceptional database maintenance uses the provider's secured tools.

## 15. Security, reliability, and performance

The goal is layered, tested security. No website or downloadable software can honestly be promised impossible to compromise.

Planned controls include verified sessions, secure cookies, protection against forged browser requests, row-level database access rules, input validation, staff MFA, least-privilege permissions, signed payment notifications, rate limits, encrypted recoverable keys, private downloads, and auditable sensitive actions.

Development and production use separate credentials and environments. Secrets are kept out of source files and browser code. Dependencies and releases are reviewed, and logs avoid credentials and unnecessary personal data.

Backups must include required database/auth data and release files, with encryption-key recovery handled separately. Restore rehearsals must verify that old backups do not accidentally revive revoked licenses. The pilot proposal targets up to 24 hours of data loss and recovery within one business day, subject to testing and the chosen service plans; these are not current service guarantees.

Performance work includes small public JavaScript bundles, optimized images, lazy-loaded demos, database indexes, pagination, and caching only public content. Target public-page metrics are LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1, to be measured on the actual site.

Operational monitoring should highlight payment-to-license failures, activation problems, email failures, pending cancellations, publication failures, abnormal traffic, and approaching quotas.

## 16. Budget and revenue model

The founder wants to minimize cost and use free services where practical. The plan can begin with open-source tools, test payments, and provider free tiers. A fully free commercial operation cannot be guaranteed.

Potential expenses include domain registration, payment transaction fees, AI usage, hosting/database upgrades, email volume, download storage/traffic, backups, code signing, and support time. Provider limits and prices must be rechecked when accounts are configured; this brief intentionally does not present historical plan prices as a current quote.

Official references for checking service terms and costs:

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Supabase pricing](https://supabase.com/pricing)
- [Resend pricing](https://resend.com/pricing)
- [Razorpay payment information](https://razorpay.com/solutions/e-commerce/)
- [Razorpay international payments](https://razorpay.com/docs/payments/international-payments/)

Three AI-cost models remain possible: customers supply their own provider credentials, the business includes a metered allowance, or a hybrid model combines the two. This choice affects pricing, support, enforcement, and margins. A lifetime software license must not accidentally promise unlimited lifetime AI compute.

Subscription, fixed-term, and one-time pricing are still business decisions. Final prices should account for ongoing usage and support rather than only the cost of building the software.

## 17. Implementation and launch sequence

| Stage | Deliverable |
|---|---|
| 1. Clarify the offer | Brand direction, intended buyers, three product descriptions, AI-cost model, pricing approach |
| 2. Validate the technical foundation | Test hosting/runtime compatibility, authentication, private downloads, email setup, and payment eligibility |
| 3. Establish the visual design | Homepage and one product page, mobile layout, shared components, real demos |
| 4. Build accounts and administration | Registration, profiles, permissions, team access, non-buyer directory, product/content editors |
| 5. Build commerce | Test checkout, verified fulfillment, licenses, purchase emails, and billing history |
| 6. Connect one real agent | End-to-end purchase, download, activation, device management, expiry, and revocation |
| 7. Extend and harden | Remaining products/pages, subscription workflows, role tests, load testing, monitoring, restore rehearsal |
| 8. Pilot and launch | Small intended-user group, feedback fixes, production setup, controlled live payment/refund validation |

Prove one complete paid-product journey before multiplying it across the catalog. The full page inventory is the roadmap; it can be implemented in reviewable groups. No launch date or delivery duration is committed yet.

## 18. Conditions for launch readiness

- A successful verified purchase creates exactly one correct license, despite repeated or delayed provider events.
- Failed, forged, mismatched, or unpaid transactions do not unlock products.
- Customers cannot read each other's orders, keys, or downloads.
- Product-specific keys, expiry, device limits, rotation, and revocation work in the actual agent.
- Staff roles restrict direct API calls as well as visible buttons; removing staff access takes effect on the next protected request.
- Registered non-buyers appear in the customer directory.
- An authorized editor can publish another agent without editing source code.
- Purchase access remains available when email delivery is delayed, and failed jobs can be investigated.
- Cancellation, refunds, and manual revocation have clear and separately visible results.
- Backups can be restored, credentials remain private, and mobile/accessibility checks pass.
- The owner has the credentials, recovery methods, operational instructions, and understanding of ongoing costs needed to run the business.

## 19. Practical guidance for the founder

Start with a specific customer problem and a clear demonstration. Talk with potential buyers about how they do that work today before expanding the feature list. Early feedback should guide the product and the explanations on its page.

Keep the first offer understandable. Explain what the agent does, what it costs, what the customer needs to supply, and how support works. Avoid broad promises about earnings, perfect automation, unlimited usage, or guaranteed outcomes.

Track meaningful results: purchases, successful activations, continued use, cancellations, refunds, and recurring support questions. Website visits alone do not establish product demand. Use repeated questions to improve onboarding and help content.

Keep business accounts under the founder's ownership and invite teammates individually. Publish understandable support, refund, privacy, and license terms before accepting money. Collect only the customer data needed for operating the service.

## 20. Decisions still required

The founder still needs to provide or decide:

1. Final visual identity, domain preference, and support contact. The name is NORVI.
2. Each agent's name, function, demonstration, existing code/runtime, operating systems, and requirements.
3. The first customer segment and the main problem the offer addresses.
4. Prices, currencies, billing duration, and who pays AI-provider charges.
5. Device allowance, offline policy, update/support coverage, and refund/suspension rules.
6. Business location/entity details and eligibility for the desired payment methods.
7. International launch markets and whether automatic renewals are essential at launch.
8. Expected customer/download volume and budget for costs beyond free tiers.

## 21. Scope boundaries and future expansion

The initial scope is the company's own agent catalog, customer accounts, payments, licensing, downloads, email, and owner/team administration. Affiliate systems, a seller marketplace, customer organization seats, a full blog or arbitrary-layout CMS, coupons, a shopping cart, and custom consulting offerings are deferred unless explicitly added later.

The business can expand its product catalog through the planned panel. Additional infrastructure and software features should follow actual product needs and customer demand.

**Current position:** The business is in early implementation under the name NORVI. This document describes the intended business and proposed implementation, and does not imply that products, revenue, customers, payment approvals, or a live website already exist.
