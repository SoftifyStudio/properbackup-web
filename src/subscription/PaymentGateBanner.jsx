import React from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export function usePaymentGate() {
  const { subscriptionPlan, isSystemAdmin } = useAuth();
  return !isSystemAdmin && !subscriptionPlan;
}

export default function PaymentGateBanner({ onGoToSubscription }) {
  const { t } = useI18n();
  const gated = usePaymentGate();

  if (!gated) return null;

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 5H2v5a2 2 0 002 2h12a2 2 0 002-2V9zm-6 2a1 1 0 100 2h2a1 1 0 100-2h-2z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-amber-900">{t('paymentGate.title')}</h3>
          <p className="mt-1 text-sm text-amber-800">{t('paymentGate.description')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90"
              onClick={onGoToSubscription}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 5H2v5a2 2 0 002 2h12a2 2 0 002-2V9zm-6 2a1 1 0 100 2h2a1 1 0 100-2h-2z"
                  clipRule="evenodd"
                />
              </svg>
              {t('paymentGate.actionSubscription')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
