# Discord Audit Logging Guide

Norvi can route critical business and security events directly to different channels in your private Discord server. This gives you a real-time command center for your business.

## Recommended Channel Setup
We recommend creating three private channels in your Discord server that only you and your admins can see:
1. `#norvi-sales` (For new purchases and refunds)
2. `#norvi-downloads` (For tracking who downloads your agent files)
3. `#norvi-security` (For blocked piracy attempts, revoked licenses, or failed logins)

## How to Get a Discord Webhook URL
For each channel you created, you need to generate a unique Webhook URL:
1. Open Discord, hover over the channel name (e.g., `#norvi-downloads`), and click the **Gear Icon (Edit Channel)**.
2. Click **Integrations** on the left menu.
3. Click **Webhooks** -> **New Webhook**.
4. Give it a name (e.g., "Norvi Download Bot").
5. Click **Copy Webhook URL**.
6. Save your changes.

## Integrating with Norvi
Once you have the Webhook URLs for your channels, we will add them as Environment Variables in Netlify:

* `DISCORD_SALES_WEBHOOK`
* `DISCORD_DOWNLOADS_WEBHOOK`
* `DISCORD_SECURITY_WEBHOOK`

### Example: How the Download Log will look
Once the code is implemented, whenever a customer downloads an agent, the Norvi API will send an HTTP `POST` request to the `DISCORD_DOWNLOADS_WEBHOOK` URL with a formatted message:

> **[Agent Download]**
> **User:** chirag@example.com
> **Product:** Voro Agent
> **License ID:** 1234-5678...
> **Timestamp:** 2026-09-25 04:30 PM
> **Status:** Success

### Example: How the Security Log will look
If a user tries to download an agent but their license is expired, or if they try to activate a key that has been revoked:

> 🚨 **[Security Alert: Blocked Download]**
> **User:** pirate@example.com
> **Reason:** License is marked as revoked.
> **Product:** Voro Agent

## Next Steps
To implement this, you just need to:
1. Create the channels in Discord.
2. Generate the Webhook URLs.
3. Provide the URLs to the AI Assistant so they can be wired up in the code!
