# Security, Reliability, and Realistic Costs

## What we can promise

We can design, test, monitor, and improve security. We cannot promise an unhackable website, unlimited free infrastructure, guaranteed email delivery, or unbreakable protection of downloadable software. These limits inform the design rather than preventing the business from launching.

## Security controls planned

| Risk | Control |
|---|---|
| Customer reads another customer's key/order | Ownership authorization on every operation, RLS, private secret schema, cross-account tests |
| Customer promotes themselves to admin | Server-controlled role table; deny role/profile mass assignment; fresh admin authorization |
| Admin account takeover | Mandatory MFA, recent reauthentication for sensitive actions, session revocation, audit |
| Forged payment success | Raw-body webhook signature verification and provider reconciliation; never trust frontend callbacks |
| Duplicate or reordered payment events | Durable events, unique constraints, transactional fulfillment, monotonic/reconciled state transitions |
| Key guessing or sharing | 256-bit random secrets, generic activation errors, rate limits, device cap, anomaly tracking |
| Database data leak | Encrypt recoverable keys separately; minimize stored personal data; least privilege |
| Stolen application secrets | Secret manager, separate environments, rotation procedure, no secrets in source/logs/build artifacts |
| XSS or CSRF | Escape output, restrict HTML, CSP, HttpOnly cookies, origin checks and CSRF tokens on browser mutations |
| SQL injection or bad input | Parameterized database calls, schema validation, body limits, scoped database functions |
| Download leakage | Private bucket, entitlement check, short-lived URLs, no directory listing; downloaded copies remain copyable |
| Automated abuse/cost spikes | Per-IP/account/key rate limits, bounded retries, quotas, budget alerts, challenge on suspicious auth traffic |
| Vulnerable releases | Dependency/secret scans, reviewed updates, build checksums, platform code signing when feasible |

Distributed rate limiting must use platform-supported controls or an atomic shared counter; an in-memory map in one Worker instance is insufficient. Validate cost and availability of the selected mechanism during the infrastructure spike. Do not replace real authorization with CORS or hidden buttons.

