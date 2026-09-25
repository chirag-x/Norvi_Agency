# Phase 7 - Omniscient Dual Logging System

**Status:** Pending (Slated after Phase 6)

## Overview
A high-availability, dual-logging architecture that captures *every single action* taken on the platform. All actions will be logged twice: once permanently in the Supabase `private.audit_log` table (for UI search/history), and once broadcasted to Discord (for real-time notifications on the phone).

## Action Catalog (What we are tracking)
Every single one of these actions will be tracked with the **Actor** (who did it), the **Action** (what happened), and the **Target** (who/what it affected).

1. **Authentication & Security**
   - User Registered / Logged In
   - Password Reset Requested
   - 2FA Enabled / Disabled
   - Account Deleted

2. **Commerce & Licenses**
   - Order Placed (Simulated or Real)
   - License Key Issued
   - License Key Rotated (Manually or via UI)
   - License Suspended / Restored
   - Manual Key Gifted (by Admin)
   - Hardware Device Registered / Released

3. **Team & Staff Management**
   - Staff Invitation Sent / Cancelled
   - Staff Role Changed (e.g. Support -> Admin)
   - Staff Suspended / Restored

4. **Product Management**
   - Product Created / Updated (Pricing/Details)
   - Product Published / Archived

5. **Customer Management**
   - Customer Suspended / Restored
   - Customer Impersonated ("Login As" used by Owner)

6. **System Actions**
   - System/Server Crash Logs (API 500 errors)
   - Maintenance Mode toggled
   - UI Settings / Content changed

## Technical Implementation Plan

**1. Supabase Audit Log Expansion**
- Enhance the `private.audit_log` table schema to ensure it captures `ip_address` and `metadata` (JSON block) for deeper inspection.
- Create an RPC function `broadcast_log(action, target, meta)` that inserts into Supabase AND hits the Edge Function.

**2. Hono API Logging Interceptors**
- Create a global Hono middleware in `live.ts` that catches all API requests. For mutating requests (POST, PATCH, DELETE), it automatically logs the actor and the route.
- Enhance the `fireLog` system to ensure it catches global uncaught exceptions and sends them to a dedicated Discord `#server-alerts` channel.

**3. Discord Webhook Channels**
- `#sales-and-orders` (Purchases, Key generation)
- `#team-and-security` (Role changes, Suspensions, Logins, 2FA)
- `#system-alerts` (Product changes, Server crashes, Maintenance Mode)

**4. Admin UI (Log Viewer)**
- Create the **Audit Logs** tab in the Admin UI.
- Allow searching logs by date, by actor (e.g. "Show me everything John did"), or by action type.
