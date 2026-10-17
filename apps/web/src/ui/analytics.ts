/**
 * NORVI Agency — Meta Pixel Analytics Helper
 * Provides verified, deduplicated, privacy-safe, product-independent conversion tracking
 * with strict affirmative advertising consent.
 */

export const META_PIXEL_ID = '2298637780982908';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    _norvi_pixel_initialized?: boolean;
  }
}

export interface PurchaseEventParams {
  orderId: string;
  amount: number;
  currency: string;
  productName: string;
  productSlug: string;
  productId?: string;
  numItems?: number;
}

export interface ViewContentEventParams {
  productName: string;
  productSlug: string;
  productId?: string;
  price?: number;
  currency?: string;
}

export type AdvertisingConsentState = 'granted' | 'denied' | 'unset';

const TRACKED_PURCHASES_KEY_PREFIX = 'norvi_meta_purchase_tracked_';
const CONSENT_STORAGE_KEY = 'norvi_advertising_consent';
const inMemoryTrackedOrders = new Set<string>();

/**
 * Tracks the active product view key for the current navigation instance.
 * Format: `${productSlug}:${pathname}`
 * Prevents duplicate ViewContent events on component re-renders or React StrictMode,
 * while allowing legitimate repeat product views when navigating away and returning.
 */
let lastTrackedViewContentKey: string | null = null;

/**
 * Resets ViewContent tracking key (for testing or route resets).
 */
export function resetViewContentTrackingForTesting(): void {
  lastTrackedViewContentKey = null;
}

/**
 * Resets ViewContent tracking when navigating to a different pathname.
 */
export function resetViewContentTrackingForPathChange(newPath: string): void {
  if (!lastTrackedViewContentKey) return;
  const parts = lastTrackedViewContentKey.split(':');
  const trackedPath = parts[1];
  if (trackedPath && trackedPath !== newPath) {
    lastTrackedViewContentKey = null;
  }
}

/**
 * Extracts a dynamic numeric display price from a product and optional settings.
 * Handles sale percentages, multi-duration pricing, and non-numeric placeholders.
 * Returns undefined if no numeric price is available (e.g. "Pricing to be confirmed").
 */
export function getProductDisplayPrice(
  product: { price?: string; price1m?: string | number; price3m?: string | number; price_lifetime?: string | number; is_on_sale?: boolean; [key: string]: any } | null | undefined,
  settings?: { saleActive?: boolean; salePercentage?: number } | null
): number | undefined {
  if (!product) return undefined;

  let baseNum: number | undefined;

  // 1. Try extracting numeric digits from product.price string (e.g. "₹499/mo", "₹1,499", "₹12,499")
  if (product.price && typeof product.price === 'string') {
    const cleaned = product.price.replace(/,/g, '');
    const match = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed > 0) {
        baseNum = parsed;
      }
    }
  }

  // 2. Fallback to structured multi-duration tier prices: price1m -> price3m -> price_lifetime
  if (baseNum === undefined && product.price1m !== undefined && product.price1m !== null) {
    const parsed = parseFloat(String(product.price1m).replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      baseNum = parsed;
    }
  }
  if (baseNum === undefined && product.price3m !== undefined && product.price3m !== null) {
    const parsed = parseFloat(String(product.price3m).replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      baseNum = parsed;
    }
  }
  if (baseNum === undefined && product.price_lifetime !== undefined && product.price_lifetime !== null) {
    const parsed = parseFloat(String(product.price_lifetime).replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      baseNum = parsed;
    }
  }

  if (baseNum === undefined) return undefined;

  // 3. Apply active sitewide sale percentage if applicable
  if (settings?.saleActive && typeof settings.salePercentage === 'number' && settings.salePercentage > 0 && product.is_on_sale) {
    const discounted = Math.floor(baseNum * (1 - settings.salePercentage / 100));
    return discounted > 0 ? discounted : baseNum;
  }

  return baseNum;
}

/**
 * Retrieves the current advertising consent preference.
 * Returns 'unset' if the visitor has made no explicit choice yet.
 */
export function getAdvertisingConsentPreference(): AdvertisingConsentState {
  if (typeof window === 'undefined') return 'unset';
  try {
    const val = window.localStorage ? window.localStorage.getItem(CONSENT_STORAGE_KEY) : null;
    if (val === 'granted') return 'granted';
    if (val === 'denied' || val === 'false') return 'denied';
    return 'unset';
  } catch {
    return 'unset';
  }
}

/**
 * Checks whether user advertising consent has been affirmatively granted.
 * STRICT OPT-IN: Returns true ONLY if explicitly set to 'granted'.
 * Returns false if unset (null), denied, or unavailable.
 */
export function hasAdvertisingConsent(): boolean {
  return getAdvertisingConsentPreference() === 'granted';
}

