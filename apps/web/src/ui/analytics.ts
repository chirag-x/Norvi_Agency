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

export type AdvertisingConsentState = 'granted' | 'denied' | 'unset';

const TRACKED_PURCHASES_KEY_PREFIX = 'norvi_meta_purchase_tracked_';
const CONSENT_STORAGE_KEY = 'norvi_advertising_consent';
const inMemoryTrackedOrders = new Set<string>();

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
    initMetaPixel();
  } else {
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

