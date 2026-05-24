import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE = bufferBaseUrl();

export default function EmailVerifyPage({ verifyToken }) {
  const { token, user, markEmailVerified } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState(verifyToken ? 'checking' : 'pending');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (!verifyToken) return;
    setStatus('checking');
    fetch(`${BASE}/auth/verify-email?token=${encodeURIComponent(verifyToken)}`)
      .then(r => {
        if (r.ok) {
          setStatus('verified');
          markEmailVerified();
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => setStatus('invalid'));
  }, [verifyToken, markEmailVerified]);

  const resend = useCallback(async () => {
    if (!token) return;
    setResendLoading(true);
    setResendMsg('');
    try {
      const res = await fetch(`${BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setResendMsg(t('emailVerify.resent'));
      } else {
        setResendMsg(t('emailVerify.invalidToken'));
      }
    } catch {
      setResendMsg(t('emailVerify.invalidToken'));
    } finally {
      setResendLoading(false);
    }
  }, [token, t]);

  if (status === 'checking') {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text2 text-sm">{t('emailVerify.checking')}</p>
        </div>
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="max-w-md w-full mx-auto p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text1 mb-2">{t('emailVerify.verified')}</h2>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="max-w-md w-full mx-auto p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text1 mb-2">{t('emailVerify.invalidToken')}</h2>
          <button
            onClick={resend}
            disabled={resendLoading}
            className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
          >
            {resendLoading ? t('emailVerify.resending') : t('emailVerify.resend')}
          </button>
          {resendMsg && <p className="mt-2 text-sm text-text3">{resendMsg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-surface">
      <div className="max-w-md w-full mx-auto p-8">
        <div className="rounded-xl border border-border bg-panel p-6 shadow-card text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text1 mb-2">{t('emailVerify.title')}</h2>
          <p className="text-sm text-text3 mb-6">
            {t('emailVerify.body', { email: user?.email || '' })}
          </p>
          <button
            onClick={resend}
            disabled={resendLoading}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
          >
            {resendLoading ? t('emailVerify.resending') : t('emailVerify.resend')}
          </button>
          {resendMsg && <p className="mt-3 text-sm text-emerald-600">{resendMsg}</p>}
        </div>
      </div>
    </div>
  );
}
