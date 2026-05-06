import React, { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE_URL = bufferBaseUrl();

export default function ServiceAdminModal({ open, onClose }) {
  const { token, login } = useAuth();
  const { t } = useI18n();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!key.trim()) {
      setError(t('serviceAdminModal.errRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/auth/service-admin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serviceKey: key.trim() }),
      });
      const raw = await res.text();
      if (!res.ok) {
        setError(raw || t('serviceAdminModal.errFail'));
        return;
      }
      login(JSON.parse(raw));
      setKey('');
      onClose();
    } catch {
      setError(t('serviceAdminModal.errNetwork'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div
        className="bg-panel rounded-2xl shadow-modal max-w-md w-full p-6 border border-border animate-scale-in"
        role="dialog"
        aria-labelledby="svc-admin-title"
        aria-modal="true"
      >
        <h2 id="svc-admin-title" className="text-text1 font-bold text-lg mb-1">
          {t('serviceAdminModal.title')}
        </h2>
        <p className="text-text3 text-sm mb-5 leading-relaxed">{t('serviceAdminModal.body')}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-text2 text-sm font-medium mb-1.5">{t('serviceAdminModal.keyLabel')}</label>
            <input
              type="password"
              className="input"
              placeholder={t('serviceAdminModal.keyPlaceholder')}
              value={key}
              onChange={e => setKey(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
          {error && <p className="text-danger text-xs leading-relaxed">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? t('serviceAdminModal.submitBusy') : t('serviceAdminModal.submit')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setError(''); setKey(''); onClose(); }}>
              {t('serviceAdminModal.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