Supabase recommends enabling RLS and protecting administrator accounts with MFA. Apply those controls and verify each table policy. [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

## Upgrade Two security boundaries

Use a fixed `/admin/login` route with individual managed credentials and MFA; never hardcode or share an administrator password. Owner-controlled invitations grant fixed roles after verified acceptance. Check active membership and action permissions on every staff request, so removal or demotion is effective without waiting for token expiry. Owner bootstrap is a one-time privileged setup, not a public signup path.

Staff see only the fields their duties require. Key reveal and customer exports are owner-only; all staff changes are attributable in the audit log. Product/content inputs are validated and rich text sanitized. Uploads remain private until validated, and database text cannot become arbitrary build commands. Publication triggers and deployment callbacks require service authentication.

Additional members, invitation emails, revision storage, and automated builds consume quotas. No new pricing claims are made by Upgrade Two; original figures below are retained with their original check date. See [Upgrade Two](./07-upgrade-two-admin-and-team.md).

## Free development versus a live business

Provider figures below were checked on 22 September 2026. Prices, quotas, taxes, eligibility, and included features can change; reconfirm when signing up. Figures describe provider plans, not a guarantee that this workload fits them.

| Component | Starting cost or allowance | Practical limitation |
|---|---|---|
| Application libraries | Open-source stack; no planned framework license fee | Engineering, maintenance, and third-party assets can still cost money |
| Cloudflare Workers | Free: 100,000 dynamic requests/day and 10 ms CPU per invocation | Benchmark cryptography/auth; request allowance alone is not enough. Paid Workers starts at $5/month plus overages |
| Supabase | Free: 500 MB database, 1 GB storage, 50,000 monthly active users | Finite egress; inactivity pausing; no included automatic backups. Pro starts at $25/month |
| Resend | Free: 3,000 emails/month, maximum 100/day | Authentication, purchases, recovery, and notices share the quota |
| Razorpay | No advertised standard setup/maintenance fee; transaction charges apply | Advertised standard domestic fee around 2%; international around 3%; applicable tax and merchant-specific terms must be checked |
| Website address | Provider subdomain can serve a pilot | A branded domain normally has annual registration/renewal costs; email needs a domain you control |
| Agent AI usage | Depends on model/provider and usage | Not covered by website hosting quotas |
| Agent installer distribution | Start within private storage allowance | Large binaries/download volumes exhaust space/egress quickly; code-signing credentials can cost extra |
| Backups and operational monitoring | Start with small independent encrypted exports and basic provider logs | Storage, retention, alerting, and reliability requirements can add costs |

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Supabase pricing](https://supabase.com/pricing), [Resend pricing](https://resend.com/pricing), [Razorpay domestic pricing information](https://razorpay.com/solutions/e-commerce/), [Razorpay international pricing](https://razorpay.com/international/).

UPI being a payment option does not mean the chosen gateway charges nothing for it. Use the merchant's actual fee agreement when calculating margins. Payment fees and taxes are separate from whatever taxes apply to your own sales; confirm invoice and cross-border requirements with a qualified adviser before launch.

### Budget scenarios

1. **Development/demo:** aim for zero infrastructure subscription spend within free quotas; use test payments and restricted/test email recipients. This does not prove readiness for real customers.
2. **Small pilot:** free tiers may cover usage, but budget for the domain, transaction fees, AI consumption, and backups. Accept and disclose the effect of service limits.
3. **Revenue-dependent production:** a baseline upgrade example is $5/month Workers plus $25/month Supabase, before taxes, overages, email upgrades, domain, AI, and other services. This is an illustrative minimum for those two subscriptions, not a complete operating-cost estimate.

Free-tier exhaustion or database pausing can prevent both purchases and agent activation. Choose the availability/cost tradeoff deliberately. Supabase free projects may pause after a week of inactivity. [Supabase pricing](https://supabase.com/pricing).

## AI costs and licensing economics

Choose one model before pricing products:

- Customer brings their own AI-provider key: explain setup and provider charges; store that key locally in the OS credential store where possible. Fully local execution weakens central enforcement.
- You provide metered AI usage: keep provider keys server-side; authorize and meter every request; enforce per-customer spending limits.
- Hybrid: include a defined allowance, then stop or require an explicitly purchased top-up. Do not surprise customers with unlimited charges.

Lifetime software access must not accidentally promise unlimited lifetime AI compute. The initial licensing service does not itself run or fund the agents.

## Backups and recovery

Create encrypted database exports outside the primary project on a schedule and copy private release assets separately. Verify whether managed Auth data and all required schemas are captured by the chosen backup method; a public-schema dump is not a complete recovery plan. Preserve migration history and recover encryption keys separately. Treat authentication/session recovery and storage objects as explicit restore tasks.

Supabase recommends regular off-site database exports for free projects. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).

Proposed pilot targets: recovery point <= 24 hours and recovery time <= 1 business day, contingent on a successful restore rehearsal. A database restore must replay/reconcile newer payment and revocation events before reopening access; otherwise an old backup could revive a revoked key. Higher availability needs a funded design.

## Operations and incident handling

- Monitor payment-to-license failures, activation denials, unusually high traffic, pending cancellations, email failures, and approaching quotas.
- On suspected credential compromise: restrict affected access, rotate credentials, revoke sessions, preserve safe audit evidence, investigate scope, and communicate as required by the actual incident.
- Keep an owner recovery path and offline MFA recovery material. Do not store recovery codes in this repository.
- Separate development and production projects, provider keys, webhook secrets, and encryption material. Use synthetic customer records in tests.
- Set explicit retention for login metadata, device information, support records, and audit logs. Avoid collecting agents' task content merely to license them.
- The promise of dashboard history lasts while the account/service is maintained, subject to published retention and lawful deletion handling. It is not a literal promise of storage forever.
