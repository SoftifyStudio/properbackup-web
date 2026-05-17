import React, { useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE = bufferBaseUrl();

export default function PaymentSimulator({ orderData, onComplete, onBack }) {
  const { token } = useAuth();
  const { t, formatDateTime } = useI18n();
  const [method, setMethod] = useState('blik');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const simulate = useCallback(async () => {
    if (!token || !orderData?.orderId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/payment/simulate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: orderData.orderId, method }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, orderData, method]);

  if (result) {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="max-w-md w-full mx-auto p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text1 mb-2">{t('payment.success')}</h2>
          <p className="text-sm text-text3 mb-4">
            {t('payment.planActivated', {
              plan: result.plan === 'annual' ? t('planSelection.annual') : t('planSelection.monthly'),
              date: formatDateTime(result.expiresAt),
            })}
          </p>
          <button
            onClick={onComplete}
            className="px-6 py-2.5 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent/90"
          >
            {t('payment.backToPanel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-surface">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="rounded-xl border border-border bg-panel p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {t('payment.testMode')}
            </span>
          </div>

          <h2 className="text-lg font-bold text-text1 mb-1">{t('payment.title')}</h2>
          <p className="text-xs text-text3 mb-4">{t('payment.testModeHint')}</p>

          <div className="flex items-center justify-between mb-4 px-3 py-2 bg-surface rounded-lg">
            <span className="text-sm text-text2">{t('payment.orderId', { id: orderData?.orderId || '—' })}</span>
            <span className="text-sm font-bold text-text1">{orderData?.price || '—'} PLN</span>
          </div>

          {/* Payment method selection */}
          <div className="space-y-2 mb-6">
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${method === 'blik' ? 'border-accent bg-accent/5' : 'border-border hover:border-text4'}`}>
              <input type="radio" name="method" value="blik" checked={method === 'blik'} onChange={() => setMethod('blik')} className="accent-accent" />
              <span className="text-sm font-medium text-text1">{t('payment.methodBlik')}</span>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${method === 'transfer' ? 'border-accent bg-accent/5' : 'border-border hover:border-text4'}`}>
              <input type="radio" name="method" value="transfer" checked={method === 'transfer'} onChange={() => setMethod('transfer')} className="accent-accent" />
              <span className="text-sm font-medium text-text1">{t('payment.methodTransfer')}</span>
            </label>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              {error}
            </div>
          )}

          <button
            onClick={simulate}
            disabled={loading}
            className="w-full py-3 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? t('payment.simulating') : t('payment.simulatePayment')}
          </button>
        </div>
      </div>
    </div>
  );
}
