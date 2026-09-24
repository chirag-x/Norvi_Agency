# Phase 6: Email Delivery & Staff Invitations

## Overview
Currently, the system is highly secure and capable of handling auth, licenses, and downloads. However, it cannot send custom transactional emails (like purchase receipts, support ticket replies, or staff invitations). In this phase, we will integrate the **Resend API** to handle all official communication from the platform.

## Part 1: The Email Outbox Engine
Because Edge Functions shouldn't be blocked by slow external APIs (like sending an email), we will build an asynchronous "Outbox" system.
1. Create a `private.outbox` table in Supabase.
2. When an important action happens (like a purchase or support request), the backend instantly writes an email job to the `outbox` table.
3. We will build a cron job or webhook listener that safely reads the `outbox`, securely sends the email via the Resend API, and marks it as `completed`. 
*(This guarantees that if the email server goes down, no emails are ever lost!)*

## Part 2: Staff Invitations
Right now, you are the only Owner, and adding staff requires raw SQL. We will activate the "Team" dashboard in the Admin UI so you can invite support agents or product managers securely.
1. When you invite a staff member in the UI, an invite is securely stored in `public.staff_memberships` with a `pending` status.
2. The Outbox Engine will send them a beautiful "You have been invited to Norvi" email.
3. Once they sign up, a secure database trigger will officially grant them their role.

## Part 3: Transactional Templates
We will build the actual HTML templates for:
*   **Purchase Receipts:** Emailed automatically after the Razorpay webhook fires.
*   **Support Replies:** Sent to customers when you respond to their help tickets.
*   **Welcome Emails:** Sent to users when they first register.

## Blockers & Prerequisites
*   You will need to verify your live domain (e.g. `norvi.com`) inside your Resend dashboard before Part 3 can go live, otherwise Resend will only let you send emails to yourself.
