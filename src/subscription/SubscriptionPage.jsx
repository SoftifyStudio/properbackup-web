import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import AppHeader from '../layout/AppHeader.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE_URL = bufferBaseUrl();

export default function SubscriptionPage({ onBack }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSub = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/account/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSub(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadSub(); }, [loadSub]);

  const statusBadge = (status) => {
    const map = {
      trial: 'bg-blue-100 text-blue-700',
      active: 'bg-emerald-100 text-emerald-700',
      expired: 'bg-red-100 text-red-700',
      trial_expired: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface overflow-hidden">
      <AppHeader onBack={onBack} backLabel={t('subscription.back')}>
        <span className="text-sm font-semibold text-text1">{t('subscription.title')}</span>
      </AppHeader>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-8 max-w-3xl w-full mx-auto">
        {loading && (
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

        {sub && !loading && (
          <div className="space-y-8">
            {/* Current status */}
            <div className="rounded-xl border border-border bg-panel p-6 shadow-card">
              <h2 className="text-lg font-bold text-text1 mb-4">{t('subscription.currentPlan')}</h2>
              <div className="flex items-center gap-3 mb-4">
                <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${statusBadge(sub.status)}`}>
                  {t(`subscription.status.${sub.status}`)}
                </span>
                <span className="text-sm text-text2">
                  {sub.plan === 'trial' ? t('subscription.trialPlan') : sub.plan?.toUpperCase()}
                </span>
              </div>

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

            {/* Plans */}
            <div>
              <h2 className="text-lg font-bold text-text1 mb-4">{t('subscription.availablePlans')}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {(sub.plans || []).map(plan => (
                  <div key={plan.id} className="rounded-xl border border-border bg-panel p-5 shadow-card hover:border-accent/40 transition-colors">
                    <h3 className="text-base font-bold text-text1 mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-accent">{'$'}{plan.priceUsd}</span>
                      <span className="text-sm text-text3">/ {t('subscription.year')}</span>
                    </div>
                    <p className="text-sm text-text3 mb-4">
                      {t('subscription.storageIncluded', { limit: plan.storageLimitLabel })}
                    </p>
                    <ul className="text-xs text-text3 space-y-1.5 mb-5">
                      <li className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 14 14" fill="currentColor"><path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {t('subscription.featureEncryption')}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 14 14" fill="currentColor"><path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {t('subscription.featureRestore')}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 14 14" fill="currentColor"><path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {t('subscription.featureSupport')}
                      </li>
                    </ul>
                    <button
                      className="w-full py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors"
                      onClick={() => {/* Lemon Squeezy checkout - przyszła integracja */}}
                    >
                      {t('subscription.selectPlan')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
