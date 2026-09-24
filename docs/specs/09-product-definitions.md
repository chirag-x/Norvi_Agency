# NORVI — Phase 1 Product Definitions

Updated September 23, 2026. Based on the founder's supplied overviews and Omnix website. Descriptions are not independent verification of the binaries. Rolvio is the working name accepted for implementation; domain/trademark clearance is pending.

| Product | Audience / task | Application status supplied by founder | NORVI sales state |
|---|---|---|---|
| Omnix | People wanting voice-first desktop task automation | In development | In development; checkout blocked |
| Voro | Interview preparation and permitted interview assistance | Reported completed | Preparing for launch; release verification pending |
| Rolvio | Job seekers organizing discovery, applications, and responses | Reported completed | Preparing for launch; release verification pending |

## Omnix

**Speak your next task into action.** Voice-first instructions, task planning, and computer interaction are the described direction. The website does not promise a finished release or list unverified operating-system support.

Source: [Omnix product website](https://omnix-website.netlify.app/).

## Voro

**Bring context to your interview preparation.** Screen/audio context, résumé and conversation memory, coding assistance, and local/cloud AI options come from the supplied `Voro.md`.

The documented capture-exclusion implementation is Windows-oriented. Actual compatibility, audio behavior, supported models, hardware requirements, and overlay behavior require release testing. NORVI does not claim universal invisibility, guaranteed answers, guaranteed interview success, or zero-cost cloud usage. Customers must understand when screen/audio data leaves their device and when assistance is permitted.

## Rolvio

**Your next role, with less routine.** The supplied job-agent overview describes job discovery, résumé-fit scoring, browser-based applications, duplicate detection, email response tracking, and a Kanban dashboard.

LinkedIn, Indeed, Internshala, Wellfound, and Naukri are described integration targets, not yet verified support commitments. Before release, confirm each supported workflow, user authorization for submissions, pause/manual handoff behavior, accuracy of application information, and relevant platform restrictions. Do not promise interviews or employment outcomes.

## Decisions still open — deliberately not invented

| Decision | Omnix | Voro | Rolvio |
|---|---|---|---|
| Price and currency | price_Omnix | price_Voro | price_Rolvio |
| Billing model | billing_Omnix | billing_Voro | billing_Rolvio |
| AI usage / provider keys / included allowance | usage_Omnix | usage_Voro | usage_Rolvio |
| Supported OS and minimum hardware | requirements_Omnix | requirements_Voro | requirements_Rolvio |
| Installer, version, checksum | release_Omnix | release_Voro | release_Rolvio |
| License duration and device allowance | license_Omnix | license_Voro | license_Rolvio |
| Updates and support coverage | support_Omnix | support_Voro | support_Rolvio |
| Product demo and installation guide | demo_Omnix | demo_Voro | demo_Rolvio |

One active device remains a proposed policy, not an approved commercial term. No prices are active in the database. The phase-1 deliverable is accurate product positioning, public catalog content, and availability rules; commercial definitions cannot be finalized until these decisions and release checks are completed.

## Implementation details

Public URLs are `/agents/omnix`, `/agents/voro`, and `/agents/rolvio`. Stable preview IDs remain `agent-1`, `agent-2`, and `agent-3` to preserve existing sample records. The previous preview store was backed up locally before replacing the three placeholder products. User-added products were retained.

Publication status (draft/published/archived) is separate from release status (development/prelaunch). The preview editor exposes both. The server rejects sample purchases for development products, even if someone bypasses the disabled page control. Real purchasing remains disabled for all products until the payment phase.
