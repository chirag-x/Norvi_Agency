# Leftover Tasks Tracker 2

This document tracks configuration tasks that still need to be completed before production launch.

## 1. Razorpay API Keys (Phase 3 Leftover)

Currently, the application is using mock checkout endpoints. To accept real payments via UPI, Credit Cards, etc., you must generate your live Razorpay keys and connect them.

### Step-by-Step Guide: How to get Razorpay API Keys

1. **Create an Account:** Go to [Razorpay.com](https://razorpay.com/) and create a business account.
2. **Complete KYC:** Fill out your business details and submit your KYC documents to activate your account for live payments.
3. **Switch to Live Mode:** In the top-left corner of the Razorpay Dashboard, toggle the switch from **Test Mode** to **Live Mode**.
4. **Navigate to Settings:** On the left sidebar, scroll down and click on **Settings** (or "API Keys" depending on the UI version).
5. **Generate Keys:** Click on the **API Keys** tab and click **Generate Key**.
6. **Copy Keys:** You will be shown a `Key Id` and a `Key Secret`. Keep this tab open.

### Where to paste the keys

You must place these keys securely in your **Netlify Environment Variables** (and your `.env.local` file for testing).

1. Go to your `e:\Agency\.env.local` file.
2. Find the Razorpay variables and replace them with your actual keys:
   ```env
   RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXX
   RAZORPAY_KEY_SECRET=YOUR_SECRET_XXXXXXXXXXXXXX
   ```
3. Once tested locally, go to your **Netlify Dashboard**.
4. Go to **Site Configuration** -> **Environment Variables**.
5. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with the same values.
6. Trigger a new deployment in Netlify.

---

*This file will be updated if we skip any other API integrations in future phases.*
