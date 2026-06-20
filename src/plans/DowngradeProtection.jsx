import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

function fmtBytes(n) {
  if (n >= 1099511627776) return `${(n / 1099511627776).toFixed(2)} TB`;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${n} B`;
}

export default function DowngradeProtection({ currentUsageBytes, newQuotaBytes, currentTier, newTier, onCancel, onDeleteData }) {
  const { t } = useI18n();

  if (!newQuotaBytes || currentUsageBytes <= newQuotaBytes) return null;

  const overageBytes = currentUsageBytes - newQuotaBytes;
  const pct = newQuotaBytes > 0 ? Math.min((currentUsageBytes / newQuotaBytes) * 100, 100) : 100;

  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <svg className="w-6 h-6 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-red-800 mb-1">
            {t('downgrade.title')}
          </h3>
          <p className="text-sm text-red-700 mb-3">
            {t('downgrade.message', {
              used: fmtBytes(currentUsageBytes),
              limit: fmtBytes(newQuotaBytes),
            })}
          </p>

          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-red-600">
                {fmtBytes(currentUsageBytes)} / {fmtBytes(newQuotaBytes)}
              </span>
              <span className="text-xs font-bold text-red-700">{pct.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2.5 bg-red-200 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: '100%' }} />
            </div>
            <p className="text-xs text-red-500 mt-1">
              {t('downgrade.overage', { amount: fmtBytes(overageBytes) })}
            </p>
          </div>

          {currentTier && newTier && (
            <div className="flex items-center gap-3 text-xs mb-4 bg-red-100 rounded-lg px-3 py-2">
              <span className="font-bold text-red-800">{currentTier}</span>
              <svg className="w-4 h-4 text-red-400" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-bold text-red-800">{newTier}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {onDeleteData && (
              <button
                className="px-4 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                onClick={onDeleteData}
              >
                {t('downgrade.deleteData')}
              </button>
            )}
            {onCancel && (
              <button
                className="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors"
                onClick={onCancel}
              >
                {t('downgrade.keepPlan')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
