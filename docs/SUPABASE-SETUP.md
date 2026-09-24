# NORVI — Supabase Setup for Phase 2

The founder has created a Supabase project. Read-only checks confirmed the project URL/publishable key work, email authentication is enabled with confirmation, and the three product rows are accessible. Full hosted account, policy and email acceptance testing is still required. For the selected hosting provider, follow [NETLIFY-SETUP.md](NETLIFY-SETUP.md); the Cloudflare section below describes the older alternative.

## 1. Create a dedicated development project

Create your own Supabase account and a new project for **NORVI development**. Keep its database password in your password manager. Do not use an unrelated existing project's database. Later, create a separate production project; do not copy sample customers or preview keys into it.

## 2. Apply the database migrations in order

The names below are **file paths, not SQL commands**. Supabase cannot read files on your computer from a path pasted into its SQL editor.

For the first file:

1. Open Windows File Explorer and navigate to `E:\Agency\supabase\migrations`.
2. Right-click `001_initial_schema.sql` and open it with Notepad or your code editor.
3. Inside that file, press **Ctrl+A**, then **Ctrl+C** to copy all its SQL code.
4. Return to Supabase's SQL Editor. Click inside the query editor, press **Ctrl+A**, then **Ctrl+V**. This replaces the incorrect path with the full SQL script.
5. The pasted script should contain many lines, including `begin;`, `create schema`, and `create table`, and end with `commit;`.
6. Click **Run**. A successful schema script normally reports success without returning rows.
7. Open a new query and repeat the same steps with `002_accounts_and_catalog.sql`. Run it only after the first script succeeds.

The two files, in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_accounts_and_catalog.sql`

Run each migration once. If it fails, investigate the error before continuing; do not delete an existing database to retry. The scripts are transactional and intended for a new dedicated project.

These create profile provisioning, staff memberships, product records, commerce foundations, row-level policies, restricted account operations, and audit records. They do not create an owner, active prices, paid orders, or licenses.

Keep `private` out of the exposed Data API schemas. Do not disable RLS or grant browser clients table-write permissions.

## 3. Configure email/password authentication

Enable the email/password provider and **email confirmation**. Set the minimum password length to at least 12 characters. Set the development Site URL to exactly:

```text
http://127.0.0.1:4321
```

Use this host consistently; `localhost` and `127.0.0.1` are different origins. Configure authenticator-app/TOTP MFA. Review provider rate limits, email sending restrictions, and SMTP setup before inviting testers. Real confirmation and recovery emails are sent by Supabase Auth, separate from the later purchase-email integration.

## 4. Install the required auth email links

**Dashboard prerequisite:** If the email page says “Set up custom SMTP to edit templates,” the Source editor is locked. Configure an email provider first; the HTML below cannot be pasted into the preview. Click **Set up SMTP** on that page.

For the planned Resend integration, create a Resend account, verify a domain you control using its supplied DNS records, and create a sending API key. Supabase's sender email must use that verified domain. Enter host `smtp.resend.com`, port `465`, username `resend`, and the Resend API key as the SMTP password. Save, return to the email template, select **Source**, and edit its HTML. Do not use your Supabase publishable key or account password as the SMTP password. See [Resend's Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp).

If you do not own a domain, pause this provider setup and choose a development email arrangement first; do not invent a sender domain. The current NORVI implementation requires these custom links. Supabase's default templates are not a drop-in replacement for this implementation.

This integration uses an explicit confirmation page and POST request. Default links that return browser access-token fragments are not supported. Customize the Supabase templates with these links:

**Confirm signup**

```html
<h2>Confirm your NORVI account</h2>
<p><a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a></p>
```

**Reset password**

```html
<h2>Reset your NORVI password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&amp;type=recovery">Choose a new password</a></p>
```

The fragment keeps token material out of normal HTTP request URLs. The page clears it from the address bar and waits for a deliberate submit, avoiding automatic consumption by simple email-link scanners. If the page is reloaded after the fragment is cleared, reopen the original email link or request a fresh one. These are one-time provider tokens, never activation keys.

See [Supabase email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates) for template variables and email delivery behavior.

## 5. Configure the local application

The **API Keys** page contains the publishable key. To find the project URL, open the project's **Connect** dialog and select the application/framework connection instructions, or follow **Data API** in the Settings sidebar and look for Project URL. Use the HTTPS API base URL, not a `postgresql://` database connection string or the Supabase dashboard URL.

