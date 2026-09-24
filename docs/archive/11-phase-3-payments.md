# NORVI — Phase 3: Payments & Commerce Integration

This document outlines the detailed roadmap for Phase 3, which transitions the NORVI platform from a simulated checkout experience into a fully functional, real-world commerce application capable of securely accepting payments and provisioning software licenses.

## Overview of Phase 3

Currently, when a user buys an AI agent in NORVI, the system creates a fake "Simulated" order and generates a dummy license key. In Phase 3, we transition this simulation into a real-world commerce application using **Razorpay** to process UPI, Credit Cards, and Netbanking.

This phase is broken down into two main responsibilities: **Developer Tasks** (code we will write) and **Founder Tasks** (manual setup you must complete).

---

## 1. Developer Tasks (What we will code together)

Once you have chosen a payment provider and gathered your API keys, we will implement the following technical features:

### A. Frontend Checkout Integration
*   Remove the "Preview — no charge" simulated checkout logic.
*   Implement a secure API call that requests a unique "Checkout Session" from the payment provider.
*   Redirect the customer to the secure, hosted checkout page to enter their credit card details.

### B. Secure Webhook Listener (The Backend)
*   Create a new route in the Hono API (e.g., `POST /api/webhooks/payments`).
*   **Signature Verification:** Implement cryptographic raw-body signature checks to guarantee that incoming payment notifications are genuinely from your payment provider and not hackers.
*   **Idempotent Fulfillment:** Write logic that safely processes a payment success notification, ensuring that even if the network stutters, a customer is never accidentally charged twice or given two licenses.

### C. License Provisioning & Fulfillment (NOT DONE - PAUSED UNTIL LAUNCH)
*   **Status:** *Skipped for now.* We cannot write this code yet because it requires your official products and prices to be synced between Razorpay and the Supabase database.
*   **Future Action:** Once you have a live domain and create your real products in Razorpay, we will write the code to insert "Paid" order records into your database and securely generate license keys.

### D. Refunds & Cancellations (NOT DONE - PAUSED UNTIL LAUNCH)
*   **Status:** *Skipped for now.*
*   **Future Action:** Ensuring that if a refund is triggered in your payment dashboard, the webhook automatically revokes the customer's license key.

---

## 2. Founder Tasks (What you must do manually)

Because payments involve real money, bank accounts, and sensitive credentials, you must manually complete the following business setups before we can write the code:

### Step 1: Complete Razorpay KYC (Paused until launch)
You have chosen **Razorpay** as your payment provider to support UPI and Indian cards. 
*   **Important:** Razorpay compliance requires a live domain (not Netlify) and published Legal policies (Privacy, Terms, Refunds).
*   *Action:* We are actively pausing this step until the website is 100% complete and hosted on a real domain.

### Step 2: Create Your Products
Inside your Razorpay dashboard, you must manually create your three AI agents.
*   Create **Omnix**, **Voro**, and **Rolvio** as digital products or payment items.
*   Set their real prices (e.g., ₹999 one-time).

### Step 3: Gather API Keys
You will need to navigate to the "API Keys" section under "Account & Settings":
1.  **Key ID** 
2.  **Key Secret** 

### Step 4: Setup a Local Webhook Tunnel
To test payments locally on your computer, Razorpay needs a way to send notifications to `http://127.0.0.1:4322`. 
*   Because your local computer is hidden from the internet, you will use a secure tunnel (like Ngrok or localtunnel) to bridge Razorpay and your local NORVI backend.

### Step 5: Update Environment Variables
You will open your `.env.local` file and paste the API Keys and Price IDs into it.

---

## Ready to Begin?
Once you have completed Step 1 (choosing your provider) and Step 2 (setting your real prices), let me know. We will then move straight into the API key configuration and start writing the checkout code!
