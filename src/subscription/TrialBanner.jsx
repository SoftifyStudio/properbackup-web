import React from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function TrialBanner({ onUpgrade }) {
  const { trialDaysLeft, isTrialExpired, isTrialActive, subscriptionPlan } = useAuth();
  const { t } = useI18n();

  if (subscriptionPlan) return null;
  if (!isTrialActive && !isTrialExpired) return null;

  const urgent = trialDaysLeft !== null && trialDaysLeft <= 7;
  const critical = trialDaysLeft !== null && trialDaysLeft <= 2;

  if (isTrialExpired) {
    return (
      <div className="shrink-0 mx-4 mt-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <svg className="w-5 h-5 text-red-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          <span className="text-red-700 font-medium">{t('trial.expired')}</span>
        </div>
        <button
          onClick={onUpgrade}
          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {t('trial.upgrade')}
        </button>
      </div>
    );
  }

  const bgClass = critical ? 'bg-amber-50 border-amber-300' : urgent ? 'bg-amber-50/60 border-amber-200' : 'bg-blue-50/60 border-blue-200';
  const textClass = critical ? 'text-amber-800' : urgent ? 'text-amber-700' : 'text-blue-700';
  const iconColor = critical ? 'text-amber-500' : urgent ? 'text-amber-400' : 'text-blue-400';

  return (
    <div className={`shrink-0 mx-4 mt-2 px-4 py-2.5 ${bgClass} border rounded-xl text-sm flex items-center justify-between gap-4`}>
      <div className="flex items-center gap-2.5">
        <svg className={`w-4.5 h-4.5 ${iconColor} shrink-0`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
        </svg>
        <span className={`${textClass} font-medium`}>
          {t('trial.daysLeft', { count: trialDaysLeft })}
        </span>
      </div>
      {urgent && (
        <button
          onClick={onUpgrade}
          className="px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {t('trial.upgrade')}
        </button>
      )}
    </div>
  );
}