/**
 * Dynamically initializes the Meta Pixel library if affirmative consent is granted.
 * Idempotent: ensures the script and init() are called only once per session.
 */
export function initMetaPixel(): boolean {
  if (typeof window === 'undefined') return false;
  if (!hasAdvertisingConsent()) return false;
  if (window._norvi_pixel_initialized) return true;

  try {
    if (!window.fbq) {
      const f: any = window;
      const b: any = document;
      const e = 'script';
      const v = 'https://connect.facebook.net/en_US/fbevents.js';
      
      const n: any = function() {
        if (n.callMethod) {
          n.callMethod.apply(n, arguments);
        } else {
          n.queue.push(arguments);
        }
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const t = b.createElement(e);
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      if (s && s.parentNode) {
        s.parentNode.insertBefore(t, s);
      } else if (b.head) {
        b.head.appendChild(t);
      }
      f.fbq = n;
    }

    if (typeof window.fbq === 'function') {
      window.fbq('init', META_PIXEL_ID);
      window._norvi_pixel_initialized = true;
      window.fbq('track', 'PageView');
      return true;
    }
  } catch (err) {
    console.error('[NORVI Analytics] Failed to initialize Meta Pixel:', err);
  }
  return false;
}

/**
 * Sets advertising consent flag (usable by Cookie Consent banner, settings, or tests).
 * When consent is affirmatively granted, immediately initializes the Pixel and tracks PageView.
 * When consent is revoked, immediately calls fbq('consent', 'revoke') to stop automatic tracking.
 */
export function setAdvertisingConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage) {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, granted ? 'granted' : 'denied');
    }
  } catch {
    // Ignore storage errors
  }

  if (granted) {
    if (typeof window.fbq === 'function') {
      try {
        window.fbq('consent', 'grant');
      } catch (e) {
        console.warn('[NORVI Analytics] Failed to grant fbq consent:', e);
      }
    }
    initMetaPixel();
  } else {
    // Revoke consent inside Meta Pixel if already loaded in memory
    if (typeof window.fbq === 'function') {
      try {
        window.fbq('consent', 'revoke');
      } catch (e) {
        console.warn('[NORVI Analytics] Failed to revoke fbq consent:', e);
      }
    }
    lastTrackedViewContentKey = null;
    console.info('[NORVI Analytics] Advertising consent revoked.');
  }

  try {
    window.dispatchEvent(new CustomEvent('norvi:consent-changed', { detail: { granted } }));
  } catch {}
}

/**
 * Tracks a PageView event on client navigation if advertising consent is granted.
 */
export function trackMetaPageView(): boolean {
  if (typeof window === 'undefined') return false;
  if (!hasAdvertisingConsent()) return false;

  const currentPath = window.location ? window.location.pathname : '';
  resetViewContentTrackingForPathChange(currentPath);

  if (typeof window.fbq === 'function') {
    try {
      window.fbq('track', 'PageView');
      return true;
    } catch (e) {
      console.error('[NORVI Analytics] PageView tracking failed:', e);
    }
  }
  return false;
}

/**
 * Tracks a standard ViewContent event when a user views a specific agent product page.
 *
 * Safeguards:
 * 1. Strict affirmative consent gate (requires prior opt-in).
 * 2. Strict product validation: rejects events with missing product name or slug.
 * 3. Lifecycle & navigation-aware deduplication: prevents duplicate events on component
 *    re-renders or StrictMode, while allowing repeat views when leaving and returning.
 * 4. Gracefully handles missing/blocked window.fbq without throwing.
 * 5. Uses dynamic product metadata (name, slug, currency, and numeric price where available).
 * 6. Non-blocking error handling that never interrupts UI or navigation.
 */
export function trackMetaViewContent(params: ViewContentEventParams): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    const { productName, productSlug, price, currency } = params;

    // Strict validation of product identity
    if (
      !productName ||
      typeof productName !== 'string' ||
      !productName.trim() ||
      !productSlug ||
      typeof productSlug !== 'string' ||
      !productSlug.trim()
    ) {
      console.warn('[NORVI Analytics] Missing or invalid product metadata for ViewContent. Event suppressed.', {
        productName,
        productSlug,
      });
      return false;
    }

    // Consent gate: do not track if affirmative consent is missing or withheld
    if (!hasAdvertisingConsent()) {
      return false;
    }

    // Navigation-aware duplicate suppression for the current product view instance
    const currentPath = window.location ? window.location.pathname : '';
    const currentKey = `${productSlug.trim()}:${currentPath}`;
    if (lastTrackedViewContentKey === currentKey) {
      // Already tracked for this page view instance
      return false;
    }

    // Check if Meta Pixel is loaded and available
    if (typeof window.fbq !== 'function') {
      console.warn('[NORVI Analytics] Meta Pixel (window.fbq) is unavailable or blocked by browser.');
      return false;
    }

    // Standard Meta ViewContent payload (100% product-agnostic and dynamic)
    const payload: Record<string, any> = {
      content_name: productName.trim(),
      content_ids: [productSlug.trim()],
      content_type: 'product',
      currency: (currency || 'INR').toUpperCase(),
    };

    if (typeof price === 'number' && !isNaN(price) && price > 0) {
      payload.value = Number(price.toFixed(2));
    }

    window.fbq('track', 'ViewContent', payload);
    lastTrackedViewContentKey = currentKey;

    return true;
  } catch (err) {
    console.error('[NORVI Analytics] Non-critical error tracking ViewContent:', err);
    return false;
  }
}

