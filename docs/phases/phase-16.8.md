# Phase 16.8 - Dynamic Social Media Integration & Database Safety Fixes

## Overview
This phase introduced dynamic, customizable social media links (Instagram, YouTube, Facebook, X/Twitter) that can be managed directly from the Admin Panel, replacing hardcoded links. Additionally, it resolves a strict Postgres `safeupdate` validation error triggered during `site_settings` modifications.

## Database Migrations
1. **`053_social_links.sql`**: 
   - Extended `public.site_settings` with 4 new columns: `social_instagram`, `social_youtube`, `social_facebook`, and `social_twitter`.
   - Updated `get_site_settings()` and `admin_update_settings()` to safely query and upsert these values.
2. **`054_fix_update_where.sql`**:
   - Fixed a strict database safety violation (`UPDATE requires a WHERE clause`).
   - Specifically patched the logic resetting product sale states: changed `UPDATE public.products SET is_on_sale = false;` to `UPDATE public.products SET is_on_sale = false WHERE is_on_sale = true;`.

## Backend (`apps/api/live.ts`)
- Updated `GET /api/catalog` to select the 4 new social media columns and map them to the public `settings` object.
- Modified `PATCH /api/admin/settings` to explicitly accept the new parameters and forward them to the `admin_update_settings` RPC.

## Frontend UI (`apps/web/src/ui`)
- **`Workspace.tsx`**: Injected a new `<SocialMediaForm />` component directly onto the root dashboard overview (`section === ''`).
  - Configured to use the `PATCH` HTTP method and to spread existing `settings` in the payload, preventing partial updates from throwing `Missing Parameter` SQL errors.
- **`App.tsx` (Home)**: Injected `lucide-react` icons (Instagram, Youtube, Facebook, Twitter) directly under the "Your account. Your agents. Your access." hero section. They render conditionally.
- **`PublicPages.tsx` (Contact)**: Mirrored the same conditional icon block inside the "Let's talk" section underneath the support hours text.

## Models (`packages/shared/model.ts`)
- Expanded the `Settings` type interface with optional `socialInstagram`, `socialYoutube`, `socialFacebook`, and `socialTwitter` string properties.
