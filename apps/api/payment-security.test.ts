import { describe, it, expect, vi, afterEach } from 'vitest';

let mockOrderRecord: any = null;
let mockRpcHandler: any = null;

const mockAdminDb: any = {
  from: (table: string) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({ data: mockOrderRecord, error: null }),
      maybeSingle: async () => ({ data: mockOrderRecord, error: null })
    };
    return chain;
  },
  rpc: (fn: string, params: any) => {
    if (mockRpcHandler) return mockRpcHandler(fn, params);
    if (fn === 'record_webhook_event') return Promise.resolve({ data: true, error: null });
    if (fn === 'process_payment_webhook') return Promise.resolve({ data: { ok: true, license_id: 'lic-123' }, error: null });
    return Promise.resolve({ data: {}, error: null });
  }
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockAdminDb)
}));

import { createLiveApp, type LiveEnv } from './live';

const testEnv: LiveEnv = {
  APP_ORIGIN: 'http://127.0.0.1:4321',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  RAZORPAY_KEY_ID: 'rzp_test_12345',
  RAZORPAY_KEY_SECRET: 'test_secret_key_12345678',
  RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret_12345678',
  LICENSE_ENCRYPTION_KEY: 'test-encryption-key-must-be-long-enough-32bytes'
};

async function computeSignature(secret: string, rzpOrderId: string, rzpPaymentId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(`${rzpOrderId}|${rzpPaymentId}`));
  return Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function createSecurityFixture({
  user = { id: 'cust-1', email: 'cust@example.invalid', email_confirmed_at: '2026-09-23', last_sign_in_at: null },
  orderRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    user_id: 'cust-1',
    amount_minor: 49900,
    currency: 'INR',
    product_id: 'agent-voro-id',
    status: 'pending',
    provider_order_id: 'order_rzp_expected_123',
    products: { id: 'agent-voro-id', slug: 'voro', name: 'Voro' }
  },
  rpcResult = { ok: true, license_id: 'lic-123' },
  rzpPaymentResponse = {
    id: 'pay_123',
    order_id: 'order_rzp_expected_123',
    amount: 49900,
    currency: 'INR',
    status: 'captured'
  },
  rzpFetchOk = true
} = {}) {
  mockOrderRecord = orderRecord;
  const rpcMock = vi.fn(async (fn: string, params: any) => {
    if (fn === 'record_webhook_event') return { data: true, error: null };
    return { data: rpcResult, error: null };
  });
  mockRpcHandler = rpcMock;

  const db: any = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })) }
    },
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: { display_name: 'Customer 1', suspended: false, created_at: '2026-09-23' }, error: null }),
        maybeSingle: async () => {
          if (table === 'orders') return { data: mockOrderRecord, error: null };
          if (table === 'staff_memberships') return { data: null, error: null };
          return { data: null, error: null };
        }
      };
      return chain;
    },
    rpc: rpcMock
  };

  // Mock fetch for Razorpay gateway API calls
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('api.razorpay.com/v1/payments/')) {
      return {
        ok: rzpFetchOk,
        status: rzpFetchOk ? 200 : 502,
        json: async () => rzpPaymentResponse
      };
    }
    return { ok: true, json: async () => ({}) };
  }));

  const app = createLiveApp(() => db);
  const request = (path: string, body: object, bindings = testEnv) =>
    app.request('http://localhost/api' + path, {
      method: 'POST',
      headers: {
        origin: bindings.APP_ORIGIN!,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    }, bindings);

  return { app, db, rpcMock, request };
}

