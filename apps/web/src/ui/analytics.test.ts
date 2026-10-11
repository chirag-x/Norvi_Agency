import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  trackMetaPurchase,
  trackMetaPageView,
  initMetaPixel,
  isPurchaseTracked,
  hasAdvertisingConsent,
  setAdvertisingConsent,
  getAdvertisingConsentPreference,
  resetTrackedPurchasesForTesting,
  META_PIXEL_ID
} from './analytics';

describe('Meta Pixel Multi-Product Tracking & Consent Safeguards (UI)', () => {
  let fbqMock: any;
  let mockSessionStorage: Record<string, string>;
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    fbqMock = vi.fn();
    mockSessionStorage = {};
    mockLocalStorage = {};

    vi.stubGlobal('window', {
      fbq: fbqMock,
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
      dispatchEvent: vi.fn()
    });

    resetTrackedPurchasesForTesting();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Advertising Consent Engine', () => {
    it('Requires affirmative consent (missing preference defaults to false/unset)', () => {
      expect(getAdvertisingConsentPreference()).toBe('unset');
      expect(hasAdvertisingConsent()).toBe(false);

      const success = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000001',
        amount: 499,
        currency: 'INR',
        productName: 'Voro',
        productSlug: 'voro'
      });

      expect(success).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
    });

    it('Enables tracking upon explicit affirmative consent', () => {
      setAdvertisingConsent(true);
      expect(getAdvertisingConsentPreference()).toBe('granted');
      expect(hasAdvertisingConsent()).toBe(true);

      // Verify init and PageView were triggered on consent grant
      expect(fbqMock).toHaveBeenCalledWith('init', META_PIXEL_ID);
      expect(fbqMock).toHaveBeenCalledWith('track', 'PageView');

      fbqMock.mockClear();

      const success = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000001',
        amount: 499,
        currency: 'INR',
        productName: 'Voro',
        productSlug: 'voro'
      });

      expect(success).toBe(true);
      expect(fbqMock).toHaveBeenCalledTimes(1);
      expect(fbqMock).toHaveBeenCalledWith('track', 'Purchase', expect.anything(), expect.anything());
    });

    it('Revoked consent stops subsequent tracking immediately', () => {
      setAdvertisingConsent(true);
      expect(hasAdvertisingConsent()).toBe(true);
      fbqMock.mockClear();

      setAdvertisingConsent(false);
      expect(getAdvertisingConsentPreference()).toBe('denied');
      expect(hasAdvertisingConsent()).toBe(false);

      const success = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000002',
        amount: 499,
        currency: 'INR',
        productName: 'Voro',
        productSlug: 'voro'
      });

      expect(success).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
    });

    it('Client navigation PageView tracking respects affirmative consent', () => {
      expect(trackMetaPageView()).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();

      setAdvertisingConsent(true);
      fbqMock.mockClear();

      expect(trackMetaPageView()).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'PageView');
    });

    it('Pixel initialization helper is idempotent and sets _norvi_pixel_initialized', () => {
      setAdvertisingConsent(true);
      expect(initMetaPixel()).toBe(true);
      expect((window as any)._norvi_pixel_initialized).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('init', META_PIXEL_ID);
      expect(fbqMock).toHaveBeenCalledWith('track', 'PageView');

      // Second call should return true immediately without duplicate init
      fbqMock.mockClear();
      expect(initMetaPixel()).toBe(true);
      expect(fbqMock).not.toHaveBeenCalled();
    });
  });

  describe('Multi-Product Dynamic Attribution', () => {
    beforeEach(() => {
      setAdvertisingConsent(true);
      fbqMock.mockClear();
    });

    it('Accurately tracks Voro purchases', () => {
      const success = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000010',
        amount: 499,
        currency: 'INR',
        productName: 'Voro',
        productSlug: 'voro',
        productId: 'agent-2'
      });

      expect(success).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'Purchase', {
        value: 499,
        currency: 'INR',
        content_name: 'Voro',
        content_type: 'product',
        content_ids: ['voro'],
        num_items: 1
      }, {
        eventID: '00000000-0000-4000-8000-000000000010'
      });
    });

    it('Accurately tracks Nexus purchases without Voro misattribution', () => {
      const success = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000020',
        amount: 1499,
        currency: 'INR',
        productName: 'Nexus',
        productSlug: 'nexus',
        productId: 'nexus-uuid'
      });

      expect(success).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'Purchase', {
        value: 1499,
        currency: 'INR',
        content_name: 'Nexus',
        content_type: 'product',
        content_ids: ['nexus'],
        num_items: 1
      }, {
        eventID: '00000000-0000-4000-8000-000000000020'
      });
    });

    it('Accurately tracks Rolvio purchases without Voro misattribution', () => {
      const success = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000030',
        amount: 799,
        currency: 'INR',
        productName: 'Rolvio',
        productSlug: 'rolvio',
        productId: 'agent-3'
      });

      expect(success).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'Purchase', {
        value: 799,
        currency: 'INR',
        content_name: 'Rolvio',
        content_type: 'product',
        content_ids: ['rolvio'],
        num_items: 1
      }, {
        eventID: '00000000-0000-4000-8000-000000000030'
      });
    });

    it('Accurately tracks generic future catalog products', () => {
      const success = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000040',
        amount: 2999,
        currency: 'INR',
        productName: 'Custom Enterprise Agent',
        productSlug: 'custom-enterprise-agent',
        productId: 'agent-future-99'
      });

      expect(success).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'Purchase', {
        value: 2999,
        currency: 'INR',
        content_name: 'Custom Enterprise Agent',
        content_type: 'product',
        content_ids: ['custom-enterprise-agent'],
        num_items: 1
      }, {
        eventID: '00000000-0000-4000-8000-000000000040'
      });
    });

    it('Suppresses tracking when product identity is missing (NEVER defaults to Voro)', () => {
      const noSlug = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000050',
        amount: 499,
        currency: 'INR',
        productName: 'Some Product',
        productSlug: ''
      });
      expect(noSlug).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();

      const noName = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000051',
        amount: 499,
        currency: 'INR',
        productName: '',
        productSlug: 'some-slug'
      });
      expect(noName).toBe(false);
      expect(fbqMock).not.toHaveBeenCalled();
    });

    it('Tracks discounted and coupon orders with the exact verified amount', () => {
      const success = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000060',
        amount: 449.10,
        currency: 'INR',
        productName: 'Voro',
        productSlug: 'voro'
      });

      expect(success).toBe(true);
      expect(fbqMock).toHaveBeenCalledWith('track', 'Purchase', expect.objectContaining({
        value: 449.10,
        content_name: 'Voro'
      }), expect.anything());
    });

    it('Prevents duplicate Purchase tracking for the same orderId', () => {
      const orderId = '00000000-0000-4000-8000-000000000070';
      const first = trackMetaPurchase({
        orderId,
        amount: 499,
        currency: 'INR',
        productName: 'Nexus',
        productSlug: 'nexus'
      });
      expect(first).toBe(true);
      expect(fbqMock).toHaveBeenCalledTimes(1);

      const second = trackMetaPurchase({
        orderId,
        amount: 499,
        currency: 'INR',
        productName: 'Nexus',
        productSlug: 'nexus'
      });
      expect(second).toBe(false);
      expect(fbqMock).toHaveBeenCalledTimes(1);
    });

    it('Handles blocked or missing window.fbq gracefully without throwing', () => {
      (window as any).fbq = undefined;
      const success = trackMetaPurchase({
        orderId: '00000000-0000-4000-8000-000000000080',
        amount: 499,
        currency: 'INR',
        productName: 'Nexus',
        productSlug: 'nexus'
      });
      expect(success).toBe(false);
    });

    it('Handles fbq internal crashes gracefully without throwing', () => {
      (window as any).fbq = vi.fn(() => {
        throw new Error('Meta Pixel Internal Script Crash');
      });

      expect(() => {
        const success = trackMetaPurchase({
          orderId: '00000000-0000-4000-8000-000000000090',
          amount: 499,
          currency: 'INR',
          productName: 'Voro',
          productSlug: 'voro'
        });
        expect(success).toBe(false);
      }).not.toThrow();
    });
  });
});
