# NORVI Documentation Index

Welcome to the NORVI documentation directory. This file serves as the master index to help you locate any information you need about the project. The documents have been organized into specific folders based on their purpose.

---

## 📂 `phases/`
Contains the strict, step-by-step roadmap for upgrading and completing the NORVI platform. This is the **active working directory** for development.
- **`phase-00.md`** through **`phase-01.md`**: Completed phases (Security Patch & Foundation).
- **`phase-02.md`** through **`phase-20.md`**: Pending future phases detailing exactly what needs to be built next (Auth, Commerce, OTA Updates, Enterprise Teams, etc.). Keep these updated as work is completed.

---

## 📂 `specs/`
Contains the original foundational architecture and design documents for NORVI.
- **`01-architecture.md`**: Overall tech stack, routing, and directory structure.
- **`02-pages-and-sections.md`**: Detailed breakdown of every frontend page and its UI elements.
- **`03-database-and-licensing.md`**: Supabase table schemas, relationships, and license key logic.
- **`04-payments-and-email.md`**: Razorpay webhook flows and Resend email templates.
- **`05-security-and-costs.md`**: Threat models, RLS policies, and infrastructure cost estimates.
- **`06-files-and-delivery-plan.md`**: The strategy for delivering secure software downloads to customers.
- **`07-upgrade-two-admin-and-team.md`**: Specifications for the Admin Dashboard and Staff RBAC.
- **`09-product-definitions.md`**: Definitions of the three core products (Omnix, Voro, Rolvio).
- **`AGENCY-BUSINESS-BRIEF.md`**: The massive, original business brief outlining the entire vision, branding, and goals of NORVI.

---

## 📂 `guides/`
Contains setup instructions, deployment guides, and cheat sheets for managing the project.
- **`START-NORVI.md`**: Quickstart guide for booting up the project locally.
- **`SUPABASE-SETUP.md`**: Step-by-step guide on how to configure the Supabase database.
- **`NETLIFY-SETUP.md`**: Step-by-step guide on deploying the frontend and backend to Netlify.
- **`database-cheat-sheet.md`**: Useful SQL queries and Supabase CLI commands for quick reference.
- **`.env.example`**: The required environment variables for the project.

---

## 📂 `archive/`
Contains legacy planning files, old to-do lists, and superseded phase documents. These are kept for historical reference but are no longer actively updated (use the `phases/` folder instead).
- **`15-comprehensive-repair-and-upgrade-plan.md`**, **`14-future-phases.md`**: The raw lists that were converted into the `phases/` folder.
- **`08-implementation-status.md`**, **`developing-current.md`**, **`leftover.md`**, etc.: Old tracking files from the initial MVP build.
