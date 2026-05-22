import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import AppHeader from '../layout/AppHeader.jsx';
import PromoCodePanel from './PromoCodePanel.jsx';
import { createStripeCheckout } from '../api/bufferClient.js';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE_URL = bufferBaseUrl();

function formatGrosze(grosze) {
  return (grosze / 100).toFixed(2);
}

export default function SubscriptionPage({ onBack }) {
  const { token, updateSubscriptionPlan } = useAuth();
  const { t } = useI18n();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stripeSuccess, setStripeSuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [promoResult, setPromoResult] = useState(null);
  const isInitialLoad = useRef(true);

  const loadSub = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/account/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSub(data);
    } catch (e) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoading(false);
      isInitialLoad.current = false;
    }
  }, [token]);

  useEffect(() => {
    if (sub?.plan && sub.plan !== 'trial' && sub.plan !== 'none') {
      updateSubscriptionPlan(sub.plan);
    }
  }, [sub?.plan]);

  useEffect(() => { loadSub(); }, [loadSub]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'success') {
      setStripeSuccess(true);
      loadSub(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('stripe') === 'cancelled') {
      setError(t('subscription.stripeCancelled'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const calcPlanPrice = (planId) => {
    if (!sub?.pricing) return null;
    const p = planId === 'annual' ? sub.pricing.annual : sub.pricing.monthly;
    if (!p) return null;
    const base = p.basePriceGrosze;
    const prorated = p.proratedDiscountGrosze || 0;

    let promoDiscount = 0;
    if (promoResult?.valid) {
      const applicablePlan = promoResult.applicablePlan;
      if (!applicablePlan || applicablePlan === planId) {
        if (promoResult.discountPercent) {
          promoDiscount = Math.round(base * promoResult.discountPercent / 100);
        } else if (promoResult.discountGrosze) {
          promoDiscount = promoResult.discountGrosze;
        }
      }
    }

    const final_ = Math.max(0, base - prorated - promoDiscount);
    return { base, prorated, promoDiscount, final: final_ };
  };

  const handleStripeCheckout = async (planId) => {
    setCheckoutLoading(planId);
    setError('');
    try {
      const code = promoResult?.valid ? promoResult.code : undefined;
      const { checkoutUrl } = await createStripeCheckout(planId, token, code);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (e) {
      setError(e.message);
      setCheckoutLoading(null);
    }
  };

  const statusBadge = (status) => {
    const map = {
      trial: 'bg-blue-100 text-blue-700',
      active: 'bg-emerald-100 text-emerald-700',
      expired: 'bg-red-100 text-red-700',
      trial_expired: 'bg-red-100 text-red-700',
      pending_payment: 'bg-amber-100 text-amber-700',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  const isTestMode = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STRIPE_TEST_MODE === 'true')
    || BASE_URL.includes('localhost')
    || BASE_URL.includes('staging');

  const renderPlanCard = (planId, nameKey, descKey, period, highlight) => {
    const price = calcPlanPrice(planId);
    const hasDiscount = price && (price.prorated > 0 || price.promoDiscount > 0);

    return (
      <div className={`rounded-xl ${highlight ? 'border-2 border-accent' : 'border border-border'} bg-panel p-5 shadow-card ${highlight ? 'relative' : 'hover:border-accent/40'} transition-colors`}>
        {highlight && (
          <div className="absolute -top-3 right-4 bg-accent text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
            {t('subscription.bestValue')}
          </div>
        )}
        <h3 className="text-base font-bold text-text1 mb-1">{t(nameKey)}</h3>

        {/* Price display */}
        <div className="mb-3">
          {hasDiscount ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-lg text-text4 line-through">{formatGrosze(price.base)} PLN</span>
                <span className="text-2xl font-bold text-emerald-600">{formatGrosze(price.final)} PLN</span>
              </div>
              <span className="text-xs text-text3">/ {t(`subscription.${period}`)}</span>
              <div className="mt-1 space-y-0.5">
                {price.prorated > 0 && (
                  <p className="text-xs text-text3">
                    {t('subscription.proratedDiscount', { amount: formatGrosze(price.prorated), days: sub.daysRemaining })}
                  </p>
                )}
                {price.promoDiscount > 0 && (
                  <p className="text-xs text-emerald-600 font-medium">
                    {t('subscription.promoDiscount', { amount: formatGrosze(price.promoDiscount), code: promoResult?.code })}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-accent">{price ? formatGrosze(price.base) : '—'}</span>
                <span className="text-sm text-text3">PLN / {t(`subscription.${period}`)}</span>
              </div>
            </>
          )}
        </div>

        {highlight && <p className="text-xs text-emerald-600 font-semibold mb-3">{t('subscription.annualSaving')}</p>}
        <p className="text-sm text-text3 mb-4">{t(descKey)}</p>

        <ul className="text-xs text-text3 space-y-1.5 mb-5">
          {['featureEncryption', 'featureRestore', 'featureSupport'].map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 14 14" fill="currentColor">
                <path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t(`subscription.${f}`)}
            </li>
          ))}
        </ul>

        <button
          className="w-full py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          disabled={checkoutLoading === planId}
          onClick={() => handleStripeCheckout(planId)}
        >
          {checkoutLoading === planId ? t('subscription.redirecting') : t('subscription.selectAndPay')}
        </button>
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface overflow-hidden">
      <AppHeader onBack={onBack} backLabel={t('subscription.back')}>
        <span className="text-sm font-semibold text-text1">{t('subscription.title')}</span>
      </AppHeader>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-8 max-w-3xl w-full mx-auto">
        {/* Stripe sandbox banner */}
        {isTestMode && (
          <div className="px-4 py-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{t('subscription.testModeBanner')}</span>
          </div>
        )}

        {loading && isInitialLoad.current && (
          <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            {t('subscription.loading')}
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {stripeSuccess && (
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm mb-6">
            {t('subscription.stripeSuccess')}
          </div>
        )}

        {sub && !(loading && isInitialLoad.current) && (
          <div className="space-y-8">
            {/* Current status */}
            <div className="rounded-xl border border-border bg-panel p-6 shadow-card">
              <h2 className="text-lg font-bold text-text1 mb-4">{t('subscription.currentPlan')}</h2>
              <div className="flex items-center gap-3 mb-4">
                <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${statusBadge(sub.status)}`}>
                  {t(`subscription.status.${sub.status}`)}
                </span>
                {sub.plan && sub.plan !== 'none' && (
                  <span className="text-sm text-text2">
                    {sub.plan === 'trial' ? t('subscription.trialPlan') : sub.plan?.toUpperCase()}
                  </span>
                )}
              </div>

              {sub.status === 'pending_payment' && (
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm mb-4">
                  {t('subscription.pendingPaymentHint')}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text4 text-xs uppercase tracking-wide">{t('subscription.daysRemaining')}</span>
                  <p className="text-text1 font-semibold text-lg mt-0.5">{sub.daysRemaining}</p>
                </div>
                <div>
                  <span className="text-text4 text-xs uppercase tracking-wide">{t('subscription.storageLimit')}</span>
                  <p className="text-text1 font-semibold text-lg mt-0.5">{sub.storageLimitLabel}</p>
                </div>
              </div>

              {/* Storage usage bar */}
              {sub.storageUsedBytes != null && (
                <div className="mt-5 pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-text3 mb-1.5">
                    <span>{t('subscription.storageUsed')}</span>
                    <span className={sub.storageExceeded ? 'text-red-600 font-semibold' : ''}>
                      {sub.storageUsedLabel} / {sub.storageLimitLabel}
                      {' '}({(sub.storageUsedPercent || 0).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        sub.storageExceeded ? 'bg-red-500' :
                        (sub.storageUsedPercent || 0) > 80 ? 'bg-amber-500' :
                        'bg-accent'
                      }`}
                      style={{ width: `${Math.min(100, sub.storageUsedPercent || 0)}%` }}
                    />
                  </div>
                  {sub.storageExceeded && (
                    <p className="text-xs text-red-600 mt-1.5 font-medium">
                      {t('subscription.storageExceeded')}
                    </p>
                  )}
                </div>
              )}

              {sub.trialExpiresAt && sub.status === 'trial' && (
                <p className="text-xs text-text4 mt-4">
                  {t('subscription.trialExpires', { date: new Date(sub.trialExpiresAt).toLocaleDateString() })}
                </p>
              )}
            </div>

            {/* Promo code panel */}
            <PromoCodePanel onValidated={setPromoResult} />

            {/* Plans — Stripe Checkout */}
            <div>
              <h2 className="text-lg font-bold text-text1 mb-4">{t('subscription.availablePlans')}</h2>
              <p className="text-sm text-text3 mb-4">{t('subscription.paymentHint')}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {renderPlanCard('monthly', 'subscription.planMonthly', 'subscription.planMonthlyDesc', 'month', false)}
                {renderPlanCard('annual', 'subscription.planAnnual', 'subscription.planAnnualDesc', 'year', true)}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
