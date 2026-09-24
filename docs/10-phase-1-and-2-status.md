# NORVI — Phase 1 and 2 Implementation Status

## Phase 1: Product definitions and catalog

Implemented Omnix, Voro, and Rolvio product pages, search results, cards, descriptions, features, and release-status labels. Omnix is in development and cannot be purchased, including through a direct preview API request. Voro and Rolvio are preparing for launch; completed application status is founder-reported, not independently tested.

Prices, billing terms, AI allowances, system requirements, tested binaries, and release/support policies still need founder decisions. These were not invented. See [Product definitions](./09-product-definitions.md). Phase 1's catalog work is complete; final commercial definitions and product acceptance remain open.

## Phase 2: Account and database implementation

Implemented:

- Supabase email/password registration and login, email verification/resend, recovery, and logout.
- Request-scoped server clients and HttpOnly session cookies; Secure cookies on HTTPS. No access or refresh tokens returned in API JSON.
- Configured account mode separated from synthetic preview mode; missing account configuration fails closed.
- Profile provisioning, scoped profile updates, persistent support requests, and own-account record reads.
- Individual staff memberships with role checks and TOTP enrollment/verification. Staff access requires MFA.
- A paginated staff customer directory, including accounts without purchases.
- PostgreSQL migrations, RLS policies, restricted RPC functions, and profile-update audit records.
- Same-origin mutation checks, request-size limits, and a required production auth rate-limit binding.
- Local configuration instructions and an explicit database-owner provisioning procedure.

**Not connected yet:** No hosted Supabase project exists for this task. No remote migration, real registration, email delivery, MFA provider flow, or deployed browser session has been tested. Follow [Supabase setup](../SUPABASE-SETUP.md), then complete its real-project acceptance checklist before marking Phase 2 operational.

Staff invitations, real product editing/publication, payments, licensing enforcement, downloads, purchase email, and commerce administration remain later phases. The real admin workspace clearly identifies those unavailable operations. No production deployment was made.

## Validation

- TypeScript checking passed.
- 30 automated tests passed: 11 preview tests, 11 account boundary/cookie tests, and 8 PostgreSQL-engine migration/policy tests.
- Tests cover Omnix purchase blocking, data isolation, denied role escalation, suspended accounts, staff MFA, recovery validation, redirect restrictions, and secure cookie attributes.
- PostgreSQL tests run in PGlite with a minimal Auth-schema fixture. Account-provider tests use controlled responses. These do not replace hosted Supabase integration tests.
- Static build and Worker dry build passed before the drive interruption; final verification is recorded below when completed.

The local preview remains available without credentials. Real account mode needs the setup guide. Product planning decisions and hosted-provider acceptance are the remaining work for these phases.

## Recent Updates (September 23, 2026)

- **Website Deployment:** The public website has been successfully deployed to the internet via Netlify (`norvi-agency.netlify.app`). The marketing pages and product catalog are now live. Note: Database, real authentication, and payments are still pending production connection.
- **Global Navigation Fixes:** Improved the global Header behavior for authenticated users:
  - The public marketing header is now hidden when a user is actively viewing their private Workspace (`/account` or `/admin`) to prevent UI overlap.
  - The main `App` component now dynamically fetches the user's session state (`/api/me`). When a user is logged in, the "Log in" button on the public homepage seamlessly transforms into a clickable profile avatar that directs them to their dashboard, eliminating the need to log in repeatedly.