describe('Payment Security & Anti-Substitution Hardening (API Tier)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('A. /api/checkout/verify Security Validations', () => {
    it('Succeeds and fulfills license when payment is fully verified, captured, and amounts match', async () => {
      const { request, rpcMock } = createSecurityFixture();
      const validSig = await computeSignature(testEnv.RAZORPAY_KEY_SECRET!, 'order_rzp_expected_123', 'pay_123');

      const res = await request('/checkout/verify', {
        orderId: '00000000-0000-4000-8000-000000000001',
        razorpay_order_id: 'order_rzp_expected_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: validSig
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.verified).toBe(true);
      expect(data.captured).toBe(true);
      expect(data.amount).toBe(499);
      expect(data.productSlug).toBe('voro');
      expect(data.productName).toBe('Voro');
      expect(rpcMock).toHaveBeenCalledWith('process_payment_webhook', expect.objectContaining({
        p_order_id: '00000000-0000-4000-8000-000000000001',
        p_payment_id: 'pay_123'
      }));
    });

    it('Rejects invalid HMAC signature with 403', async () => {
      const { request, rpcMock } = createSecurityFixture();

      const res = await request('/checkout/verify', {
        orderId: '00000000-0000-4000-8000-000000000001',
        razorpay_order_id: 'order_rzp_expected_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: 'invalid_forged_signature_hex'
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Invalid payment signature.');
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('PREVENTS ORDER SUBSTITUTION: Rejects mismatched razorpay_order_id and internal provider_order_id', async () => {
      const { request, rpcMock } = createSecurityFixture({
        orderRecord: {
          id: '00000000-0000-4000-8000-000000000001',
          user_id: 'cust-1',
          amount_minor: 299900, // Expensive lifetime order
          currency: 'INR',
          product_id: 'agent-voro-id',
          status: 'pending',
          provider_order_id: 'order_expensive_lifetime_999',
          products: { id: 'agent-voro-id', slug: 'voro', name: 'Voro' }
        }
      });

      // Attacker submits a valid signature for a cheap order (order_cheap_499) against the expensive orderId
      const cheapOrderSig = await computeSignature(testEnv.RAZORPAY_KEY_SECRET!, 'order_cheap_499', 'pay_cheap_499');

      const res = await request('/checkout/verify', {
        orderId: '00000000-0000-4000-8000-000000000001',
        razorpay_order_id: 'order_cheap_499',
        razorpay_payment_id: 'pay_cheap_499',
        razorpay_signature: cheapOrderSig
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Payment order mismatch.');
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('PREVENTS AMOUNT TAMPERING: Rejects when Razorpay gateway amount differs from order amount', async () => {
      const { request, rpcMock } = createSecurityFixture({
        orderRecord: {
          id: '00000000-0000-4000-8000-000000000001',
          user_id: 'cust-1',
          amount_minor: 49900, // Internal order expects ₹499
          currency: 'INR',
          product_id: 'agent-voro-id',
          status: 'pending',
          provider_order_id: 'order_rzp_expected_123',
          products: { id: 'agent-voro-id', slug: 'voro', name: 'Voro' }
        },
        rzpPaymentResponse: {
          id: 'pay_123',
          order_id: 'order_rzp_expected_123',
          amount: 100, // Attacker paid ₹1
          currency: 'INR',
          status: 'captured'
        }
      });

      const validSig = await computeSignature(testEnv.RAZORPAY_KEY_SECRET!, 'order_rzp_expected_123', 'pay_123');

      const res = await request('/checkout/verify', {
        orderId: '00000000-0000-4000-8000-000000000001',
        razorpay_order_id: 'order_rzp_expected_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: validSig
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Payment amount mismatch.');
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('PREVENTS CURRENCY TAMPERING: Rejects currency mismatch', async () => {
      const { request, rpcMock } = createSecurityFixture({
        rzpPaymentResponse: {
          id: 'pay_123',
          order_id: 'order_rzp_expected_123',
          amount: 49900,
          currency: 'USD', // Currency mismatch
          status: 'captured'
        }
      });

      const validSig = await computeSignature(testEnv.RAZORPAY_KEY_SECRET!, 'order_rzp_expected_123', 'pay_123');

      const res = await request('/checkout/verify', {
        orderId: '00000000-0000-4000-8000-000000000001',
        razorpay_order_id: 'order_rzp_expected_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: validSig
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Payment currency mismatch.');
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('PREVENTS PREMATURE FULFILLMENT: Authorized-only payment does NOT fulfill order', async () => {
      const { request, rpcMock } = createSecurityFixture({
        rzpPaymentResponse: {
          id: 'pay_123',
          order_id: 'order_rzp_expected_123',
          amount: 49900,
          currency: 'INR',
          status: 'authorized' // NOT captured!
        }
      });

      const validSig = await computeSignature(testEnv.RAZORPAY_KEY_SECRET!, 'order_rzp_expected_123', 'pay_123');

      const res = await request('/checkout/verify', {
        orderId: '00000000-0000-4000-8000-000000000001',
        razorpay_order_id: 'order_rzp_expected_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: validSig
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.verified).toBe(true);
      expect(data.captured).toBe(false);
      expect(data.status).toBe('authorized');
      // Supabase fulfillment RPC MUST NOT be called!
      expect(rpcMock).not.toHaveBeenCalledWith('process_payment_webhook', expect.anything());
    });

    it('PREVENTS UNPRIVILEGED CROSS-USER ACCESS: Another user cannot verify someone else order', async () => {
      const { request, rpcMock } = createSecurityFixture({
        user: { id: 'cust-intruder', email: 'intruder@example.invalid', email_confirmed_at: '2026-09-23', last_sign_in_at: null },
        orderRecord: {
          id: '00000000-0000-4000-8000-000000000001',
          user_id: 'cust-victim', // Belongs to victim
          amount_minor: 49900,
          currency: 'INR',
          product_id: 'agent-voro-id',
          status: 'pending',
          provider_order_id: 'order_rzp_expected_123',
          products: { id: 'agent-voro-id', slug: 'voro', name: 'Voro' }
        }
      });

      const validSig = await computeSignature(testEnv.RAZORPAY_KEY_SECRET!, 'order_rzp_expected_123', 'pay_123');

      const res = await request('/checkout/verify', {
        orderId: '00000000-0000-4000-8000-000000000001',
        razorpay_order_id: 'order_rzp_expected_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: validSig
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized to verify this order.');
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('Handles gateway communication failure safely (HTTP 502)', async () => {
      const { request, rpcMock } = createSecurityFixture({
        rzpFetchOk: false
      });

      const validSig = await computeSignature(testEnv.RAZORPAY_KEY_SECRET!, 'order_rzp_expected_123', 'pay_123');

      const res = await request('/checkout/verify', {
        orderId: '00000000-0000-4000-8000-000000000001',
        razorpay_order_id: 'order_rzp_expected_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: validSig
      });

      expect(res.status).toBe(502);
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });

  describe('B. /api/webhooks/razorpay Security Validations', () => {
    async function computeWebhookSig(secret: string, bodyText: string): Promise<string> {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(bodyText));
      return Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    it('Ignores payment.authorized event without fulfilling license prematurely', async () => {
      const { app, rpcMock } = createSecurityFixture();
      const body = JSON.stringify({
        id: 'evt_auth_123',
        event: 'payment.authorized',
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              order_id: 'order_rzp_expected_123',
              amount: 49900,
              currency: 'INR'
            }
          }
        }
      });

      const sig = await computeWebhookSig(testEnv.RAZORPAY_WEBHOOK_SECRET!, body);
      const res = await app.request('http://localhost/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': sig,
          'content-type': 'application/json'
        },
        body
      }, testEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('authorized_pending_capture');
      // process_payment_webhook must NOT be called for payment.authorized!
      expect(rpcMock).not.toHaveBeenCalledWith('process_payment_webhook', expect.anything());
    });

    it('Fulfills license upon verified payment.captured webhook with matching amount', async () => {
      const { app, rpcMock } = createSecurityFixture();
      const body = JSON.stringify({
        id: 'evt_cap_123',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_123',
              order_id: 'order_rzp_expected_123',
              amount: 49900,
              currency: 'INR'
            }
          }
        }
      });

      const sig = await computeWebhookSig(testEnv.RAZORPAY_WEBHOOK_SECRET!, body);
      const res = await app.request('http://localhost/api/webhooks/razorpay', {
        method: 'POST',
        headers: {
          'x-razorpay-signature': sig,
          'content-type': 'application/json'
        },
        body
      }, testEnv);

      expect(res.status).toBe(200);
      expect(rpcMock).toHaveBeenCalledWith('process_payment_webhook', expect.objectContaining({
        p_order_id: '00000000-0000-4000-8000-000000000001',
        p_payment_id: 'pay_123'
      }));
    });
  });
});
