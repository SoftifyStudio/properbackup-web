import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createStripeCheckout, reactivateSubscription } from './bufferClient.js';

// These integration-style tests verify how the API client surfaces structured errors
// from the buffer to the SubscriptionPage UI. Without preserving `status`/`code` the page
// cannot distinguish between "promo expired between validate and checkout" (recoverable —
// strip the promo and retry) and "expired_must_recheckout" (re-route the user to Stripe
// Checkout). Tests must adapt to the LOGIC, never the other way around — if the buffer
// changes its error shape these tests fail loudly so the UI is updated in lock-step.

describe('createStripeCheckout error surfacing', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('preserves status, code, reason on 410 promo_no_longer_valid', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({
        error: 'promo_no_longer_valid',
        reason: 'not_found_or_expired',
        message: 'The promo code is no longer valid — please remove it or apply a different one.',
      }),
    });

    try {
      await createStripeCheckout('monthly', 'token123', 'EXPIRED20');
      throw new Error('expected createStripeCheckout to throw');
    } catch (e) {
      expect(e.status).toBe(410);
      expect(e.code).toBe('promo_no_longer_valid');
      expect(e.reason).toBe('not_found_or_expired');
      expect(e.payload?.message).toContain('promo code');
    }
  });

  it('preserves status and code on generic non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal_error' }),
    });

    try {
      await createStripeCheckout('monthly', 'token', null);
      throw new Error('expected throw');
    } catch (e) {
      expect(e.status).toBe(500);
      expect(e.code).toBe('internal_error');
    }
  });

  it('returns parsed data on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_xyz' }),
    });
    const data = await createStripeCheckout('monthly', 'token', null);
    expect(data.checkoutUrl).toContain('checkout.stripe.com');
  });
});

describe('reactivateSubscription error surfacing', () => {
  let originalFetch;
  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('preserves status, code on 409 expired_must_recheckout', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'expired_must_recheckout',
        message: 'Subscription has already expired — please start a new checkout.',
        expiredAt: '2025-04-01T00:00:00Z',
      }),
    });

    try {
      await reactivateSubscription('token123');
      throw new Error('expected throw');
    } catch (e) {
      expect(e.status).toBe(409);
      expect(e.code).toBe('expired_must_recheckout');
      expect(e.payload?.expiredAt).toBe('2025-04-01T00:00:00Z');
    }
  });

  it('does not blow up when 409 body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => { throw new Error('not json'); },
    });

    try {
      await reactivateSubscription('token123');
      throw new Error('expected throw');
    } catch (e) {
      expect(e.status).toBe(409);
      expect(e.code).toBeUndefined();
    }
  });

  it('returns parsed data on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'reactivated' }),
    });
    const data = await reactivateSubscription('token123');
    expect(data.status).toBe('reactivated');
  });
});
