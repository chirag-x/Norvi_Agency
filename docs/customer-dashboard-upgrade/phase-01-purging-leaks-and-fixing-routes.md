# Phase 1: Purging Developer Leaks & Fixing Broken Routes

**Target Files:**
- `apps/web/src/ui/Workspace.tsx`
- `apps/web/src/ui/Accounts.tsx`
- `apps/web/src/ui/App.tsx`
- `apps/web/src/ui/common.tsx`
- `apps/web/src/ui/PublicPages.tsx`
- `apps/api/live.ts`
- `packages/shared/catalog.json`
- Supabase SQL Migration (Category Name Cleanup)

---

## 1. Developer Terminology & Preview Copy to Purge

| Location | Current Leaked Copy | Replacement Professional Copy |
|---|---|---|
| `Workspace.tsx:266` | `hint="Email changes are not supported in this phase."` | `hint="Email address is tied to your account security. Contact support to request an update."` |
| `Workspace.tsx:51` | `p>{identity.preview ? '...' : 'Verified account. Sales are not open yet.'}</p>` | `p>{identity.preview ? 'Sample data. No live payments or emails.' : 'Verified account. Active customer workspace.'}</p>` |
| `Workspace.tsx:265` | `hint ?? 'Local preview data'` | Set `hint` default to `undefined` or display contextual info (e.g., `"Active keys"`, `"1 of 3 active"`). |
| `Workspace.tsx:87` | `<Notice>All orders here are simulations. No money has been charged and no recurring billing agreement exists.</Notice>` | Remove for live accounts. Only show in preview mode (`identity?.preview`). |
| `Workspace.tsx:87` | `<p>No live subscriptions. Real renewal and cancellation controls require the payment integration.</p>` | Display clean subscription status: `<p>Active license subscriptions and renewal controls are managed directly under your product license cards.</p>` |
| `Workspace.tsx:91` | `<Notice>This key is synthetic and works only against the local preview API. Keep real activation keys private...</Notice>` | `<Notice>Keep your activation key confidential. Enter it into your desktop agent to unlock your license.</Notice>` |
| `Workspace.tsx:3095` | `YOUR SAMPLE ORDER IS READY... Your preview license has been created. No payment was taken and no email was sent... Amount charged: ₹0 · Preview` | Display verified order confirmation: `YOUR ORDER IS CONFIRMED... Your license key has been generated and dispatched to your account.` |
| `Workspace.tsx:60` | `description="Explore the agents and simulate your first purchase to see licenses and orders appear here."` | `description="Explore our collection of AI agents and activate your first workflow."` |
| `Workspace.tsx:62` | `description="Your product-specific keys will appear here after purchases become available."` | `description="Your activation keys will appear here immediately after purchasing an agent."` |
| `App.tsx:279` | `Prices and included usage are currently placeholders.` | `"All licenses include unlimited local AI execution. Any optional high-speed cloud AI tokens are transparently listed on the product page."` |
| `Accounts.tsx:52` | `<p>Use your own email address. Purchases are not enabled yet.</p>` | `<p>Sign in to access your agents, download software, and manage activation keys.</p>` |
| `live.ts:1324` | `throw new Error("Asset not found. Make sure you uploaded a .zip or .exe file containing '${slug}' in the name.");` | `throw new Error("Installer package is currently being prepared for your platform. Please reach out to support at norviagency@gmail.com for instant delivery.");` |
| `common.tsx:3` | `throw Error('The website service is unavailable. Start the local preview server and try again.');` | `throw Error('Service temporarily unavailable. Please check your internet connection and try again.');` |

---

## 2. Broken Routes & Glitch Fixes

1. **Restore `/delivery` Shipping & Delivery Policy:**
   - In `apps/web/src/ui/App.tsx` (Line 243):
     ```tsx
     // Before:
     else if(['/privacy','/terms','/refunds','/license'].includes(path)) content=<Legal kind={path.slice(1)}/>;
     // After:
     else if(['/privacy','/terms','/refunds','/license','/delivery'].includes(path)) content=<Legal kind={path.slice(1)}/>;
     ```

2. **Fix Broken Partner Link on `/partners`:**
   - In `apps/web/src/ui/PublicPages.tsx` (Line 454):
     ```tsx
     // Before:
     <a href="/account/affiliates" className="text-button" ...>Go to Partner Dashboard <ArrowRight size={16}/></a>
     // After:
     <a href="/account/partner" className="text-button" ...>Go to Partner Dashboard <ArrowRight size={16}/></a>
     ```

3. **Fix Broken Em-Dashes in Public Pages:**
   - In `apps/web/src/ui/PublicPages.tsx` (Line 11):
     `description="— collection of tools..."` -> `description="A collection of tools for a little less routine and a lot more possibility."`
   - In `apps/web/src/ui/PublicPages.tsx` (Line 460):
     `eyebrow="THE IDE— BEHIND NORVI"` -> `eyebrow="THE IDEA BEHIND NORVI"`
     `<h2>Useful tools.<br/>— human purpose.</h2>` -> `<h2>Useful tools.<br/>A human purpose.</h2>`

4. **Fix Catalog Announcement & Testing Notes:**
   - In `packages/shared/catalog.json` & Supabase DB:
     - Rename Category `944ab0ea-e72b-49dd-9886-6816094c48de` from `"Launching On 25 October .  You Can Get Voro Now !"` to `"Career & Job Search"`.
     - Update Rolvio `workflowNote` from `"Testing"` to:
       `"Native Windows desktop background worker. Includes intelligent ATS resume parsing and auto-fill engine."`
     - Fix typo in Voro comparison table: `"Unlimite"` -> `"Unlimited"`.
     - Clean Rolvio tagline: `"Autonomous AI Job Hunter that applies to verified jobs and tracks interview invites via email."`

---

## 3. Verification Steps for Phase 1 (COMPLETED)

1. [x] Run TypeScript check: `npm run check` (`tsc --noEmit`) - **PASSED (0 errors)**.
2. [x] Run full test suite: `npm test` - **PASSED (All 29 test files, 224 tests passing)**.
3. [x] Run Astro static build: `npm run build` - **PASSED (All 44 static routes built cleanly in 1.20s)**.
4. [x] Verify `/delivery` loads Shipping & Delivery Policy without 404 (Route generated at `/delivery/index.html`).
5. [x] Verify `/account` profile hint shows professional security copy without the word "phase".
6. [x] Verify `/account/billing` shows no simulation warnings.
7. [x] Verify Supabase category name updated to `Job Search & Career Automation` and synced to `packages/shared/catalog.json`.
8. [x] Verified Rolvio tagline & workflowNote, and Voro comparison table updated.
