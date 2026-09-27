# Phase 16 - Sales & Announcements Engine

**Status:** Completed

## Implementation Summary
The user pivoted away from the original "Workflow Template Marketplace" idea to build a dedicated e-commerce control center directly in the Admin Dashboard. The scrapped `/subscriptions` tab was replaced with a new `/promotions` control center.

### 1. Promotions Command Center (Admin UI)
- Repurposed the empty Subscriptions tab into a `PromotionsManager` UI.
- **Global Banner Editor:** Admins can type a live announcement that immediately renders across the top of all public-facing pages.
- **Flash Sale Engine:** A toggle to activate a global store-wide sale, an input for the discount percentage, and individual checkboxes to selectively apply the sale to specific AI agents.

### 2. Secure Discount Math
- `044_promotions_engine.sql` altered the database to store `banner_text`, `sale_active`, and `sale_percentage` in `site_settings`. It also added `is_on_sale` directly to the `products` table.
- Upgraded the `/api/checkout/create` RPC (`create_checkout_order`) to enforce discount stacking entirely server-side.
- The order of mathematical operations is strictly: **Base Price -> minus Flash Sale % -> minus Referral Code %.** The absolute final price is exactly what is requested from Razorpay.

### 3. Dynamic Public UI
- **Global Banner:** Added a dismiss-less banner beneath the header in `App.tsx` that appears when `bannerText` is populated.
- **Storefront Strikethroughs:** Modified the `Pricing` and `Detail` components to detect if a product is on sale. They mathematically parse the base price strings (e.g. `₹4,999`) and display the original price with a strikethrough, alongside a green discounted price.
- **Checkout Strikethroughs:** Modified the duration selection radio buttons to visually stack the flash sale and the referral code percentages, guaranteeing visual parity with the backend math.
