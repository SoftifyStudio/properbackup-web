import { describe, it, expect } from 'vitest';
import { decomposeGross, computePromoDiscount, computePlanPricing } from './pricing.js';

describe('decomposeGross — VAT invariant (P1-3)', () => {
  it('1900 grosze (19 PLN) gross at 23% → net+vat==gross', () => {
    const { netGrosze, vatGrosze } = decomposeGross(1900, 0.23);
    expect(netGrosze + vatGrosze).toBe(1900);
    expect(netGrosze).toBe(1545);
    expect(vatGrosze).toBe(355);
  });

  it('19000 grosze (190 PLN annual) gross at 23% → net+vat==gross', () => {
    const { netGrosze, vatGrosze } = decomposeGross(19000, 0.23);
    expect(netGrosze + vatGrosze).toBe(19000);
    expect(netGrosze).toBe(15447);
    expect(vatGrosze).toBe(3553);
  });

  it('matches backend exactly for the canonical 19 PLN brutto', () => {
    // Backend StripeHandler.decomposeGross(1900, 0.23) returns (1545, 355).
    // If the frontend ever diverges, the displayed VAT line will not match
    // what Stripe issues on the invoice — that's a P1 invariant break.
    const front = decomposeGross(1900, 0.23);
    expect(front).toEqual({ netGrosze: 1545, vatGrosze: 355 });
  });

  it('zero gross → zero VAT', () => {
    expect(decomposeGross(0, 0.23)).toEqual({ netGrosze: 0, vatGrosze: 0 });
  });

  it('zero VAT rate is idempotent', () => {
    expect(decomposeGross(1900, 0)).toEqual({ netGrosze: 1900, vatGrosze: 0 });
  });
});

describe('computePromoDiscount — integer arithmetic matches backend', () => {
  it('percent discount uses floor not round', () => {
    // 1900 * 50 / 100 = 950 exactly. Backend produces 950. Frontend MUST equal.
    expect(computePromoDiscount(1900, {
      valid: true, discountPercent: 50, applicablePlan: null,
    }, 'monthly')).toBe(950);
  });

  it('percent rounding edge: 33% of 1900 = 627 (floor, not round)', () => {
    // 1900 * 33 / 100 = 627.0 exactly. Both floor and round agree.
    // But 1900 * 25 / 100 = 475 — floor and round both 475. Boring.
    // Try: 19 * 0.33 = 6.27 floor=6 round=6. Try: 11 * 33 / 100 = 3.63 → floor=3, round=4.
    // The backend uses long division → 3. The frontend MUST match: 3.
    expect(computePromoDiscount(11, {
      valid: true, discountPercent: 33, applicablePlan: null,
    }, 'monthly')).toBe(3);
  });

  it('fixed-grosze discount returns the raw amount', () => {
    expect(computePromoDiscount(1900, {
      valid: true, discountGrosze: 500, applicablePlan: null,
    }, 'monthly')).toBe(500);
  });

  it('non-applicable plan returns 0', () => {
    expect(computePromoDiscount(1900, {
      valid: true, discountPercent: 50, applicablePlan: 'annual',
    }, 'monthly')).toBe(0);
  });

  it('invalid promo returns 0', () => {
    expect(computePromoDiscount(1900, { valid: false, discountPercent: 50 }, 'monthly')).toBe(0);
  });
});

describe('computePlanPricing — gross is server-authoritative', () => {
  it('no discount: gross == base, breakdown sums to gross', () => {
    const r = computePlanPricing({
      basePriceGrosze: 1900,
      netPriceGrosze: 1545,
      vatGrosze: 355,
      vatRate: 0.23,
      promoResult: null,
      planId: 'monthly',
    });
    expect(r.brutto).toBe(1900);
    expect(r.finalNet + r.finalVat).toBe(1900);
    expect(r.baseNet).toBe(1545);
    expect(r.baseVat).toBe(355);
    expect(r.hasDiscount).toBe(false);
  });

  it('prorated discount caps at base price', () => {
    const r = computePlanPricing({
      basePriceGrosze: 1900,
      proratedDiscountGrosze: 5000, // pathological — must be clamped
      vatRate: 0.23,
      planId: 'monthly',
    });
    expect(r.prorated).toBe(1900);
    expect(r.brutto).toBe(0);
    expect(r.finalNet + r.finalVat).toBe(0);
  });

  it('promo + prorated combine, final cannot go negative', () => {
    const r = computePlanPricing({
      basePriceGrosze: 1900,
      proratedDiscountGrosze: 1500,
      vatRate: 0.23,
      planId: 'monthly',
      promoResult: { valid: true, discountPercent: 50 },
    });
    // prorated 1500 + promo 950 = 2450 > 1900 → brutto clamped at 0.
    expect(r.brutto).toBe(0);
  });

  it('downgrade overflow credit is surfaced from the API', () => {
    const r = computePlanPricing({
      basePriceGrosze: 1900,
      proratedDiscountGrosze: 1900,
      overflowCreditGrosze: 8510, // backend: annual→monthly @ 200 days remaining
      vatRate: 0.23,
      planId: 'monthly',
    });
    expect(r.brutto).toBe(0);
    expect(r.overflowCredit).toBe(8510);
  });

  it('invariant: brutto == base - prorated - promo (clamped) for typical case', () => {
    const r = computePlanPricing({
      basePriceGrosze: 19000,
      proratedDiscountGrosze: 1225, // 20 days from monthly
      vatRate: 0.23,
      planId: 'annual',
      promoResult: { valid: true, discountPercent: 10 },
    });
    // promo = floor(19000 * 10 / 100) = 1900. brutto = 19000 - 1225 - 1900 = 15875.
    expect(r.prorated).toBe(1225);
    expect(r.promoDiscount).toBe(1900);
    expect(r.brutto).toBe(15875);
    expect(r.finalNet + r.finalVat).toBe(15875);
  });
});
