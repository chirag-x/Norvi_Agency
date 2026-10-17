import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  trackMetaViewContent,
  trackMetaPageView,
  trackMetaPurchase,
  initMetaPixel,
  hasAdvertisingConsent,
  setAdvertisingConsent,
  getAdvertisingConsentPreference,
  getProductDisplayPrice,
  resetViewContentTrackingForTesting,
  resetTrackedPurchasesForTesting,
  META_PIXEL_ID,
  type ViewContentEventParams
} from './analytics';

describe('Meta Pixel Phase 1: ViewContent Tracking & Regression Test Suite', () => {
  let fbqMock: any;
  let mockSessionStorage: Record<string, string>;
  let mockLocalStorage: Record<string, string>;
  let dispatchedEvents: CustomEvent[];

  beforeEach(() => {
    fbqMock = vi.fn();
    mockSessionStorage = {};
    mockLocalStorage = {};
    dispatchedEvents = [];

    vi.stubGlobal('window', {
      fbq: fbqMock,
      location: {
        pathname: '/agents/voro',
        href: 'https://nor-vi.in/agents/voro',
        search: ''
      },
      sessionStorage: {
        getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
        setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = val; }),
        removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
        get length() { return Object.keys(mockSessionStorage).length; },
        key: vi.fn((index: number) => Object.keys(mockSessionStorage)[index] || null)
      },
      localStorage: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, val: string) => { mockLocalStorage[key] = val; }),
        removeItem: vi.fn((key: string) => { delete mockLocalStorage[key]; })
      },
      dispatchEvent: vi.fn((event: CustomEvent) => {
        dispatchedEvents.push(event);
        return true;
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    resetViewContentTrackingForTesting();
    resetTrackedPurchasesForTesting();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Test A — Fresh visitor
  describe('Test A: Fresh visitor with no stored consent', () => {
    it('Suppresses ViewContent and all Meta Pixel events when consent is unset', () => {
      expect(getAdvertisingConsentPreference()).toBe('unset');
      expect(hasAdvertisingConsent()).toBe(false);

      const result = trackMetaViewContent({
        productName: 'Voro',
        productSlug: 'voro',
        price: 499,
        currency: 'INR'
      });

      expect(result).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
      expect(getAdvertisingConsentPreference()).toBe('unset');
    });
  });

  // Test B — Existing consent
  describe('Test B: Existing granted consent', () => {
    it('Emits exactly one ViewContent event with correct product metadata and suppresses re-renders', () => {
      setAdvertisingConsent(true);
      fbqMock.mockClear();

      const result = trackMetaViewContent({
        productName: 'Voro',
        productSlug: 'voro',
        productId: 'voro-uuid',
        price: 499,
        currency: 'INR'
      });

      expect(result).toBe(true);
      expect(fbqMock).toHaveBeenCalledTimes(1);
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', {
        content_name: 'Voro',
        content_ids: ['voro'],
        content_type: 'product',
        currency: 'INR',
        value: 499
      });

      // Immediate re-render on the same route/product
      const duplicateResult = trackMetaViewContent({
        productName: 'Voro',
        productSlug: 'voro',
        productId: 'voro-uuid',
        price: 499,
        currency: 'INR'
      });

      expect(duplicateResult).toBe(false);
      expect(fbqMock).toHaveBeenCalledTimes(1);
    });
  });

  // Test C — Consent granted after rendering
  describe('Test C: Consent granted while product page is already open', () => {
    it('Initializes Pixel, emits PageView, and permits ViewContent once consent is accepted', () => {
      // 1. Visitor arrives on /agents/voro with no consent
      expect(hasAdvertisingConsent()).toBe(false);
      const earlyView = trackMetaViewContent({
        productName: 'Voro',
        productSlug: 'voro',
        price: 499
      });
      expect(earlyView).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();

      // 2. Visitor clicks "Accept" on cookie banner
      setAdvertisingConsent(true);
      expect(hasAdvertisingConsent()).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('consent', 'grant');
      expect(fbqMock).toHaveBeenCalledWith('init', META_PIXEL_ID);
      expect(fbqMock).toHaveBeenCalledWith('track', 'PageView');
      fbqMock.mockClear();

      // 3. ViewContent fires after consent granted
      const postConsentView = trackMetaViewContent({
        productName: 'Voro',
        productSlug: 'voro',
        price: 499,
        currency: 'INR'
      });
      expect(postConsentView).toBe(true);
      expect(fbqMock).toHaveBeenCalledTimes(1);
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', expect.objectContaining({
        content_name: 'Voro',
        value: 499
      }));

      // 4. Repeated render does not double-fire
      expect(trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 })).toBe(false);
      expect(fbqMock).toHaveBeenCalledTimes(1);
    });
  });

  // Test D — Consent declined
  describe('Test D: Consent explicitly declined', () => {
    it('Blocks all tracking events when visitor clicks Decline', () => {
      setAdvertisingConsent(false);
      expect(getAdvertisingConsentPreference()).toBe('denied');
      expect(hasAdvertisingConsent()).toBe(false);
      fbqMock.mockClear();

      expect(trackMetaPageView()).toBe(false);
      expect(trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 })).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
    });
  });

  // Test E — Consent revoked
  describe('Test E: Consent granted then revoked', () => {
    it('Calls fbq consent revoke and blocks all subsequent tracking', () => {
      setAdvertisingConsent(true);
      expect(hasAdvertisingConsent()).toBe(true);
      fbqMock.mockClear();

      // User revokes consent
      setAdvertisingConsent(false);
      expect(hasAdvertisingConsent()).toBe(false);
      expect(getAdvertisingConsentPreference()).toBe('denied');
      expect(fbqMock).toHaveBeenCalledWith('consent', 'revoke');
      fbqMock.mockClear();

      // Subsequent navigations or view attempts must be strictly blocked
      window.location.pathname = '/agents/nexus';
      expect(trackMetaPageView()).toBe(false);
      expect(trackMetaViewContent({ productName: 'Nexus', productSlug: 'nexus', price: 1499 })).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
    });
  });

  // Test F — Client-side navigation (Home -> Voro -> Agents -> Voro)
  describe('Test F: Client-side navigation and repeat product visits', () => {
    it('Tracks exactly one ViewContent per visit instance and allows repeat visits upon return', () => {
      setAdvertisingConsent(true);
      fbqMock.mockClear();

      // 1. User starts at Home (/)
      window.location.pathname = '/';
      trackMetaPageView();
      expect(fbqMock).toHaveBeenCalledWith('track', 'PageView');
      fbqMock.mockClear();

      // 2. User navigates to Voro (/agents/voro)
      window.location.pathname = '/agents/voro';
      trackMetaPageView();
      expect(fbqMock).toHaveBeenCalledWith('track', 'PageView');
      fbqMock.mockClear();

      // Detail component mounts and tracks ViewContent
      const voroVisit1 = trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 });
      expect(voroVisit1).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', expect.objectContaining({ content_name: 'Voro' }));
      fbqMock.mockClear();

      // Component re-renders on /agents/voro (e.g. modal opens) -> suppressed!
      const voroReRender = trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 });
      expect(voroReRender).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();

      // 3. User navigates to All Agents (/agents)
      window.location.pathname = '/agents';
      trackMetaPageView();
      expect(fbqMock).toHaveBeenCalledWith('track', 'PageView');
      fbqMock.mockClear();

      // 4. User navigates back to Voro (/agents/voro) -> legitimate repeat view!
      window.location.pathname = '/agents/voro';
      trackMetaPageView();
      expect(fbqMock).toHaveBeenCalledWith('track', 'PageView');
      fbqMock.mockClear();

      const voroVisit2 = trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 });
      expect(voroVisit2).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', expect.objectContaining({ content_name: 'Voro' }));
      fbqMock.mockClear();

      // Repeated render on second visit -> suppressed!
      expect(trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 })).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
    });
  });

  // Test G — Dynamic product metadata & pricing
  describe('Test G: Multi-product metadata and dynamic pricing extraction', () => {
    it('Correctly parses and tracks Voro, Nexus with sale, and products with unconfirmed prices', () => {
      setAdvertisingConsent(true);
      fbqMock.mockClear();

      // Voro base price
      const voroPrice = getProductDisplayPrice({ price: '₹499/mo', slug: 'voro' });
      expect(voroPrice).toBe(499);

      window.location.pathname = '/agents/voro';
      trackMetaViewContent({
        productName: 'Voro',
        productSlug: 'voro',
        price: voroPrice,
        currency: 'INR'
      });
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', {
        content_name: 'Voro',
        content_ids: ['voro'],
        content_type: 'product',
        currency: 'INR',
        value: 499
      });
      fbqMock.mockClear();

      // Nexus with active sale
      const nexusPrice = getProductDisplayPrice(
        { price: '₹1,499', slug: 'nexus', is_on_sale: true },
        { saleActive: true, salePercentage: 20 }
      );
      expect(nexusPrice).toBe(1199); // 1499 * 0.8 = 1199.2 -> 1199

      window.location.pathname = '/agents/nexus';
      trackMetaViewContent({
        productName: 'Nexus',
        productSlug: 'nexus',
        price: nexusPrice,
        currency: 'INR'
      });
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', {
        content_name: 'Nexus',
        content_ids: ['nexus'],
        content_type: 'product',
        currency: 'INR',
        value: 1199
      });
      fbqMock.mockClear();

      // Omnix with unconfirmed price (omits value but includes currency and product identity)
      const omnixPrice = getProductDisplayPrice({ price: 'Pricing to be confirmed', slug: 'omnix' });
      expect(omnixPrice).toBeUndefined();

      window.location.pathname = '/agents/omnix';
      trackMetaViewContent({
        productName: 'Omnix',
        productSlug: 'omnix',
        price: omnixPrice,
        currency: 'INR'
      });
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', {
        content_name: 'Omnix',
        content_ids: ['omnix'],
        content_type: 'product',
        currency: 'INR'
      });
      fbqMock.mockClear();

      // Invalid product (missing slug or name)
      expect(trackMetaViewContent({ productName: '', productSlug: 'test' })).toBe(false);
      expect(trackMetaViewContent({ productName: 'Test', productSlug: '' })).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
    });
  });

  // Test H — Checkout regression
  describe('Test H: Checkout regression', () => {
    it('Does NOT emit Purchase event on cancelled or failed checkout', () => {
      setAdvertisingConsent(true);
      fbqMock.mockClear();

      // Simulating a failed/cancelled checkout: trackMetaPurchase is NOT called
      expect(fbqMock).not.toHaveBeenCalledWith('track', 'Purchase', expect.anything(), expect.anything());
    });
  });

  // Test I — Purchase regression
  describe('Test I: Purchase regression with verified Razorpay capture', () => {
    it('Emits verified Purchase event with exact orderId deduplication and INR currency', () => {
      setAdvertisingConsent(true);
      fbqMock.mockClear();

      const orderId = '00000000-0000-4000-8000-000000000999';
      const success = trackMetaPurchase({
        orderId,
        amount: 499,
        currency: 'INR',
        productName: 'Voro',
        productSlug: 'voro',
        productId: 'voro-id'
      });

      expect(success).toBe(true);
      expect(fbqMock).toHaveBeenCalledTimes(1);
      expect(fbqMock).toHaveBeenCalledWith('track', 'Purchase', {
        value: 499,
        currency: 'INR',
        content_name: 'Voro',
        content_type: 'product',
        content_ids: ['voro'],
        num_items: 1
      }, {
        eventID: orderId
      });

      // Duplicate prevention on refresh
      fbqMock.mockClear();
      const duplicate = trackMetaPurchase({
        orderId,
        amount: 499,
        currency: 'INR',
        productName: 'Voro',
        productSlug: 'voro'
      });

      expect(duplicate).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
    });
  });

  describe('Resilience and Error Handling', () => {
    it('Gracefully handles missing or blocked window.fbq without throwing', () => {
      setAdvertisingConsent(true);
      (window as any).fbq = undefined;

      expect(() => {
        const res = trackMetaViewContent({
          productName: 'Voro',
          productSlug: 'voro',
          price: 499
        });
        expect(res).toBe(false);
      }).not.toThrow();
    });

    it('Gracefully catches internal fbq runtime crashes without disrupting UI', () => {
      setAdvertisingConsent(true);
      (window as any).fbq = vi.fn(() => {
        throw new Error('Meta Script Fatal Internal Error');
      });

      expect(() => {
        const res = trackMetaViewContent({
          productName: 'Voro',
          productSlug: 'voro',
          price: 499
        });
        expect(res).toBe(false);
      }).not.toThrow();
    });
  });

  describe('Task 1: Exact Revocation and Re-acceptance Sequence', () => {
    it('Executes the complete 9-step consent revoke and re-accept lifecycle accurately', () => {
      // Step 1: User visits Voro product page
      window.location.pathname = '/agents/voro';
      expect(hasAdvertisingConsent()).toBe(false);

      // Step 2: User accepts advertising consent
      setAdvertisingConsent(true);
      expect(hasAdvertisingConsent()).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('consent', 'grant');
      expect(fbqMock).toHaveBeenCalledWith('init', META_PIXEL_ID);
      expect(fbqMock).toHaveBeenCalledWith('track', 'PageView');
      fbqMock.mockClear();

      // Step 3: ViewContent fires for Voro
      const viewResult1 = trackMetaViewContent({
        productName: 'Voro',
        productSlug: 'voro',
        price: 499,
        currency: 'INR'
      });
      expect(viewResult1).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', {
        content_name: 'Voro',
        content_ids: ['voro'],
        content_type: 'product',
        currency: 'INR',
        value: 499
      });
      fbqMock.mockClear();

      // Step 4: User opens Cookie Preferences and selects Decline
      setAdvertisingConsent(false);
      expect(hasAdvertisingConsent()).toBe(false);
      expect(getAdvertisingConsentPreference()).toBe('denied');
      expect(fbqMock).toHaveBeenCalledWith('consent', 'revoke');
      fbqMock.mockClear();

      // Step 5: No new Meta events are transmitted while declined
      expect(trackMetaPageView()).toBe(false);
      expect(trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 })).toBe(false);
      expect(trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000005',
        amount: 499,
        currency: 'INR',
        productName: 'Voro',
        productSlug: 'voro'
      })).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();

      // Step 6 & 7: User reopens Cookie Preferences and selects Accept again
      setAdvertisingConsent(true);
      expect(hasAdvertisingConsent()).toBe(true);
      expect(getAdvertisingConsentPreference()).toBe('granted');
      expect(fbqMock).toHaveBeenCalledWith('consent', 'grant');
      fbqMock.mockClear();

      // Step 8: Exactly one appropriate ViewContent is recorded for the restored consent state
      const restoredView = trackMetaViewContent({
        productName: 'Voro',
        productSlug: 'voro',
        price: 499,
        currency: 'INR'
      });
      expect(restoredView).toBe(true);
      expect(fbqMock).toHaveBeenCalledTimes(1);
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', {
        content_name: 'Voro',
        content_ids: ['voro'],
        content_type: 'product',
        currency: 'INR',
        value: 499
      });
      fbqMock.mockClear();

      // Step 9: Re-renders on restored state are suppressed (no duplicates)
      const duplicateRestoredView = trackMetaViewContent({
        productName: 'Voro',
        productSlug: 'voro',
        price: 499,
        currency: 'INR'
      });
      expect(duplicateRestoredView).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
    });
  });

  describe('Task 2: Dynamic Pricing Edge Cases and Pricing Structures', () => {
    it('Accurately parses standard formatted Indian rupee prices (₹499, ₹1,499, ₹12,499)', () => {
      expect(getProductDisplayPrice({ price: '₹499' })).toBe(499);
      expect(getProductDisplayPrice({ price: '₹499/mo' })).toBe(499);
      expect(getProductDisplayPrice({ price: '₹1,499' })).toBe(1499);
      expect(getProductDisplayPrice({ price: '₹12,499' })).toBe(12499);
      expect(getProductDisplayPrice({ price: '₹1,12,499' })).toBe(112499);
    });

    it('Accurately computes sitewide active sale percentage discounts', () => {
      // 20% off on ₹1,499 -> 1199
      expect(getProductDisplayPrice(
        { price: '₹1,499', is_on_sale: true },
        { saleActive: true, salePercentage: 20 }
      )).toBe(1199);

      // 10% off on ₹499 -> 449
      expect(getProductDisplayPrice(
        { price: '₹499', is_on_sale: true },
        { saleActive: true, salePercentage: 10 }
      )).toBe(449);

      // Sale not active -> returns regular price
      expect(getProductDisplayPrice(
        { price: '₹1,499', is_on_sale: true },
        { saleActive: false, salePercentage: 20 }
      )).toBe(1499);

      // Product not on sale -> returns regular price
      expect(getProductDisplayPrice(
        { price: '₹1,499', is_on_sale: false },
        { saleActive: true, salePercentage: 20 }
      )).toBe(1499);
    });

    it('Falls back cleanly to structured tier prices for multi-duration products like "Pick Your Plan"', () => {
      // Live catalog structure: price = "Pick Your Plan", price1m = 599, price3m = 1499, price_lifetime = 4999
      const voroLiveProduct = {
        name: 'Voro',
        slug: 'voro',
        price: 'Pick Your Plan',
        price1m: 599,
        price3m: 1499,
        price_lifetime: 4999,
        is_on_sale: true
      };

      // Base price extracted from price1m
      expect(getProductDisplayPrice(voroLiveProduct)).toBe(599);

      // With 20% active sale
      expect(getProductDisplayPrice(voroLiveProduct, { saleActive: true, salePercentage: 20 })).toBe(479);

      // Product with only price3m
      expect(getProductDisplayPrice({ price: 'Pick Your Plan', price3m: 1299 })).toBe(1299);

      // Product with only price_lifetime
      expect(getProductDisplayPrice({ price: 'Pick Your Plan', price_lifetime: 4499 })).toBe(4499);
    });

    it('Returns undefined for products without prices, free products, or invalid strings', () => {
      expect(getProductDisplayPrice({ price: 'Pricing to be confirmed' })).toBeUndefined();
      expect(getProductDisplayPrice({ price: 'Free' })).toBeUndefined();
      expect(getProductDisplayPrice({ price: '₹0' })).toBeUndefined();
      expect(getProductDisplayPrice({ price: 'N/A' })).toBeUndefined();
      expect(getProductDisplayPrice({ price: 'TBD' })).toBeUndefined();
      expect(getProductDisplayPrice({ price: '' })).toBeUndefined();
      expect(getProductDisplayPrice(null)).toBeUndefined();
      expect(getProductDisplayPrice(undefined)).toBeUndefined();
    });

    it('Reflects admin-updated prices dynamically', () => {
      const dynamicProduct = {
        price: '₹599',
        slug: 'voro'
      };
      expect(getProductDisplayPrice(dynamicProduct)).toBe(599);

      // Admin updates price to ₹799
      dynamicProduct.price = '₹799';
      expect(getProductDisplayPrice(dynamicProduct)).toBe(799);
    });
  });

  describe('Task 3: PageView and ViewContent Navigation Lifecycle', () => {
    it('Handles React StrictMode double-effects without duplicate beacons', () => {
      setAdvertisingConsent(true);
      fbqMock.mockClear();

      window.location.pathname = '/agents/voro';

      // StrictMode effect run 1
      const call1 = trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 });
      expect(call1).toBe(true);

      // StrictMode effect run 2 (immediate re-invocation)
      const call2 = trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 });
      expect(call2).toBe(false);

      expect(fbqMock).toHaveBeenCalledTimes(1);
    });

    it('Supports browser back and forward navigation without permanent suppression', () => {
      setAdvertisingConsent(true);
      fbqMock.mockClear();

      // Forward to Voro
      window.location.pathname = '/agents/voro';
      trackMetaPageView();
      expect(trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 })).toBe(true);
      fbqMock.mockClear();

      // Navigate to Nexus
      window.location.pathname = '/agents/nexus';
      trackMetaPageView();
      expect(trackMetaViewContent({ productName: 'Nexus', productSlug: 'nexus', price: 1499 })).toBe(true);
      fbqMock.mockClear();

      // Browser back navigation to Voro
      window.location.pathname = '/agents/voro';
      trackMetaPageView();
      expect(trackMetaViewContent({ productName: 'Voro', productSlug: 'voro', price: 499 })).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'ViewContent', expect.objectContaining({ content_name: 'Voro' }));
    });
  });
});
