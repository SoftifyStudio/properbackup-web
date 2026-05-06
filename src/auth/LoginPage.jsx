import React, { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import LanguageMenu from '../layout/LanguageMenu.jsx';

const BASE_URL = bufferBaseUrl();

export default function LoginPage({ onRegister }) {
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t('loginPage.fillAll'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setError(msg || t('loginPage.loginFailed'));
        return;
      }
      const data = await res.json();
      login(data);
    } catch (e) {
      setError(t('loginPage.networkError', { message: e.message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col relative">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <LanguageMenu />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 16 16" fill="none">
                <path d="M2 5a2 2 0 012-2h3l1.5 1.5H12a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" fill="currentColor"/>
              </svg>
            </div>
            <span className="text-text1 font-bold text-xl">ProperBackup</span>
          </div>

          <div className="bg-panel rounded-xl2 shadow-card p-6">
            <h1 className="text-text1 font-semibold text-base mb-1">{t('loginPage.title')}</h1>
            <p className="text-text3 text-sm mb-5">{t('loginPage.subtitle')}</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-text2 text-sm font-medium mb-1.5">{t('loginPage.emailLabel')}</label>
                <input
                  type="email"
                  className="input"
                  placeholder={t('loginPage.emailPlaceholder')}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-text2 text-sm font-medium mb-1.5">{t('loginPage.passwordLabel')}</label>
                <input
                  type="password"
                  className="input"
                  placeholder={t('loginPage.passwordPlaceholder')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-danger text-xs">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? t('loginPage.submitting') : t('loginPage.submit')}
              </button>
            </form>
          </div>

          <p className="text-center text-text4 text-xs mt-4">
            {t('loginPage.footerLead')}{' '}
            <button type="button" className="text-accent underline" onClick={onRegister}>
              {t('loginPage.createAccount')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
