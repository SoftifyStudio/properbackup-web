import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import AppHeader from '../layout/AppHeader.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { fetchSubscription } from '../api/bufferClient.js';
import { bufferBaseUrl } from '../bufferConfig.js';
import StorageQuotaDashboard from './StorageQuotaDashboard.jsx';
import PlanSelector from './PlanSelector.jsx';

const BASE_URL = bufferBaseUrl();

export default function PlansPage({ onBack }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [sub, setSub] = useState(null);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const planSectionRef = useRef(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [subData, storageRes] = await Promise.all([
        fetchSubscription(token),
        fetch(`${BASE_URL}/account/storage`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      setSub(subData);
      setStorage(storageRes);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const scrollToPlans = useCallback(() => {
    planSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const quota = sub ? {
    storageUsedBytes: sub.storageUsedBytes ?? storage?.usedBytes ?? 0,
    storageLimitBytes: sub.storageLimitBytes ?? storage?.limitBytes ?? 0,
    dailyGrowthBytes: null,
    quotaGrowthPerMonth: 150 * 1024 * 1024 * 1024,
  } : null;

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface overflow-hidden">
      <AppHeader onBack={onBack} backLabel={t('plans.back')}>
        <span className="text-sm font-semibold text-text1">{t('plans.title')}</span>
      </AppHeader>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-8 max-w-4xl w-full mx-auto">
        {loading && (
          <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            {t('plans.loading')}
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {sub && !loading && (
          <div className="space-y-8">
            {quota && (
              <StorageQuotaDashboard
                quota={quota}
                deviceCount={sub.deviceCount}
                onUpgrade={scrollToPlans}
              />
            )}

            {sub.status === 'expired' && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50">
                <p className="text-sm font-semibold text-red-700">{t('plans.expiredTitle')}</p>
                <p className="text-xs text-red-600 mt-1">{t('plans.expiredMsg')}</p>
              </div>
            )}

            <div ref={planSectionRef}>
              <PlanSelector
                currentPlan={sub.plan}
                currentQuotaBytes={sub.storageLimitBytes}
              />
            </div>

            {sub.status === 'trial' && (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50">
                <p className="text-sm font-medium text-blue-700">
                  {t('plans.trialInfo', {
                    days: sub.daysRemaining,
                    date: sub.trialExpiresAt ? new Date(sub.trialExpiresAt).toLocaleDateString() : '',
                  })}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
