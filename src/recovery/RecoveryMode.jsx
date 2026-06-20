import React, { useState, useCallback } from 'react';
import { useRecovery } from './RecoveryContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import DryRunPreview from './DryRunPreview.jsx';
import RecoveryProgress from './RecoveryProgress.jsx';

export default function RecoveryMode() {
  const { t } = useI18n();
  const { session, error, loading, confirm, cancel, dismiss, isActive } = useRecovery();
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleConfirm = useCallback(() => {
    confirm();
  }, [confirm]);

  const handleCancel = useCallback(() => {
    setShowCancelModal(true);
  }, []);

  const confirmCancel = useCallback((reason) => {
    cancel(reason || 'User cancelled');
    setShowCancelModal(false);
  }, [cancel]);

  if (!session) return null;

  const isTerminal = ['DONE', 'FAILED', 'CANCELLED'].includes(session.state);
  const isAwaitingConfirm = session.state === 'AWAITING_USER_CONFIRM';
  const isRestoring = ['AGENT_RESTORING', 'VERIFYING'].includes(session.state);
  const isPreRestore = ['REQUESTED', 'PLANNING', 'THAWING', 'READY'].includes(session.state);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" viewBox="0 0 20 20" fill="none">
                  <path d="M4 4v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 9a7 7 0 1113.58 2.48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2 className="text-text1 font-bold text-lg">{t('recovery.mode.title')}</h2>
                <p className="text-text4 text-xs">{session.serverId}</p>
              </div>
            </div>
            {isTerminal && (
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text3 hover:bg-surface transition-colors"
                onClick={dismiss}
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-dangerLight border border-danger/20 rounded-xl2 p-3 mb-4 text-sm text-danger">
                {error}
              </div>
            )}

            {isPreRestore && (
              <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                {t('recovery.mode.preparing')}
              </div>
            )}

            {isAwaitingConfirm && (
              <DryRunPreview
                session={session}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                loading={loading}
              />
            )}

            {(isRestoring || isTerminal) && (
              <RecoveryProgress
                session={session}
                onCancel={handleCancel}
                loading={loading}
              />
            )}
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-md p-6">
            <h3 className="text-text1 font-bold text-base mb-2">{t('recovery.mode.cancelTitle')}</h3>
            <p className="text-text2 text-sm mb-4">{t('recovery.mode.cancelWarning')}</p>
            {isRestoring && (
              <div className="bg-warnLight border border-warn/20 rounded-xl2 p-3 mb-4 text-xs text-warn">
                {t('recovery.mode.cancelRollbackWarning')}
              </div>
            )}
            <div className="flex gap-3">
              <button
                className="btn-primary bg-danger hover:bg-danger/90 text-sm py-2.5 px-5"
                onClick={() => confirmCancel()}
                disabled={loading}
              >
                {loading ? t('recovery.mode.cancelling') : t('recovery.mode.confirmCancel')}
              </button>
              <button
                className="btn-ghost text-sm py-2.5 px-4"
                onClick={() => setShowCancelModal(false)}
              >
                {t('recovery.mode.keepRestoring')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