Copy `.env.example` to `.env.local` without replacing an existing configuration. Fill:

```dotenv
NORVI_MODE=supabase
APP_ORIGIN=http://127.0.0.1:4321
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_LEGACY_ANON_KEY
```

The variable name accepts a publishable key or a legacy anon key. **Do not use a service-role/secret key.** This phase deliberately uses the signed-in customer's JWT and database policies. Keep `.env.local` private; it is ignored by Git.

Restart `npm run dev` after changing environment variables. The login page should now offer real registration. Missing/invalid configuration in Supabase mode shows an unavailable state; it never falls back to synthetic authentication. Set `NORVI_MODE=preview` and restart to return to sample accounts.

## 6. Register and provision the owner

Register through NORVI and confirm the email. Ordinary registration can only create a customer profile, never a staff role. Copy your confirmed user UUID from Supabase Authentication and double-check it belongs to you.

Run the following only in your project SQL editor after replacing the UUID. This is deliberate database-owner provisioning, not a public endpoint:

```sql
begin;
insert into public.staff_memberships(user_id,role)
select id,'owner' from auth.users
where id='YOUR_CONFIRMED_USER_UUID'::uuid and email_confirmed_at is not null;
insert into private.audit_log(actor_id,action,target_id,reason)
select user_id,'owner.provisioned',user_id::text,'Initial owner provisioning by project administrator'
from public.staff_memberships where user_id='YOUR_CONFIRMED_USER_UUID'::uuid and role='owner';
commit;
```

Check that exactly one membership was inserted. Never automatically make the first person who registers an owner.

Sign in at `/admin/login`, follow **Account security**, add the displayed setup key to your authenticator app as a time-based entry, and verify its six-digit code. Admin account and customer-directory access require MFA on both the server and the database. Store authenticator recovery material securely; this phase has no self-service factor removal/recovery bypass.

Staff invitations and acceptance are a later phase. Individual staff memberships and role enforcement are implemented; no shared admin password exists.

## 7. Acceptance checklist on the real development project

- Register two different test identities and confirm both email links.
- Check profile provisioning and persistent display-name updates.
- Sign out, sign in, and check session refresh after token expiry.
- Confirm one account cannot read or update the other account's records using direct Data API requests.
- Test expired/reused verification and recovery links and password reset.
- Test MFA enrollment, incorrect codes, new-browser challenges, and expired sessions.
- Confirm a nonstaff account cannot open the customer directory, even with MFA.
- Confirm the owner sees customers who have not purchased anything.
- Suspend a profile or deactivate a staff membership and confirm existing sessions lose protected access.
- Check that real mode has no sample sign-in, simulated checkout, or sample commerce records.

Password reset revokes refresh sessions globally. Existing access tokens may remain valid until provider expiry; choose and verify the provider session policy before launch. Losing MFA requires an identity-verified operator recovery procedure.

## Production setup is separate

The Cloudflare Worker always uses the real account integration and never imports preview sessions. Configure its actual HTTPS `APP_ORIGIN`, provider URL, and publishable key separately from local files. The prepared `AUTH_RATE_LIMITER` binding allows 20 auth mutation attempts per minute per IP at each edge location; confirm namespace `92701` is unused by another account deployment. This is a burst guard, not a globally exact limit; retain provider-side protection. [Cloudflare rate-limit documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

HTTPS auth mutations fail closed without that binding. Before launch, configure production email/domain settings and repeat acceptance testing. No deployment is performed by these instructions or by `npm run check:worker` (a dry build).

## Current boundaries

Phase 2 implements accounts, HttpOnly cookie sessions, verification/recovery, profiles, staff identity checks, TOTP MFA, scoped account reads, support persistence, and a paginated staff customer directory. Real catalog administration, invitations, payments, signed agent leases, protected downloads, and purchase emails belong to later phases. The public catalog still comes from the approved build snapshot, not remote CMS writes.

Automated SQL checks use PGlite's PostgreSQL engine with a small Auth-schema fixture. They exercise migrations and policies but cannot prove hosted Supabase configuration, SMTP, browser session rotation, or provider MFA behavior. Those remain the real-project acceptance steps above.
