import React, { useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

const TIERS = [
  { id: 'S',  quota: 150,  monthlyPln: 29,  annualPln: 259  },
  { id: 'M',  quota: 300,  monthlyPln: 39,  annualPln: 349  },
  { id: 'L',  quota: 500,  monthlyPln: 59,  annualPln: 529  },
  { id: 'XL', quota: 1000, monthlyPln: 89,  annualPln: 790  },
];

const FEATURES = [
  'plans.featureUnlimitedDevices',
  'plans.featureQuotaGrows',
  'plans.featureZeroKnowledge',
  'plans.featureRestore',
  'plans.featureTimeTravel',
  'plans.featureSupport',
];

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 14 14" fill="none">
      <path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PlanSelector({ currentPlan, currentQuotaBytes, onCheckout }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [billing, setBilling] = useState('annual');
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');

  const handleCheckout = useCallback(async (tier) => {
    if (!token) return;
    setLoading(tier.id);
    setError('');
    try {
      const planId = `${tier.id.toLowerCase()}_${billing}`;
      const res = await fetch(`${BASE_URL}/account/checkout?plan=${planId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { checkoutUrl } = await res.json();
      window.open(checkoutUrl, '_blank');
      onCheckout?.(tier, billing);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }, [token, billing, onCheckout]);

  const annualSavings = (tier) => {
    const monthlyCost = tier.monthlyPln * 12;
    return monthlyCost - tier.annualPln;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-text1">{t('plans.selectPlan')}</h2>
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-border">
          <button
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
              billing === 'monthly'
                ? 'bg-panel text-accent shadow-sm border border-accent/20'
                : 'text-text3 hover:text-text2'
            }`}
            onClick={() => setBilling('monthly')}
          >
            {t('plans.monthly')}
          </button>
          <button
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              billing === 'annual'
                ? 'bg-panel text-accent shadow-sm border border-accent/20'
                : 'text-text3 hover:text-text2'
            }`}
            onClick={() => setBilling('annual')}
          >
            {t('plans.annual')}
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              {t('plans.save')}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map((tier) => {
          const price = billing === 'annual' ? tier.annualPln : tier.monthlyPln;
          const savings = annualSavings(tier);
          const isCurrent = currentPlan?.toUpperCase() === tier.id;
          const isPopular = tier.id === 'M';

          return (
            <div
              key={tier.id}
              className={`relative rounded-xl border bg-panel p-5 shadow-card transition-all hover:shadow-lg ${
                isPopular ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent/40'
              } ${isCurrent ? 'ring-2 ring-emerald-400/30 border-emerald-300' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold text-white bg-accent px-3 py-0.5 rounded-full shadow-sm">
                    {t('plans.popular')}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl font-black text-text1">{tier.id}</span>
                {isCurrent && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    {t('plans.currentBadge')}
                  </span>
                )}
              </div>

              <div className="mb-1">
                <span className="text-xs text-text4 uppercase tracking-wide">{t('plans.startQuota')}</span>
                <p className="text-lg font-bold text-text1">
                  {tier.quota >= 1000 ? `${tier.quota / 1000} TB` : `${tier.quota} GB`}
                </p>
              </div>

              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold text-accent">{price}</span>
                <span className="text-sm text-text3">
                  {t('plans.currency')} / {billing === 'annual' ? t('plans.yearShort') : t('plans.monthShort')}
                </span>
              </div>

              {billing === 'annual' && savings > 0 && (
                <p className="text-xs text-emerald-600 font-medium mb-3">
                  {t('plans.youSave', { amount: savings })}
                </p>
              )}

              {billing === 'monthly' && (
                <p className="text-[11px] text-text4 mb-3">
                  {t('plans.orAnnually', { price: tier.annualPln })}
                </p>
              )}

              <ul className="text-xs text-text3 space-y-1.5 mb-4">
                {FEATURES.map((featureKey) => (
                  <li key={featureKey} className="flex items-start gap-1.5">
                    <CheckIcon />
                    <span>{t(featureKey)}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 ${
                  isCurrent
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                    : 'bg-accent hover:bg-accent/90 text-white shadow-sm'
                }`}
                disabled={isCurrent || loading === tier.id}
                onClick={() => !isCurrent && handleCheckout(tier)}
              >
                {loading === tier.id
                  ? t('plans.redirecting')
                  : isCurrent
                    ? t('plans.currentPlan')
                    : t('plans.choosePlan')}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text4 text-center">
        {t('plans.quotaGrowsNote')}
      </p>
    </div>
  );
}
