import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { downloadObject } from '../api/bufferClient.js';
import { verifyPassword, BadPasswordError } from '../crypto/headerVerify.js';
import { decryptAndDownload } from '../crypto/streamingDecrypt.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import ThawProgress from './ThawProgress.jsx';

/**
 * Recovery for an object missing from paths.idx (orphan). User sees base62 ID only.
 */
export default function OrphanRecovery({ snap, onClose }) {
  const { t } = useI18n();
  const { token } = useAuth();
  const [step, setStep] = useState('password');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleThawDone = async () => {
    setStep('downloading');
    try {
      const buf = await downloadObject(snap.raw, token);
      await decryptAndDownload(password, buf, snap.raw.replace('.enc', '.tar.gz'));
      setStep('done');
    } catch (e) {
      setError(e.message);
      setStep('error');
    }
  };

  const handleVerify = async () => {
    if (!password) {
      setError(t('recovery.common.enterPassword'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const buf = await downloadObject(snap.raw, token);
      await verifyPassword(password, buf);
      setStep('thaw');
    } catch (e) {
      if (e instanceof BadPasswordError) {
        setError(t('recovery.common.badPasswordProp'));
      } else {
        setError(t('recovery.common.genericError', { message: e.message }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-warnLight flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-warn" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-text1 font-bold text-base">{t('recovery.orphan.title')}</h2>
              <p className="text-text3 text-xs">
                {t('recovery.orphan.pathUnknown')}{' '}
                <span className="font-mono text-accent">{snap.pathId}</span>
              </p>
            </div>
          </div>
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

        <div className="bg-surface rounded-lg px-4 py-3 mb-5 text-xs font-mono text-text3 break-all">
          {snap.raw}
        </div>

        {step === 'password' && (
          <div>
            <p className="text-text2 text-sm mb-4">{t('recovery.orphan.intro')}</p>
            <label className="block text-text2 text-sm font-medium mb-1.5">{t('recovery.common.encryptionPassword')}</label>
            <input
              type="password"
              className="input mb-3"
              placeholder={t('recovery.common.passwordPlaceholder')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              autoFocus
            />
            {error && <p className="text-danger text-xs mb-3">{error}</p>}
            <div className="flex gap-3">
              <button type="button" className="btn-primary" onClick={handleVerify} disabled={loading}>
                {loading ? t('recovery.orphan.verifying') : t('recovery.orphan.verifyDownload')}
              </button>
              <button type="button" className="btn-ghost" onClick={onClose}>
                {t('recovery.common.cancel')}
              </button>
            </div>
          </div>
        )}

        {step === 'thaw' && <ThawProgress onReady={handleThawDone} mockMode={true} />}

        {step === 'downloading' && (
          <div className="flex items-center gap-3 text-text3 text-sm py-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
            {t('recovery.orphan.decryptDownloadBusy')}
          </div>
        )}

        {step === 'done' && (
          <div className="bg-successLight border border-success/25 rounded-xl2 p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-success" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-success text-sm font-semibold">{t('recovery.common.downloadedDecrypted')}</p>
            </div>
            <p className="text-text2 text-sm">{t('recovery.common.fileSaved')}</p>
          </div>
        )}

        {step === 'error' && (
          <div className="bg-dangerLight border border-danger/20 rounded-xl2 p-4">
            <p className="text-danger text-sm font-semibold mb-1">{t('recovery.common.decryptErrorTitle')}</p>
            <p className="text-text2 text-sm">{error}</p>
            <button
              type="button"
              className="btn-ghost mt-3 text-xs"
              onClick={() => {
                setStep('password');
                setError('');
              }}
            >
              {t('recovery.common.tryAgain')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
