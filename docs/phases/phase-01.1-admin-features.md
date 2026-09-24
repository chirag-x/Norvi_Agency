# Phase 01: Admin Panel & Storefront Updates

This phase involved expanding the Admin panel to support dynamic categories, file uploads, and richer storefront customization, addressing feature requests for better storefront presentation.

## Changes Made

### 1. Database Schema & API
- **Categories Table:** Created a new `public.categories` table to manage dynamic agent categories.
- **Storage Bucket:** Created a `product-assets` storage bucket for logo and workflow media uploads, with public read access and RLS policies for admin uploads.
- **Product Enhancements:** Added `category_id`, `logo_url`, `workflow_heading`, `workflow_description`, `workflow_media_url`, and `workflow_note` columns to `public.products`.
- **API Endpoints:** 
  - Added `GET /api/admin/categories`, `POST /api/admin/categories`, and `DELETE /api/admin/categories/:id` in `apps/api/live.ts`.
  - Added a `POST /api/admin/upload` endpoint to proxy multipart form-data to Supabase Storage, preserving the admin auth context.
- **RPC Updates:** 
  - Updated `admin_list_products` to return both `items` (products joined with category info) and `categories`.
  - Updated `admin_upsert_product` to accept the new fields.

### 2. Admin UI
- **File Upload Support:** Implemented `uploadFile` helper in `ui/common.tsx` that sends `FormData` to the new upload endpoint and returns the public URL.
- **Categories Management:** Added a `CategoriesAdmin` component in `ui/Workspace.tsx` and injected it into the Live Admin workspace navigation.
- **Enhanced Product Form:** Refactored `ProductForm` to include:
  - Custom file upload fields for the Agent Logo.
  - Dropdown selector for the dynamic Category.
  - An expanded "Built for your workflow" section, allowing admins to set a custom heading, description, footnote, and upload a walkthrough video or image.
  - "Live" added as a publication status option.

### 3. Storefront UI
- **Product Cards & Icons:** Updated `ProductCard` and `ProductIcon` to prefer the custom `logoUrl` (rendering an `img` tag) and fall back to the default Lucide icons if not present. Rendered `product.category.name` dynamically.
- **Walkthrough Rendering:** Updated the `Detail` component to display the dynamic `workflowHeading`, `workflowDescription`, `workflowNote`, and render a `<video>` or `<img>` element depending on the `workflowMediaUrl` extension.
- **Live Downloads:** The "View availability" button now correctly says "Download now" for products with the `live` release status.

## Required Tests
To ensure these features work correctly on your local host, follow these steps:

1. **Apply Migrations:** Since you are testing locally, ensure you have run the `009_admin_features.sql` migration in your local Supabase database or run `supabase db push` if you use the CLI.
2. **Test Categories:** Go to the "Categories" tab in the Admin panel. Try adding a new category (e.g., "Customer Service") and verify it appears.
3. **Test File Uploads:** Go to "Products & releases", edit an agent, and try uploading an image for the Logo. Save the agent.
4. **Test Walkthrough Media:** While editing the agent, scroll down to the "Built for your workflow" section. Enter a custom heading and description, and upload a small video (mp4) or image. Save and verify.
5. **Test Storefront Presentation:** Log out of the admin panel (or open an incognito window) and navigate to the agent's public page. Ensure the custom logo, workflow text, and media appear correctly. If you set the agent to "Live", verify the call-to-action button says "Download now".

## Files Updated
- `supabase/migrations/009_admin_features.sql`
- `packages/shared/model.ts`
- `apps/api/live.ts`
- `apps/web/src/ui/common.tsx`
- `apps/web/src/ui/Workspace.tsx`
- `apps/web/src/ui/Accounts.tsx`
- `apps/web/src/ui/App.tsx`
- `apps/web/src/ui/PublicPages.tsx`
