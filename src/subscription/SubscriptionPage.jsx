import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import AppHeader from '../layout/AppHeader.jsx';
import PromoCodePanel from './PromoCodePanel.jsx';
import Toast from './Toast.jsx';
import { createStripeCheckout, fetchCardInfo, cancelSubscription, reactivateSubscription, verifyStripeSession } from '../api/bufferClient.js';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { computePlanPricing } from './pricing.js';

const BASE_URL = bufferBaseUrl();
const DEFAULT_VAT_RATE = 0.23;

function formatGrosze(grosze) {
  return (grosze / 100).toFixed(2);
}

function PaymentCardSection({ cardInfo, onAddCard, onChangeCard, isTestMode, t }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <h3 className="text-base font-bold text-text1">{t('subscription.paymentMethod')}</h3>
      </div>
      {cardInfo?.hasCard ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-md">
              <span className="text-white text-[10px] font-bold uppercase">{cardInfo.brand || t('subscription.cardBrand')}</span>
            </div>
            <div>
              <p className="text-sm font-mono text-text1 tracking-wider">•••• •••• •••• {cardInfo.last4}</p>
              <p className="text-xs text-text3">
                {t('subscription.cardExpires', { date: `${String(cardInfo.expMonth).padStart(2, '0')}/${cardInfo.expYear}` })}
              </p>
              {isTestMode && (
                <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-amber-100 text-amber-700 border border-amber-300 rounded">
                  Test Mode
                </span>
              )}
            </div>
          </div>
          <button
            className="px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors"
            onClick={onChangeCard}
          >
            {t('subscription.changeCard')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text3">{t('subscription.noCardAttached')}</p>
            {isTestMode && (
              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-amber-100 text-amber-700 border border-amber-300 rounded">
                Test Mode
              </span>
            )}
          </div>
          <button
            className="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors"
            onClick={onAddCard}
          >
            {t('subscription.addCard')}
          </button>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  planId, name, desc, period, isActive, cancelledButActive,
  pricing, promoResult, vatRate, checkoutLoading,
  onCheckout, onCancel, onRenew, t,
  hideActions = false,
}) {
  // basePriceGrosze is GROSS (brutto, VAT-inclusive). This is what Stripe charges.
  // The displayed brutto MUST match Stripe's charge — otherwise we violate consumer protection.
  // All math is delegated to ./pricing.js so it's unit-tested independently of React.
  const {
    base, prorated, promoDiscount, brutto,
    baseNet, baseVat, finalNet: finalNetto, finalVat: vatAmount,
    overflowCredit, hasDiscount,
  } = computePlanPricing({
    basePriceGrosze: pricing.basePriceGrosze,
    proratedDiscountGrosze: pricing.proratedDiscountGrosze,
    overflowCreditGrosze: pricing.overflowCreditGrosze,
    netPriceGrosze: pricing.netPriceGrosze,
    vatGrosze: pricing.vatGrosze,
    vatRate,
    promoResult,
    planId,
  });

  const borderClass = isActive
    ? 'border-2 border-accent bg-accent/[0.08] shadow-lg shadow-accent/15 ring-1 ring-accent/20'
    : 'border border-border hover:border-accent/40';

  return (
    <div className={`rounded-xl ${borderClass} ${isActive ? '' : 'bg-panel'} p-5 shadow-card ${isActive ? 'relative' : ''} transition-colors`}>
      {isActive && (
        <div className="absolute -top-3 left-4 bg-accent text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
          {t('subscription.activePlan')}
        </div>
      )}

      <h3 className="text-base font-bold text-text1 mb-1">{name}</h3>

      <div className="mb-3">
        {hasDiscount ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-base text-text4 line-through">{formatGrosze(base)} {t('subscription.currency')}</span>
              <span className="text-xs text-text4">{t('subscription.bruttoShort')}</span>
            </div>
            <span className="text-xs text-text3">/ {period}</span>

            <div className="mt-2 pt-2 border-t border-border/50 space-y-1 text-xs">
              {prorated > 0 && (
                <div className="flex justify-between">
                  <span className="text-text3">{t('subscription.proratedDiscount', { days: pricing.daysRemaining || 0, amount: formatGrosze(prorated) })}</span>
                  <span className="text-text2">-{formatGrosze(prorated)} {t('subscription.currency')}</span>
                </div>
              )}
              {promoDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-emerald-600">{t('subscription.promoDiscount', { code: promoResult?.code, amount: formatGrosze(promoDiscount) })}</span>
                  <span className="text-emerald-600">-{formatGrosze(promoDiscount)} {t('subscription.currency')}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-border/50">
                <span className="font-semibold text-text1">{t('subscription.bruttoLabel')}</span>
                <span className="font-bold text-emerald-600 text-sm">{formatGrosze(brutto)} {t('subscription.currency')}</span>
              </div>
              <div className="text-[11px] text-text3">
                {t('subscription.bruttoIncludesVat', { net: formatGrosze(finalNetto), vat: formatGrosze(vatAmount), rate: Math.round(vatRate * 100) })}
              </div>
              {overflowCredit > 0 && (
                <div className="flex justify-between pt-1 border-t border-border/50 text-emerald-700">
                  <span>{t('subscription.overflowCredit', { amount: formatGrosze(overflowCredit) })}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-accent">{formatGrosze(base)}</span>
              <span className="text-sm text-text3">{t('subscription.currency')} {t('subscription.bruttoShort')} / {period}</span>
            </div>
            <div className="text-xs text-text3 mt-0.5">
              {t('subscription.bruttoIncludesVat', { net: formatGrosze(baseNet), vat: formatGrosze(baseVat), rate: Math.round(vatRate * 100) })}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-text3 mb-3">{desc}</p>

      <ul className="text-xs text-text3 space-y-1 mb-4">
        {['featureEncryption', 'featureRestore', 'featureSupport'].map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 14 14" fill="none">
              <path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t(`subscription.${f}`)}
          </li>
        ))}
      </ul>

      {!hideActions && (
        isActive ? (
          <div className="flex gap-2">
            {!cancelledButActive && (
              <button
                className="flex-1 py-2 border border-red-300 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors"
                onClick={onCancel}
              >
                {t('subscription.cancelRenewal')}
              </button>
            )}
            <button
              className={`${cancelledButActive ? 'w-full' : 'flex-1'} py-2 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-lg transition-colors`}
              onClick={onRenew}
            >
              {cancelledButActive ? t('subscription.reactivate') : t('subscription.renewNow')}
            </button>
          </div>
        ) : (
          <button
            className="w-full py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            disabled={checkoutLoading === planId}
            onClick={() => onCheckout(planId)}
          >
            {checkoutLoading === planId ? t('subscription.redirecting') : t('subscription.selectAndPay')}
          </button>
        )
      )}
    </div>
  );
}

export default function SubscriptionPage({ onBack }) {
  const { token, updateSubscriptionPlan } = useAuth();
  const { t, formatDateTime } = useI18n();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [stripeSuccess, setStripeSuccess] = useState(false);

  const addToast = useCallback((message, type = 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [promoResult, setPromoResult] = useState(null);
  const [cardInfo, setCardInfo] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const isInitialLoad = useRef(true);

  const loadSub = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/account/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSub(data);
    } catch (e) {
      if (!silent) addToast(e.message, 'error');
    } finally {
      if (!silent) setLoading(false);
      isInitialLoad.current = false;
    }
  }, [token]);

  const loadCardInfo = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchCardInfo(token);
      setCardInfo(data);
    } catch {
      setCardInfo({ hasCard: false });
    }
  }, [token]);

  useEffect(() => {
    if (sub?.plan && sub.plan !== 'trial' && sub.plan !== 'none') {
      updateSubscriptionPlan(sub.plan);
    }
  }, [sub?.plan]);

  useEffect(() => {
    if (sub && selectedTab === null) {
      const active = sub?.status === 'active' ? sub.plan : null;
      setSelectedTab(active || 'monthly');
    }
  }, [sub]);

  useEffect(() => { loadSub(); loadCardInfo(); }, [loadSub, loadCardInfo]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'success') {
      const sid = params.get('session_id');
      setStripeSuccess(true);
      addToast(t('subscription.stripeSuccess'), 'success');
      window.history.replaceState({}, '', window.location.pathname);
      if (sid && token) {
        verifyStripeSession(sid, token)
          .then(() => { loadSub(true); loadCardInfo(); })
          .catch((e) => { console.warn('verify-session failed:', e); loadSub(true); loadCardInfo(); });
      } else {
        loadSub(true);
        loadCardInfo();
      }
    }
    if (params.get('stripe') === 'cancelled') {
      addToast(t('subscription.stripeCancelled'), 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const vatRate = sub?.vatRate ?? DEFAULT_VAT_RATE;
  // Test mode flag is server-authoritative ONLY. Previously we OR-ed in URL heuristics
  // (localhost / 'staging' substring) and a Vite env var — those leaked the test badge into
  // production whenever the URL or env happened to match. The backend reports stripeMode
  // from STRIPE_MODE (test|live); trust that and only that.
  const isTestMode = sub?.stripeMode === 'test';

  const isActiveSub = sub?.status === 'active';
  const activePlanId = isActiveSub ? sub.plan : null;
  const isCancelledButActive = isActiveSub && sub?.cancelAtPeriodEnd;

  const handleStripeCheckout = async (planId) => {
    setCheckoutLoading(planId);
    try {
      const code = promoResult?.valid ? promoResult.code : undefined;
      const { checkoutUrl } = await createStripeCheckout(planId, token, code);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (e) {
      // Map server-side rejection reasons to user-friendly toasts. Without this the user
      // sees a raw "promo_no_longer_valid" string when the promo expired between validation
      // and checkout (server-side race fix on the buffer).
      if (e.status === 410 && e.code === 'promo_no_longer_valid') {
        addToast(t('subscription.promoNoLongerValid') || 'Promo code is no longer valid — please re-enter it.', 'error');
      } else {
        addToast(e.message, 'error');
      }
      setCheckoutLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      await cancelSubscription(token);
      addToast(t('subscription.cancelSuccess'), 'success');
      await loadSub(true);
    } catch (e) {
      addToast(t('subscription.cancelError'), 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleRenewSubscription = async () => {
    if (isCancelledButActive) {
      setCancelLoading(true);
      try {
        await reactivateSubscription(token);
        addToast(t('subscription.reactivateSuccess'), 'success');
        await loadSub(true);
      } catch (e) {
        // If the buffer responds 409 expired_must_recheckout the in-place flag-flip is no
        // longer possible (Stripe sub already canceled or DB expiry has passed). Redirect the
        // user back through Stripe Checkout to start a fresh subscription instead of leaving
        // them with a vague error toast. See P2-12.
        if (e.status === 409 && e.code === 'expired_must_recheckout' && sub?.plan) {
          addToast(t('subscription.reactivateExpiredRedirect') || 'Your subscription has already ended — starting a fresh checkout…', 'info');
          setCancelLoading(false);
          handleStripeCheckout(sub.plan);
          return;
        }
        addToast(t('subscription.renewError'), 'error');
      } finally {
        setCancelLoading(false);
      }
    } else if (activePlanId) {
      handleStripeCheckout(activePlanId);
    }
  };

  const handleAddCard = () => {
    handleStripeCheckout('monthly');
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

  const planLabel = () => {
    if (!sub) return '';
    if (sub.plan === 'trial') return t('subscription.trialPlan');
    if (sub.plan === 'monthly') return t('subscription.planMonthly');
    if (sub.plan === 'annual') return t('subscription.planAnnual');
    return sub.plan?.toUpperCase() || '';
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface overflow-hidden">
      <AppHeader onBack={onBack} backLabel={t('subscription.back')}>
        <span className="text-sm font-semibold text-text1">{t('subscription.title')}</span>
      </AppHeader>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="w-full px-6 py-6">


          {loading && isInitialLoad.current && (
            <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              {t('subscription.loading')}
            </div>
          )}

          {sub && !(loading && isInitialLoad.current) && (
            <>
              {/* Current plan — full width */}
              <div className="rounded-xl border border-border bg-panel p-6 shadow-card mb-6">
                <h2 className="text-lg font-bold text-text1 mb-4">{t('subscription.currentPlan')}</h2>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${statusBadge(sub.status)}`}>
                    {t(`subscription.status.${sub.status}`)}
                  </span>
                  <span className="text-sm text-text2">{planLabel()}</span>
                </div>

                {sub.status === 'pending_payment' && (
                  <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm mb-4">
                    {t('subscription.pendingPaymentHint')}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-text4 text-xs uppercase tracking-wide">{t('subscription.daysRemaining')}</span>
                    <p className="text-text1 font-semibold text-lg mt-0.5">{sub.daysRemaining}</p>
                  </div>
                  <div>
                    <span className="text-text4 text-xs uppercase tracking-wide">{t('subscription.storageLimit')}</span>
                    <p className="text-text1 font-semibold text-lg mt-0.5">{sub.storageLimitLabel}</p>
                  </div>
                  <div>
                    <span className="text-text4 text-xs uppercase tracking-wide">{t('subscription.storageUsage')}</span>
                    <p className="text-text1 font-semibold text-lg mt-0.5">{sub.storageUsedLabel}</p>
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
                {sub.subscriptionExpiresAt && isActiveSub && (
                  <p className="text-xs text-text4 mt-4">
                    {t('subscription.planExpires', { date: new Date(sub.subscriptionExpiresAt).toLocaleDateString() })}
                    {isCancelledButActive && (
                      <span className="ml-2 text-amber-600 font-medium">
                        ({t('subscription.cancelledNotRenewing')})
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/*
                Stripe customer balance — credit accrued from previous downgrades or manual
                adjustments. Stripe auto-applies this to the next invoice. We surface it as
                explicit, persistent UI so the user doesn't have to dig through Stripe's
                hosted invoice / dashboard to find out. Backend resolves out of Stripe
                Customer.retrieve(...).getBalance(); 0 when no Stripe customer or blank key.
              */}
              {(sub.customerBalanceCreditGrosze ?? 0) > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-card mb-6 flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                    +
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-emerald-800">
                      {t('subscription.customerBalanceTitle', {
                        amount: formatGrosze(sub.customerBalanceCreditGrosze),
                      })}
                    </p>
                    <p className="text-emerald-700 text-xs mt-0.5">
                      {t('subscription.customerBalanceHint')}
                    </p>
                  </div>
                </div>
              )}

              {/* 2-column layout: left = plans (in panel), right (wider 460px) = payment + promo */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-6">
                {/* LEFT column: Available plans */}
                <div className="rounded-xl border border-border bg-panel p-6 shadow-card">
                  <h2 className="text-lg font-bold text-text1 mb-1">{t('subscription.availablePlans')}</h2>
                  <p className="text-sm text-text3 mb-4">{t('subscription.selectPlanHint')}</p>

                  {/* Plan tabs */}
                  <div className="flex border-b border-border mb-5">
                    {['monthly', 'annual'].map((tab) => {
                      const isTabActive = selectedTab === tab;
                      const isThisPlanActive = activePlanId === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${
                            isTabActive
                              ? 'text-accent border-b-2 border-accent'
                              : 'text-text3 hover:text-text2 hover:bg-surface/50'
                          }`}
                          onClick={() => { setSelectedTab(tab); setConsentChecked(false); }}
                        >
                          {t(`subscription.plan${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
                          {isThisPlanActive && (
                            <span className="ml-1.5 text-[9px] font-bold uppercase bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">
                              {t('subscription.activePlan')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected plan details */}
                  {selectedTab && (
                    <>
                      <PlanCard
                        planId={selectedTab}
                        name={t(`subscription.plan${selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)}`)}
                        desc={t(`subscription.plan${selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)}Desc`)}
                        period={selectedTab === 'monthly' ? t('subscription.month') : t('subscription.year')}
                        isActive={activePlanId === selectedTab}
                        cancelledButActive={activePlanId === selectedTab && isCancelledButActive}
                        pricing={{ ...sub.pricing[selectedTab], daysRemaining: sub.daysRemaining }}
                        promoResult={promoResult}
                        vatRate={vatRate}
                        checkoutLoading={checkoutLoading}
                        onCheckout={handleStripeCheckout}
                        onCancel={handleCancelSubscription}
                        onRenew={handleRenewSubscription}
                        t={t}
                        hideActions
                      />

                      {/* Consent checkbox */}
                      <label className="flex items-start gap-3 mt-5 p-4 rounded-xl border border-border bg-surface cursor-pointer select-none group hover:border-accent/30 transition-colors">
                        <input
                          type="checkbox"
                          className="mt-0.5 w-5 h-5 min-w-[1.25rem] accent-accent rounded"
                          checked={consentChecked}
                          onChange={(e) => setConsentChecked(e.target.checked)}
                        />
                        <span className="text-xs text-text3 leading-relaxed">
                          {t('subscription.consentCheckbox')}
                        </span>
                      </label>

                      {/* Action buttons */}
                      <div className="mt-4">
                        {activePlanId === selectedTab ? (
                          <div className="flex gap-2">
                            {!isCancelledButActive && (
                              <button
                                className="flex-1 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors"
                                onClick={handleCancelSubscription}
                              >
                                {t('subscription.cancelRenewal')}
                              </button>
                            )}
                            <button
                              className={`${isCancelledButActive ? 'w-full' : 'flex-1'} py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors`}
                              onClick={handleRenewSubscription}
                            >
                              {isCancelledButActive ? t('subscription.reactivate') : t('subscription.renewNow')}
                            </button>
                          </div>
                        ) : (
                          <button
                            className="w-full py-3 bg-accent text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90"
                            disabled={!consentChecked || checkoutLoading === selectedTab}
                            onClick={() => handleStripeCheckout(selectedTab)}
                          >
                            {checkoutLoading === selectedTab ? t('subscription.redirecting') : t('subscription.selectAndPay')}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* RIGHT column (wider): Payment method + Promo code */}
                <div className="space-y-6">
                  <PaymentCardSection
                    cardInfo={cardInfo}
                    onAddCard={handleAddCard}
                    onChangeCard={handleAddCard}
                    isTestMode={isTestMode}
                    t={t}
                  />
                  <PromoCodePanel onValidated={setPromoResult} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <Toast key={toast.id} id={toast.id} message={toast.message} type={toast.type} onClose={removeToast} />
        ))}
      </div>
    </div>
  );
}
