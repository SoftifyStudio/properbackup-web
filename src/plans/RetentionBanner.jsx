import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function RetentionBanner({ subscription, onRenew }) {
  const { t } = useI18n();

  if (!subscription) return null;

  const isExpired = subscription.status === 'expired' || subscription.status === 'trial_expired';
  const canRestore = subscription.canRestore !== false;
  const canUpload = subscription.canUpload === true;
  const retentionDeadline = subscription.dataRetentionDeadline;

  if (!isExpired) return null;

  const deadlineDate = retentionDeadline ? new Date(retentionDeadline) : null;
  const daysLeft = deadlineDate
    ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 shadow-md">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <svg className="w-6 h-6 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-amber-800 mb-1">
            {t('retention.title')}
          </h3>
          <p className="text-sm text-amber-700 mb-2">
            {deadlineDate
              ? t('retention.message', { date: deadlineDate.toLocaleDateString() })
              : t('retention.messageNoDate')}
          </p>

          <div className="flex items-center gap-4 text-xs mb-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-semibold ${
              canRestore
                ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                : 'bg-red-100 border-red-200 text-red-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${canRestore ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {canRestore ? t('retention.canRestore') : t('retention.cannotRestore')}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-semibold ${
              canUpload
                ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                : 'bg-red-100 border-red-200 text-red-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${canUpload ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {canUpload ? t('retention.canUpload') : t('retention.cannotUpload')}
            </span>
          </div>

          {daysLeft !== null && daysLeft <= 7 && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg mb-3">
              <p className="text-xs font-semibold text-red-700">
                {daysLeft === 0
                  ? t('retention.lastDay')
                  : t('retention.daysLeft', { days: daysLeft })}
              </p>
            </div>
          )}

          {onRenew && (
            <button
              className="px-5 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              onClick={onRenew}
            >
              {t('retention.renewNow')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
