# Orders, Products & Activity Enhancements Specification

## 1. Orders Tab (`/admin/orders`)

### Objectives
- Give agency staff complete visibility into purchase transactions without manually cross-referencing customer accounts or Razorpay dashboard.

### Implementation Details
1. **Migration 067 (`public.admin_list_orders`):**
   - Left-joins `public.licenses` on `l.order_id = o.id`.
   - Returns:
     - `orderId`: `#` with 8-character prefix and copyable full UUID.
     - `customer`: Customer display name.
     - `email`: Registered auth user email address.
     - `product`: Agent display name.
     - `productSlug`: URL slug linking to `/agents/[slug]`.
     - `providerPaymentId`: Razorpay payment identifier (`pay_...`).
     - `amount`: Formatted INR amount (`INR 499.00`).
     - `licenseSuffix`: 4-character key suffix (`••••-ABCD`).
     - `status`: Paid, pending, or refunded.
     - `createdAt`: ISO 8601 timestamp formatted for human readability.

2. **UI (`AdminOrderTable` in `Workspace.tsx`):**
   - Embedded copy buttons for full order IDs, customer emails, and payment IDs.
   - Clickable key suffix badge navigating directly to `/admin/licenses`.
   - Status filtering dropdown: `All records`, `Paid`, `Pending`, `Refunded`.
   - Real-time search query matching across customer names, emails, order references, products, and payment IDs.
   - Summary stat grid displaying total order count and total paid revenue volume.
   - Enhanced CSV export containing full transaction metadata.

---

## 2. Products Tab (`/admin/products`)

### Objectives
- Streamline catalog operations by enabling one-click status transitions and direct access to live store listings.

### Implementation Details
1. **Quick Status Selector:**
   - Dedicated `<select>` dropdown added next to the product heading on each agent card.
   - Options: `Published`, `Draft`, `Archived`.
   - Triggers `POST /api/admin/products/:id/status` which updates `public.products.status` and increments revision.
   - Automatically refreshes catalog state without requiring opening the full "Edit Content & SEO" modal.

2. **Live Page Preview:**
   - Added `[ View Page ↗ ]` button linking directly to `/agents/${p.slug}` with `target="_blank"`.

---

## 3. Activity Logs (`/admin/activity`)

### Objectives
- Enable administrative staff and owners to search through operational audit logs quickly during troubleshooting or security reviews.

### Implementation Details
- Integrated `/admin/activity` with the top catalog search toolbar.
- Instant search filter evaluates action types (`DELETE customer`, `POST impersonate`, `Ban device`, `Gift license`) and actor emails.
