# NORVI: Netlify deployment and email setup

The repository now supports Netlify Functions. Local tests do not deploy it or configure your accounts. Deploy the new source before expecting the hosted API to work.

## 1. Configure Netlify

Use the existing NORVI Netlify project and connect its Git repository if necessary. Push the updated source to the branch Netlify builds. Do not upload only `dist`: the API function must be built too.

The root `netlify.toml` selects `npm run build`, publish directory `dist`, functions directory `netlify/functions`, and Node 22.16.0. Leave the base directory at the repository root containing package.json. Do not add an SPA catch-all redirect; Astro already generates the pages.

Under Project configuration → Environment variables, add the following for Production, including Functions scope if scope selection is available:

| Name | Value |
| --- | --- |
| APP_ORIGIN | https://norvi-agency.netlify.app |
| SUPABASE_URL | Your existing HTTPS project URL from .env.local |
| SUPABASE_ANON_KEY | Your existing complete sb_publishable_ key from .env.local |

Do not add a trailing slash to APP_ORIGIN. Do not substitute the dashboard URL, database connection string, or Supabase secret/service-role key. Local `.env.local` is not deployed; keep its localhost APP_ORIGIN for local development. NORVI_MODE is not needed on Netlify: the function always uses real accounts. Resend credentials belong in Supabase SMTP settings, not in these variables.

Deploy after saving the variables and pushing the code. Open the deploy log and confirm function `api` was bundled. In post-processing, confirm the rate-limit rule was accepted. Netlify may publish a deploy even when a rate-limit rule is invalid, so do not skip that check.

One native rule covers all `/api/*` requests: 20 requests per 60 seconds per IP and domain, including reads. This conservative initial limit is shared by people behind the same IP. Netlify enforcement can lag by up to 10 seconds; retain Supabase's own provider rate limits. No in-memory serverless counter is used. Platform enforcement must be checked on the actual deployment; local tests cannot prove it.

Sources: [Functions configuration](https://docs.netlify.com/build/functions/configuration/), [rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/), [function environment variables](https://docs.netlify.com/build/functions/environment-variables/).

## 2. Verify the deployed API

Open https://norvi-agency.netlify.app/api/health. Expected JSON:

```json
{"mode":"supabase","livePayments":false}
```

Open https://norvi-agency.netlify.app/api/auth/config. Expected JSON:

```json
{"mode":"supabase","preview":false,"registration":true}
```

These endpoints confirm configuration, not successful provider/email operations. A 404/HTML page means the function or routing was not deployed. `unconfigured` means runtime variables are missing or invalid. A 429 means wait at least a minute. A 403 during login commonly means APP_ORIGIN differs from the browser's origin: use the canonical URL, not a deploy-preview URL. Check function logs for other failures without sharing credentials or tokens.

## 3. Fix the Resend domain screen

The field takes a bare domain you own, such as `example.com`, without `https://` or a trailing slash. This is an example, not an available NORVI domain.

The free `norvi-agency.netlify.app` website address does not give you the DNS control needed for email verification. Removing its URL prefix does not solve that. Use a domain you own and can manage, or acquire one if you choose. You can keep the website at its current Netlify address while using the owned domain for email.

After adding the owned domain in Resend:

1. Copy the exact sending DNS records Resend displays.
2. Open the DNS management panel for that domain. If its nameservers point elsewhere, use that DNS provider.
3. Add each record with the type, name, value, and priority (when supplied) shown by Resend. Preserve unrelated website and existing mailbox records. Do not add receiving records unless you intend to configure receiving.
4. Return to Resend, click verification, and wait for Verified status.
5. Create a sending API key authorized for the verified domain. Keep it private.

Without a domain, you can deploy and check the API now, but this production email setup remains unfinished. The current account flow requires custom templates; do not disable confirmation to bypass setup.

[Resend domain documentation](https://resend.com/docs/dashboard/domains/introduction).

## 4. Configure Supabase email delivery

Open Authentication → Emails → SMTP settings, enable custom SMTP, and enter:

| Field | Value |
| --- | --- |
| Sender name | NORVI |
| Sender email | An address on your verified sending domain |
| Host | smtp.resend.com |
| Port | 465 |
| Username | resend |
| Password | Your Resend sending API key |

Save. Keep click tracking disabled for authentication links. [Resend's SMTP instructions](https://resend.com/docs/send-with-supabase-smtp).

Under Authentication → URL Configuration, set Site URL to `https://norvi-agency.netlify.app`. Our templates use this setting, so new emails will point at the hosted site rather than localhost.

Under Authentication → Emails, open Confirm signup, select Source, and replace its body with:

```html
<h2>Confirm your NORVI account</h2>
<p><a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a></p>
```

Save. Open Reset password and replace its body with:

```html
<h2>Reset your NORVI password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&amp;type=recovery">Choose a new password</a></p>
```

Save. Under Sign In / Providers → Email, keep email sign-in and confirmation enabled; set the minimum password length to 12 if exposed there. Enable authenticator-app/TOTP MFA in Authentication → Multi-Factor. A locked template editor means SMTP setup still needs completion.

## 5. Test accounts and provision the owner

1. Register your own email at the hosted `/register` page.
2. Follow the received confirmation link and explicitly confirm on the page.
3. Sign in, update your profile, reload, sign out, and sign back in.
4. Test Reset password and sign in with the new password.
5. Follow section 6 of [SUPABASE-SETUP.md](SUPABASE-SETUP.md) to provision your confirmed user UUID as owner. Run that SQL once after replacing both UUID placeholders; verify your membership exists.
6. Sign in at `/admin/login`, open Account security, enroll an authenticator app, and verify a code.
7. Check the customer directory as owner; confirm a separate ordinary customer cannot access it.
8. Complete the real-provider acceptance checklist in SUPABASE-SETUP.md, including session refresh, isolation, recovery and suspended accounts, before inviting customers.

## Remaining launch work

Payments are intentionally disabled. Real product administration, staff invitations, payment webhooks, license issuance/revocation, agent-side validation, protected downloads and purchase emails remain later work. The Resend SMTP setup above covers authentication email only.

The older Cloudflare Worker entry point remains an alternative; it is not used by Netlify. Use this guide for hosting and SUPABASE-SETUP.md for database/owner provisioning. No new database migration is needed for this Netlify adapter.
