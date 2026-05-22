import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { validatePromoCode } from '../api/bufferClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function PromoCodePanel({ onValidated }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { valid, code, type, discountPercent, discountGrosze, reason }

  const handleValidate = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const data = await validatePromoCode(trimmed, token);
      setResult(data);
      if (onValidated) onValidated(data);
    } catch {
      setResult({ valid: false, reason: 'network_error' });
      if (onValidated) onValidated(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    setCode(e.target.value.toUpperCase());
    if (result) {
      setResult(null);
      if (onValidated) onValidated(null);
    }
  };

  const discountLabel = () => {
    if (!result?.valid) return null;
    if (result.discountPercent) return `-${result.discountPercent}%`;
    if (result.discountGrosze) return `-${(result.discountGrosze / 100).toFixed(2)} PLN`;
    return null;
  };

  const reasonText = () => {
    if (!result || result.valid) return null;
    switch (result.reason) {
      case 'not_found_or_expired': return t('promoCode.errorInvalid');
      case 'not_eligible_first_order': return t('promoCode.errorFirstOrder');
      case 'already_used_by_user': return t('promoCode.errorAlreadyUsed');
      case 'network_error': return t('promoCode.errorNetwork');
      default: return t('promoCode.errorGeneric');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-panel p-6 shadow-card">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <h3 className="text-base font-bold text-text1">{t('promoCode.title')}</h3>
      </div>
      <p className="text-sm text-text3 mb-4">{t('promoCode.description')}</p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={code}
            onChange={handleCodeChange}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading && code.trim()) handleValidate(); }}
            placeholder={t('promoCode.placeholder')}
            disabled={loading}
            className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-surface text-text1 placeholder:text-text4 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent font-mono tracking-wider pr-10 ${
              loading ? 'opacity-50 border-border' :
              result?.valid === true ? 'border-emerald-400' :
              result?.valid === false ? 'border-red-400' :
              'border-border'
            }`}
          />
          {/* Status icons */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loading && (
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            )}
            {!loading && result?.valid === true && (
              <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {!loading && result?.valid === false && (
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
        <button
          onClick={handleValidate}
          disabled={loading || !code.trim()}
          className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' :
            'bg-accent hover:bg-accent/90 text-white disabled:opacity-50'
          }`}
        >
          {loading ? t('promoCode.checking') : t('promoCode.check')}
        </button>
      </div>

      {/* Valid code info */}
      {result?.valid && (
        <div className="mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-emerald-700 text-sm font-semibold">
            {t('promoCode.validMessage', { code: result.code, discount: discountLabel() })}
          </p>
        </div>
      )}

      {/* Invalid code message */}
      {result && !result.valid && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{reasonText()}</p>
        </div>
      )}
    </div>
  );
}
