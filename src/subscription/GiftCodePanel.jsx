import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { redeemGiftCode } from '../api/bufferClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function GiftCodePanel({ onRedeemed }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const handleRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t('giftCode.errorRequired'));
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const data = await redeemGiftCode(trimmed, token);
      setSuccess(data);
      setCode('');
      if (onRedeemed) onRedeemed(data);
    } catch (e) {
      if (e.status === 404 || e.code === 'invalid_code') {
        setError(t('giftCode.errorInvalid'));
      } else if (e.status === 409 || e.code === 'already_redeemed') {
        setError(t('giftCode.errorConflict'));
      } else {
        setError(t('giftCode.errorGeneric'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-panel p-6 shadow-card">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
        <h3 className="text-base font-bold text-text1">{t('giftCode.title')}</h3>
      </div>
      <p className="text-sm text-text3 mb-4">{t('giftCode.description')}</p>

      {success && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-emerald-700 text-sm font-semibold">{t('giftCode.success')}</p>
          <p className="text-emerald-600 text-xs mt-1">
            {t('giftCode.activated', {
              plan: success.plan,
              date: new Date(success.expiresAt).toLocaleDateString(),
            })}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleRedeem(); }}
          placeholder={t('giftCode.placeholder')}
          disabled={loading}
          className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text1 placeholder:text-text4 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-50 font-mono tracking-wider"
        />
        <button
          onClick={handleRedeem}
          disabled={loading || !code.trim()}
          className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? t('giftCode.redeeming') : t('giftCode.redeem')}
        </button>
      </div>
    </div>
  );
}
