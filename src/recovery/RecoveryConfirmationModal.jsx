import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useRecoveryContext } from './RecoveryContext.jsx';
import { fetchRecoverySession } from '../api/recoveryClient.js';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '...';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`;
  return `~${(seconds / 3600).toFixed(1)}h`;
}

export default function RecoveryConfirmationModal({ session: initialSession, onClose }) {
  const { t } = useI18n();
  const { token } = useAuth();
  const { confirmRecovery } = useRecoveryContext();
  const [session, setSession] = useState(initialSession);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  // Poll session for dry run results
  useEffect(() => {
    if (!session?.id || !token) return;
    if (session.state !== 'REQUESTED' && session.state !== 'PLANNING' && session.state !== 'AWAITING_USER_CONFIRM') return;

    const poll = async () => {
      try {
        const data = await fetchRecoverySession(token, session.id);
        setSession(data);
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [session?.id, session?.state, token]);

  const hasDryRun = session?.dryRunFilesToRestore != null;
  const isWaiting = session?.state === 'REQUESTED' || session?.state === 'PLANNING';
  const canConfirm = session?.state === 'AWAITING_USER_CONFIRM' && acknowledged && hasDryRun;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmRecovery(session.id, false);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" data-testid="recovery-confirmation-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text1 font-bold text-lg">{t('recovery.mode.confirmModalTitle')}</h2>
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

        {isWaiting && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-text3 text-sm">{t('recovery.mode.phasePlanning')}</span>
          </div>
        )}

        {hasDryRun && (
          <>
            <p className="text-text3 text-sm mb-4">{t('recovery.mode.confirmModalIntro')}</p>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <svg className="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2v8m0 0l-3-3m3 3l3-3M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-sm">
                  <span className="font-semibold text-emerald-800">
                    {t('recovery.mode.confirmModalFilesToRestore', {
                      count: session.dryRunFilesToRestore ?? 0,
                      size: fmtBytes(session.dryRunTotalBytes ?? 0),
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                <svg className="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 20 20" fill="none">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div className="text-sm">
                  <span className="font-semibold text-red-800">
                    {t('recovery.mode.confirmModalFilesToDelete', {
                      count: session.dryRunFilesToDelete ?? 0,
                      size: '',
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-lg">
                <svg className="w-5 h-5 text-text4 shrink-0" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3a7 7 0 100 14 7 7 0 000-14z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-sm text-text2">
                  {t('recovery.mode.confirmModalFilesUnchanged', { count: session.dryRunFilesUnchanged ?? 0 })}
                </span>
              </div>

              {session.dryRunCriticalProtected > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600 shrink-0" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2l7 4v5c0 3.87-2.94 7.48-7 8-4.06-.52-7-4.13-7-8V6l7-4z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span className="text-sm text-blue-800">
                    {t('recovery.mode.confirmModalCriticalProtected', { count: session.dryRunCriticalProtected })}
                  </span>
                </div>
              )}

              {session.estimatedDurationSec > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-lg">
                  <svg className="w-5 h-5 text-text4 shrink-0" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-sm text-text2">
                    {t('recovery.mode.eta')}: {fmtDuration(session.estimatedDurationSec)}
                  </span>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-accent"
                data-testid="recovery-acknowledge-checkbox"
              />
              <span className="text-sm text-amber-800 leading-snug">
                {t('recovery.mode.confirmModalAcknowledge')}
              </span>
            </label>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button className="btn-ghost text-sm" onClick={onClose} disabled={confirming}>
            {t('recovery.mode.confirmModalReject')}
          </button>
          <button
            className="btn-primary text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleConfirm}
            disabled={!canConfirm || confirming}
            data-testid="recovery-confirm-button"
          >
            {confirming ? '...' : t('recovery.mode.confirmModalAccept')}
          </button>
        </div>
      </div>
    </div>
  );
}