/**
 * Checks whether a purchase with this orderId has already been tracked
 * in this browser session or memory.
 */
export function isPurchaseTracked(orderId: string): boolean {
  if (!orderId) return true;
  if (inMemoryTrackedOrders.has(orderId)) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage ? window.sessionStorage.getItem(TRACKED_PURCHASES_KEY_PREFIX + orderId) === 'true' : false;
  } catch {
    return false;
  }
}

/**
 * Marks a purchase order ID as tracked in both memory and sessionStorage.
 */
function markPurchaseTracked(orderId: string): void {
  if (!orderId) return;
  inMemoryTrackedOrders.add(orderId);
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(TRACKED_PURCHASES_KEY_PREFIX + orderId, 'true');
      }
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Reset memory and session tracking (for unit testing).
 */
export function resetTrackedPurchasesForTesting(): void {
  inMemoryTrackedOrders.clear();
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith(TRACKED_PURCHASES_KEY_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => window.sessionStorage.removeItem(k));
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Tracks a verified, captured purchase via Meta Pixel.
 *
 * Safeguards:
 * 1. Strict affirmative consent gate (requires prior opt-in).
 * 2. Strict product validation: rejects events with missing product identity (never defaults to Voro).
 * 3. Deduplicates by unique order ID (sessionStorage + memory).
 * 4. Gracefully handles missing/blocked window.fbq without throwing.
 * 5. Transmits only e-commerce transaction data (never audio, transcripts, keys, or PII).
 * 6. Uses orderId as stable Meta eventID for future Conversions API deduplication.
 * 7. Never lets analytics errors disrupt checkout completion or license delivery.
 */
export function trackMetaPurchase(params: PurchaseEventParams): boolean {
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    const { orderId, amount, currency, productName, productSlug, numItems = 1 } = params;

    // Strict validation of transaction parameters and product identity
    if (
      !orderId ||
      typeof amount !== 'number' ||
      isNaN(amount) ||
      amount < 0 ||
      !productName ||
      typeof productName !== 'string' ||
      !productName.trim() ||
      !productSlug ||
      typeof productSlug !== 'string' ||
      !productSlug.trim()
    ) {
      console.warn('[NORVI Analytics] Invalid or incomplete purchase parameters (missing order or product identity). Event suppressed.', {
        orderId: orderId || undefined,
        amount,
        hasProduct: !!(productName && productSlug),
      });
      return false;
    }

    // Consent gate: do not track if affirmative consent is missing or withheld
    if (!hasAdvertisingConsent()) {
      console.info('[NORVI Analytics] Advertising consent withheld. Purchase event suppressed.');
      return false;
    }

    // Duplicate protection: prevent double-firing on re-renders, reloads, or duplicate callbacks
    if (isPurchaseTracked(orderId)) {
      console.info(`[NORVI Analytics] Order ${orderId} already tracked. Suppressing duplicate.`);
      return false;
    }

    // Check if Meta Pixel is loaded and available
    if (typeof window.fbq !== 'function') {
      console.warn('[NORVI Analytics] Meta Pixel (window.fbq) is unavailable or blocked by browser.');
      // Mark as tracked so we do not attempt delayed double-firing
      markPurchaseTracked(orderId);
      return false;
    }

    // E-commerce transaction payload (standard Meta format, 100% product-agnostic)
    const payload = {
      value: Number(amount.toFixed(2)),
      currency: (currency || 'INR').toUpperCase(),
      content_name: productName.trim(),
      content_type: 'product',
      content_ids: [productSlug.trim()],
      num_items: numItems,
    };

    // Attach Meta eventID for Pixel + CAPI deduplication
    const options = {
      eventID: orderId,
    };

    window.fbq('track', 'Purchase', payload, options);
    markPurchaseTracked(orderId);

    return true;
  } catch (err) {
    // Non-blocking error handling
    console.error('[NORVI Analytics] Non-critical error tracking purchase:', err);
    return false;
  }
}

