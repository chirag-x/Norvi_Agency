# Phase 7: Live Admin Dashboard Integration

## Overview
Currently, the Admin Dashboard only fully functions in the "Local Synthetic Preview" mode. When connected to a live Supabase database, most tabs (Products, Licenses, Orders, Settings, etc.) display a placeholder message. This phase wires the entire React Admin UI directly to the live Supabase database and Edge API.

Because this touches almost every administrative function of the business, we are splitting this phase into two safe, manageable parts.

## Part 1: The Storefront Manager (Products, Content, Settings) - COMPLETE
**Goal:** Allow the Owner and Product Managers to edit the public-facing website directly from the live dashboard.
1. **Backend API:** Built the secure endpoints in `live.ts` for `/api/admin/products`, `/api/admin/content`, and `/api/admin/settings`.
2. **Database RPCs:** Created `008_live_admin_storefront.sql` which upgrades the `public.products` table, creates a `site_settings` table, and defines secure Postgres functions to list/upsert products and settings.
3. **Frontend UI:** Updated the `LiveAdmin` component in `Accounts.tsx` to render the `ProductForm` and `SettingsForm` directly reading/writing to Supabase.

## Part 2: Business Operations (Licenses, Orders, Audit Logs)
**Goal:** Allow the Owner and Support Staff to manage customer purchases and track staff activity.
1. **Backend API:** Build endpoints for `/api/admin/orders`, `/api/admin/licenses`, and `/api/admin/activity`.
2. **Key Management:** Implement the highly sensitive POST routes to `revoke`, `restore`, and `rotate` activation keys securely.
3. **Frontend UI:** Update the `LiveAdmin` component to render the License management tables, Order history, and Audit log timeline.
