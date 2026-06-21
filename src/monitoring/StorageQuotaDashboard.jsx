import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { fetchStorageQuota } from '../api/monitoringClient.js';
import { fetchSubscription } from '../api/bufferClient.js';

function fmtBytes(n) {
  if (n >= 1099511627776) return `${(n / 1099511627776).toFixed(2)} TB`;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function progressColor(pct) {
  if (pct >= 90) return { bar: 'bg-red-500', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
  if (pct >= 70) return { bar: 'bg-amber-500', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
  return { bar: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' };
}

function estimateDaysLeft(usedBytes, limitBytes, serverCount) {
  if (usedBytes <= 0 || limitBytes <= 0) return null;
  const remaining = limitBytes - usedBytes;
  if (remaining <= 0) return 0;
  const dailyGrowthEstimate = (usedBytes / 30) * Math.max(1, serverCount);
  if (dailyGrowthEstimate <= 0) return null;
  return Math.floor(remaining / dailyGrowthEstimate);
}

export default function StorageQuotaDashboard() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [quota, setQuota] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [q, sub] = await Promise.all([
        fetchStorageQuota(token),
        fetchSubscription(token),
      ]);
      setQuota(q);
      setSubscription(sub);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading && !quota) {
    return (
      <div className="flex items-center justify-center py-12 text-text4 text-sm">
        {t('quota.loading')}
      </div>
    );
  }

  if (error && !quota) {
    return (
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
    );
  }

  if (!quota) return null;

  const pct = Math.min(quota.usedPercent || 0, 100);
  const colors = progressColor(pct);
  const daysLeft = estimateDaysLeft(quota.usedBytes, quota.limitBytes, subscription?.serverCount || 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text1">{t('quota.title')}</h2>
          <p className="text-xs text-text4 mt-0.5">{t('quota.subtitle')}</p>
        </div>
        <button className="btn-ghost text-xs py-1.5 px-3" onClick={load} disabled={loading}>
          {loading ? '...' : t('quota.refresh')}
        </button>
      </div>

      {/* Main quota card */}
      <div className="bg-panel border border-border rounded-xl p-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="text-3xl font-bold text-text1">{fmtBytes(quota.usedBytes)}</span>
            <span className="text-lg text-text4 ml-1">/ {fmtBytes(quota.limitBytes)}</span>
          </div>
          <span className={`text-sm font-semibold ${colors.text}`}>{pct.toFixed(1)}%</span>
        </div>

        {/* Progress bar */}
        <div className={`w-full h-4 rounded-full ${colors.bg} overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
            style={{ width: `${Math.max(pct, 0.5)}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-text4">
          <span>{t('quota.remaining')}: {fmtBytes(quota.remainingBytes)}</span>
          <span>{t('quota.physicalBytes')}</span>
        </div>
      </div>

      {/* Warnings */}
      {quota.exceeded && (
        <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border border-red-200 rounded-xl">
          <svg className="w-6 h-6 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-sm font-semibold text-red-700">{t('quota.exceeded')}</div>
            <div className="text-xs text-red-600 mt-0.5">{t('quota.exceededHint')}</div>
          </div>
        </div>
      )}

      {pct >= 70 && pct < 90 && !quota.exceeded && (
        <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl">
          <svg className="w-6 h-6 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-sm font-semibold text-amber-700">{t('quota.nearLimit')}</div>
            <div className="text-xs text-amber-600 mt-0.5">
              {daysLeft !== null && daysLeft <= 30
                ? t('quota.daysEstimate', { count: daysLeft })
                : t('quota.nearLimitHint')}
            </div>
          </div>
        </div>
      )}

      {pct >= 90 && !quota.exceeded && (
        <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border border-red-200 rounded-xl">
          <svg className="w-6 h-6 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-sm font-semibold text-red-700">{t('quota.criticalLevel')}</div>
            <div className="text-xs text-red-600 mt-0.5">
              {daysLeft !== null
                ? t('quota.backupStopsIn', { count: daysLeft })
                : t('quota.criticalHint')}
            </div>
          </div>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-panel border border-border rounded-xl px-4 py-3">
          <div className="text-[11px] text-text4 font-medium uppercase">{t('quota.maxQuota')}</div>
          <div className="text-lg font-bold text-text1 mt-1">2 TB</div>
          <div className="text-xs text-text4 mt-0.5">{t('quota.growthInfo')}</div>
        </div>
        <div className="bg-panel border border-border rounded-xl px-4 py-3">
          <div className="text-[11px] text-text4 font-medium uppercase">{t('quota.devices')}</div>
          <div className="text-lg font-bold text-text1 mt-1">{t('quota.unlimited')}</div>
          <div className="text-xs text-text4 mt-0.5">{t('quota.devicesHint')}</div>
        </div>
      </div>
    </div>
  );
}
