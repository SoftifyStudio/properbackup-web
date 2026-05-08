import React from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function TrialBadge() {
  const { trialDaysLeft, isTrialExpired, isTrialActive, subscriptionPlan } = useAuth();
  const { t } = useI18n();

  if (subscriptionPlan) return null;
  if (!isTrialActive && !isTrialExpired) return null;

  if (isTrialExpired) {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {t('trial.expiredShort')}
      </span>
    );
  }

  const urgent = trialDaysLeft <= 7;
  const critical = trialDaysLeft <= 2;

  const bg = critical ? 'bg-red-50 border-red-200' : urgent ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200';
  const text = critical ? 'text-red-700' : urgent ? 'text-amber-700' : 'text-blue-700';

  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded-md ${bg} border px-1.5 py-0.5 text-[10px] font-semibold ${text}`}>
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1"/>
        <path d="M6 3.5v3l1.5 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {t('trial.daysShort', { count: trialDaysLeft })}
    </span>
  );
}
