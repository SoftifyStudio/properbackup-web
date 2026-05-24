import React, { useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE = bufferBaseUrl();

export default function PlanSelectionPage({ onCheckout }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [selected, setSelected] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/payment/checkout?plan=${selected}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (onCheckout) onCheckout(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, selected, onCheckout]);

  const features = [
    t('planSelection.features.storage'),
    t('planSelection.features.encryption'),
    t('planSelection.features.restore'),
    t('planSelection.features.budgetGuard'),
    t('planSelection.features.auditReport'),
  ];

  return (
    <div className="h-full flex items-center justify-center bg-surface overflow-y-auto">
      <div className="max-w-lg w-full mx-auto p-6">
        <h2 className="text-xl font-bold text-text1 text-center mb-2">{t('planSelection.title')}</h2>
        <p className="text-xs text-text3 text-center mb-6 leading-relaxed max-w-sm mx-auto">
          {t('planSelection.trialDisclaimer')}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Monthly */}
          <button
            type="button"
            onClick={() => setSelected('monthly')}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              selected === 'monthly'
                ? 'border-accent bg-accent/5 shadow-md'
                : 'border-border bg-panel hover:border-text4'
            }`}
          >
            <div className="text-sm font-bold text-text1 mb-1">{t('planSelection.monthly')}</div>
            <div className="text-lg font-extrabold text-accent">{t('planSelection.monthlyPrice')}</div>
          </button>

          {/* Annual */}
          <button
            type="button"
            onClick={() => setSelected('annual')}
            className={`rounded-xl border-2 p-4 text-left transition-all relative ${
              selected === 'annual'
                ? 'border-accent bg-accent/5 shadow-md'
                : 'border-border bg-panel hover:border-text4'
            }`}
          >
            <div className="text-sm font-bold text-text1 mb-1">{t('planSelection.annual')}</div>
            <div className="text-lg font-extrabold text-accent">{t('planSelection.annualPrice')}</div>
            <span className="absolute top-2 right-2 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
              {t('planSelection.annualSave')}
            </span>
          </button>
        </div>

        {/* Features */}
        <div className="rounded-xl border border-border bg-panel p-4 mb-6">
          <ul className="space-y-2">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-text2">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            {error}
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full py-3 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : t('planSelection.selectPlan', { plan: selected === 'annual' ? t('planSelection.annual') : t('planSelection.monthly') })}
        </button>
      </div>
    </div>
  );
}
