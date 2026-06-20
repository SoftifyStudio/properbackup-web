import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

function fmtBytes(n) {
  if (n >= 1099511627776) return `${(n / 1099511627776).toFixed(2)} TB`;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${n} B`;
}

function progressColor(pct) {
  if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
}

export default function StorageQuotaDashboard({ quota, deviceCount, onUpgrade }) {
  const { t } = useI18n();

  const usedBytes = quota?.storageUsedBytes ?? 0;
  const limitBytes = quota?.storageLimitBytes ?? 0;
  const pct = limitBytes > 0 ? Math.min((usedBytes / limitBytes) * 100, 100) : 0;
  const colors = progressColor(pct);

  const daysEstimate = useMemo(() => {
    if (!quota?.dailyGrowthBytes || quota.dailyGrowthBytes <= 0) return null;
    const remaining = Math.max(0, limitBytes - usedBytes);
    return Math.floor(remaining / quota.dailyGrowthBytes);
  }, [quota?.dailyGrowthBytes, limitBytes, usedBytes]);

  return (
    <div className="rounded-xl border border-border bg-panel p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-text1">{t('plans.storageQuota')}</h2>
        {pct >= 70 && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colors.bg}`}>
            <span className={colors.text}>
              {pct >= 90 ? t('plans.quotaCritical') : t('plans.quotaWarning')}
            </span>
          </span>
        )}
      </div>

      <div className="mb-2">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-sm text-text2">
            {t('plans.quotaUsed', { used: fmtBytes(usedBytes), limit: fmtBytes(limitBytes) })}
          </span>
          <span className={`text-sm font-semibold ${colors.text}`}>
            {pct.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        <div className="bg-surface rounded-lg px-3 py-2">
          <div className="text-[10px] text-text4 uppercase tracking-wide">{t('plans.physicalUsed')}</div>
          <div className="text-base font-bold text-text1 mt-0.5">{fmtBytes(usedBytes)}</div>
        </div>
        <div className="bg-surface rounded-lg px-3 py-2">
          <div className="text-[10px] text-text4 uppercase tracking-wide">{t('plans.quotaLimit')}</div>
          <div className="text-base font-bold text-text1 mt-0.5">{fmtBytes(limitBytes)}</div>
        </div>
        {daysEstimate !== null && (
          <div className="bg-surface rounded-lg px-3 py-2">
            <div className="text-[10px] text-text4 uppercase tracking-wide">{t('plans.estimatedDays')}</div>
            <div className={`text-base font-bold mt-0.5 ${daysEstimate < 7 ? 'text-red-600' : daysEstimate < 30 ? 'text-amber-600' : 'text-text1'}`}>
              ~{daysEstimate} {t('plans.days')}
            </div>
          </div>
        )}
      </div>

      {deviceCount != null && (
        <p className="text-xs text-text4 mt-3">
          {t('plans.unlimitedDevices', { count: deviceCount })}
        </p>
      )}

      {pct >= 70 && (
        <div className={`mt-4 p-3 rounded-lg border ${colors.bg}`}>
          <p className={`text-sm font-medium ${colors.text}`}>
            {pct >= 90
              ? t('plans.quotaCriticalMsg')
              : t('plans.quotaWarningMsg')}
          </p>
          {daysEstimate !== null && daysEstimate < 30 && (
            <p className={`text-xs mt-1 ${colors.text} opacity-80`}>
              {t('plans.backupStopsIn', { days: daysEstimate })}
            </p>
          )}
          {onUpgrade && (
            <button
              className="mt-2 px-4 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-lg transition-colors"
              onClick={onUpgrade}
            >
              {t('plans.upgradePlan')}
            </button>
          )}
        </div>
      )}

      {quota?.quotaGrowthPerMonth > 0 && (
        <p className="text-xs text-text4 mt-3">
          {t('plans.quotaGrows', { amount: fmtBytes(quota.quotaGrowthPerMonth) })}
        </p>
      )}
    </div>
  );
}
