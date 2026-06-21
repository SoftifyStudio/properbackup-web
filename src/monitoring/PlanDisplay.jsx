import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { fetchStorageQuota } from '../api/monitoringClient.js';
import { fetchSubscription } from '../api/bufferClient.js';

const PLANS = [
  { tier: 'S', storage: '150 GB', monthlyPln: 29, yearlyPln: 259 },
  { tier: 'M', storage: '300 GB', monthlyPln: 39, yearlyPln: 349 },
  { tier: 'L', storage: '500 GB', monthlyPln: 59, yearlyPln: 529 },
  { tier: 'XL', storage: '1 TB', monthlyPln: 89, yearlyPln: 790 },
];

function fmtBytes(n) {
  if (n >= 1099511627776) return `${(n / 1099511627776).toFixed(2)} TB`;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
  return `${n} B`;
}

export default function PlanDisplay() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [billing, setBilling] = useState('monthly');
  const [quota, setQuota] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [q, sub] = await Promise.all([
        fetchStorageQuota(token).catch(() => null),
        fetchSubscription(token).catch(() => null),
      ]);
      setQuota(q);
      setSubscription(sub);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const currentPlan = subscription?.plan || subscription?.subscriptionPlan;
  const pct = quota ? Math.min(quota.usedPercent || 0, 100) : 0;
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text1">{t('plans.title')}</h2>
          <p className="text-xs text-text4 mt-0.5">{t('plans.subtitle')}</p>
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-1 bg-surface rounded-lg p-1 border border-border w-fit mx-auto">
        <button
          className={`text-xs px-5 py-2 rounded-md transition-all font-medium ${
            billing === 'monthly' ? 'bg-panel text-accent shadow-sm border border-accent/20' : 'text-text3 hover:text-text2'
          }`}
          onClick={() => setBilling('monthly')}
        >
          {t('plans.monthly')}
        </button>
        <button
          className={`text-xs px-5 py-2 rounded-md transition-all font-medium ${
            billing === 'yearly' ? 'bg-panel text-accent shadow-sm border border-accent/20' : 'text-text3 hover:text-text2'
          }`}
          onClick={() => setBilling('yearly')}
        >
          {t('plans.yearly')}
          <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
            {t('plans.saveLabel')}
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrentTier = currentPlan && currentPlan.toUpperCase() === plan.tier;
          const price = billing === 'monthly' ? plan.monthlyPln : plan.yearlyPln;
          const period = billing === 'monthly' ? t('plans.perMonth') : t('plans.perYear');

          return (
            <div
              key={plan.tier}
              className={`relative rounded-xl border-2 p-5 transition-all ${
                isCurrentTier
                  ? 'border-accent bg-accent/5 shadow-lg shadow-accent/10'
                  : 'border-border bg-panel hover:border-accent/30 hover:shadow-md'
              }`}
            >
              {isCurrentTier && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                  {t('plans.current')}
                </div>
              )}

              <div className="text-center">
                <div className="text-2xl font-bold text-accent mb-1">{plan.tier}</div>
                <div className="text-sm font-medium text-text2">{plan.storage}</div>
              </div>

              <div className="text-center mt-4">
                <span className="text-3xl font-bold text-text1">{price}</span>
                <span className="text-sm text-text4 ml-1">{t('plans.currency')}</span>
                <div className="text-xs text-text4">{period}</div>
              </div>

              <div className="mt-4 space-y-2 text-xs text-text3">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.485 1.929a.75.75 0 010 1.06l-7.07 7.072a.75.75 0 01-1.061 0L2.515 7.222a.75.75 0 011.06-1.06l2.132 2.132 6.54-6.54a.75.75 0 011.06 0z" />
                  </svg>
                  {t('plans.unlimitedDevices')}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.485 1.929a.75.75 0 010 1.06l-7.07 7.072a.75.75 0 01-1.061 0L2.515 7.222a.75.75 0 011.06-1.06l2.132 2.132 6.54-6.54a.75.75 0 011.06 0z" />
                  </svg>
                  {t('plans.encryption')}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.485 1.929a.75.75 0 010 1.06l-7.07 7.072a.75.75 0 01-1.061 0L2.515 7.222a.75.75 0 011.06-1.06l2.132 2.132 6.54-6.54a.75.75 0 011.06 0z" />
                  </svg>
                  {t('plans.instantRestore')}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.485 1.929a.75.75 0 010 1.06l-7.07 7.072a.75.75 0 01-1.061 0L2.515 7.222a.75.75 0 011.06-1.06l2.132 2.132 6.54-6.54a.75.75 0 011.06 0z" />
                  </svg>
                  {t('plans.maxQuota')}
                </div>
                {billing === 'monthly' && (
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.485 1.929a.75.75 0 010 1.06l-7.07 7.072a.75.75 0 01-1.061 0L2.515 7.222a.75.75 0 011.06-1.06l2.132 2.132 6.54-6.54a.75.75 0 011.06 0z" />
                    </svg>
                    {t('plans.growthMonthly')}
                  </div>
                )}
                {billing === 'yearly' && (
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.485 1.929a.75.75 0 010 1.06l-7.07 7.072a.75.75 0 01-1.061 0L2.515 7.222a.75.75 0 011.06-1.06l2.132 2.132 6.54-6.54a.75.75 0 011.06 0z" />
                    </svg>
                    {t('plans.fullQuotaImmediate')}
                  </div>
                )}
              </div>

              {!isCurrentTier && (
                <button className="w-full mt-4 btn-primary text-xs py-2.5 font-semibold">
                  {t('plans.select')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Quota bar */}
      {quota && (
        <div className="bg-panel border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text2">{t('quota.currentUsage')}</span>
            <span className="text-sm font-semibold text-text1">
              {fmtBytes(quota.usedBytes)} / {fmtBytes(quota.limitBytes)}
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.max(pct, 0.5)}%` }} />
          </div>
          <p className="text-[11px] text-text4 mt-2">{t('quota.devicesHint')}</p>
        </div>
      )}
    </div>
  );
}
