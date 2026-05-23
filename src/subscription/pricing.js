// Pure pricing helpers used by SubscriptionPage. Mirrors the backend contract in
// pl.danielniemiec.properbackup.buffer.payment.StripeHandler so the UI breakdown is
// always invariant with what Stripe actually charges.
//
// Invariants enforced here:
//   1. base price is GROSS (brutto, VAT-inclusive).
//   2. final brutto displayed == Stripe charge == base - prorated - promo (clamped to 0).
//   3. net + vat == brutto (no rounding gap).
//   4. promo percentage uses integer division (Math.floor) to match
//      PromoCodeHandler.calculateDiscount on the backend.

export function decomposeGross(grossGrosze, vatRate) {
  if (grossGrosze <= 0 || vatRate <= 0) {
    return { netGrosze: grossGrosze, vatGrosze: 0 };
  }
  const netGrosze = Math.round(grossGrosze / (1 + vatRate));
  const vatGrosze = grossGrosze - netGrosze;
  return { netGrosze, vatGrosze };
}

export function computePromoDiscount(baseGrosze, promoResult, planId) {
  if (!promoResult?.valid) return 0;
  const applicablePlan = promoResult.applicablePlan;
  if (applicablePlan && applicablePlan !== planId) return 0;
  if (promoResult.discountPercent) {
    // Integer division — matches backend (Kotlin Long / Long).
    return Math.floor((baseGrosze * promoResult.discountPercent) / 100);
  }
  if (promoResult.discountGrosze) {
    return promoResult.discountGrosze;
  }
  return 0;
}

export function computePlanPricing({
  basePriceGrosze,
  proratedDiscountGrosze = 0,
  overflowCreditGrosze = 0,
  netPriceGrosze,
  vatGrosze,
  vatRate,
  promoResult,
  planId,
}) {
  const base = basePriceGrosze;
  const prorated = Math.min(Math.max(0, proratedDiscountGrosze), base);
  const promoDiscount = computePromoDiscount(base, promoResult, planId);
  const brutto = Math.max(0, base - prorated - promoDiscount);

  const baseDecomp = decomposeGross(base, vatRate);
  const baseNet = netPriceGrosze ?? baseDecomp.netGrosze;
  const baseVat = vatGrosze ?? baseDecomp.vatGrosze;

  const finalDecomp = decomposeGross(brutto, vatRate);
  return {
    base,
    prorated,
    promoDiscount,
    brutto,
    baseNet,
    baseVat,
    finalNet: finalDecomp.netGrosze,
    finalVat: finalDecomp.vatGrosze,
    overflowCredit: Math.max(0, overflowCreditGrosze),
    hasDiscount: prorated > 0 || promoDiscount > 0,
  };
}
