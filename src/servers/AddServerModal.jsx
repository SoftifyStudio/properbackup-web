import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { boldPartsReact } from '../i18n/bold.jsx';

const BASE_URL = bufferBaseUrl();

export default function AddServerModal({ onClose, onAdded }) {
  const { token, isSystemAdmin } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState('form');
  const [name, setName] = useState('');
  const [activationToken, setActivationToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [users, setUsers] = useState([]);
  const [forUserId, setForUserId] = useState('');

  useEffect(() => {
    if (!isSystemAdmin || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSystemAdmin, token]);

  const generate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('addServer.nameRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body =
        isSystemAdmin && forUserId ? JSON.stringify({ forUserId }) : '{}';
      const res = await fetch(`${BASE_URL}/servers/generate-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setActivationToken(data.token);
      setStep('token');
      onAdded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const instructionText = () => t('addServer.clipboardBody', { token: activationToken });

  const copy = () => {
    navigator.clipboard.writeText(instructionText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-text1 font-bold text-base">{t('addServer.title')}</h2>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text3 hover:bg-surface transition-colors"
            onClick={onClose}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {step === 'form' && (
          <form onSubmit={generate}>
            <p className="text-text3 text-sm mb-5">{t('addServer.intro')}</p>
            {isSystemAdmin && users.length > 0 && (
              <div className="mb-5">
                <label className="block text-text2 text-sm font-medium mb-1.5">{t('addServer.tokenForAccount')}</label>
                <select className="input" value={forUserId} onChange={e => setForUserId(e.target.value)}>
                  <option value="">{t('addServer.tokenForSelf')}</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
                <p className="text-text4 text-[11px] mt-1.5">{t('addServer.adminHint')}</p>
              </div>
            )}
            <div className="mb-5">
              <label className="block text-text2 text-sm font-medium mb-1.5">{t('addServer.nameLabel')}</label>
              <input
                type="text"
                className="input"
                placeholder={t('addServer.namePlaceholder')}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
              {error && <p className="text-danger text-xs mt-2">{error}</p>}
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? t('addServer.generating') : t('addServer.generate')}
              </button>
              <button type="button" className="btn-ghost" onClick={onClose}>
                {t('addServer.cancel')}
              </button>
            </div>
          </form>
        )}

        {step === 'token' && (
          <div>
            <div className="bg-successLight border border-success/25 rounded-xl2 p-4 mb-5">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-success" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-success text-sm font-semibold">{t('addServer.tokenReadyTitle')}</p>
              </div>
              <p className="text-text2 text-sm">{t('addServer.tokenReadyBody')}</p>
            </div>

            <p className="text-text2 text-sm font-medium mb-1">{t('addServer.keyHeading')}</p>
            <div className="bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm font-semibold text-text1 mb-4 tracking-wide">
              {activationToken}
            </div>

            <p className="text-text2 text-sm font-medium mb-2">{t('addServer.cliGui')}</p>
            <div className="bg-surface border border-border rounded-lg px-4 py-3 font-mono text-xs text-text2 mb-2 break-all">
              java -jar properbackup-agent.jar --gui
            </div>
            <p className="text-text4 text-[11px] mb-3">
              {t('addServer.jarNote')} <span className="font-mono">original-….jar</span>. {t('addServer.macNote')}
            </p>
            <p className="text-text2 text-sm font-medium mb-2">{t('addServer.cliAlt')}</p>
            <div className="bg-surface border border-border rounded-lg px-4 py-3 font-mono text-xs text-text2 mb-3 break-all">
              java -jar properbackup-agent.jar --activate {activationToken}
            </div>
            <button type="button" className="btn-ghost text-xs mb-5" onClick={copy}>
              {copied ? t('addServer.copied') : t('addServer.copyInstructions')}
            </button>

            <div className="bg-accentLight border border-accent/20 rounded-xl2 p-3 mb-5">
              <p className="text-accent text-xs leading-relaxed">{boldPartsReact(t('addServer.afterNoteRich'))}</p>
            </div>

            <button type="button" className="btn-primary" onClick={onClose}>
              {t('addServer.done')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
