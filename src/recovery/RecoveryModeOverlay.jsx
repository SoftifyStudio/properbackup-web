import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useRecoveryContext } from './RecoveryContext.jsx';
import useRecoverySession from '../hooks/useRecoverySession.js';
import RecoveryProgressCard from './RecoveryProgressCard.jsx';
import RecoveryCancelModal from './RecoveryCancelModal.jsx';
import RecoveryConfirmationModal from './RecoveryConfirmationModal.jsx';
import ThawProgress from './ThawProgress.jsx';

export default function RecoveryModeOverlay({ serverId }) {
  const { t } = useI18n();
  const { token } = useAuth();
  const { recoveryForServer, updateSession } = useRecoveryContext();
  const contextSession = recoveryForServer(serverId);
  const sessionId = contextSession?.id || null;

  // Direct polling + SSE merge via useRecoverySession for real-time progress
  const { session: polledSession } = useRecoverySession(sessionId, token, null);

  // Merge: polled data takes precedence for freshest state
  const session = polledSession || contextSession;

  // Push polled updates back to context so other components see them
  const prevPolledRef = useRef(null);
  useEffect(() => {
    if (polledSession && polledSession !== prevPolledRef.current) {
      prevPolledRef.current = polledSession;
      updateSession(polledSession);
    }
  }, [polledSession, updateSession]);

  const [showCancel, setShowCancel] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss terminal states after 10s
  useEffect(() => {
    if (!session) return;
    if (['DONE', 'FAILED', 'CANCELLED'].includes(session.state)) {
      const timer = setTimeout(() => setDismissed(true), 10000);
      return () => clearTimeout(timer);
    }
    setDismissed(false);
  }, [session?.state]);

  if (!session || dismissed) return null;

  const isTerminal = ['DONE', 'FAILED', 'CANCELLED'].includes(session.state);
  const canCancel = !isTerminal && session.state !== 'VERIFYING';
  const needsConfirm = session.state === 'AWAITING_USER_CONFIRM';

  // Auto-show confirmation modal when dry run is ready
  if (needsConfirm && !showConfirm && !minimized) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-40 pointer-events-none" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[600px] max-w-[90vw]">
          <div className="bg-panel rounded-xl2 shadow-modal border-2 border-accent p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RecoveryIcon />
                <h2 className="text-text1 font-bold text-lg">{t('recovery.mode.title')}</h2>
              </div>
            </div>
            <RecoveryProgressCard session={session} />
            <div className="flex gap-3 mt-4">
              <button
                className="btn-primary text-sm font-semibold"
                onClick={() => setShowConfirm(true)}
              >
                {t('recovery.mode.phaseAwaitingConfirm')}
              </button>
              {canCancel && (
                <button className="btn-ghost text-xs text-red-600" onClick={() => setShowCancel(true)}>
                  {t('recovery.mode.cancel')}
                </button>
              )}
            </div>
          </div>
        </div>
        {showConfirm && (
          <RecoveryConfirmationModal session={session} onClose={() => setShowConfirm(false)} />
        )}
        {showCancel && (
          <RecoveryCancelModal session={session} onClose={() => setShowCancel(false)} />
        )}
      </>
    );
  }

  return (
    <>
      {/* Backdrop: dim but allow tab navigation */}
      {!minimized && <div className="fixed inset-0 bg-black/40 z-40 pointer-events-none" />}

      {/* Center panel */}
      <div className={`fixed z-50 ${
        minimized
          ? 'bottom-4 right-4 w-72'
          : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-w-[90vw]'
      }`}>
        <div className="bg-panel rounded-xl2 shadow-modal border-2 border-accent p-6" data-testid="recovery-mode-overlay" data-recovery-state={session.state}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RecoveryIcon />
              <h2 className="text-text1 font-bold text-lg">
                {t('recovery.mode.title')}
              </h2>
            </div>
            <button
              onClick={() => setMinimized(!minimized)}
              className="btn-ghost text-xs"
            >
              {minimized ? t('recovery.mode.expand') : t('recovery.mode.minimize')}
            </button>
          </div>

          {!minimized && <RecoveryProgressCard session={session} />}

          {/* ThawProgress: shown when state is THAWING (cold tier) */}
          {!minimized && session.state === 'THAWING' && (
            <div className="mt-3" data-testid="thaw-progress">
              {session.coldTier ? (
                <ThawProgress mockMode={false} />
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                  <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="font-medium">{t('recovery.mode.thawingLocalInstant')}</span>
                </div>
              )}
            </div>
          )}

          {minimized && (
            <div className="text-xs text-text3">
              {session.state === 'AGENT_RESTORING'
                ? `${session.filesRestored ?? 0} / ${session.dryRunFilesToRestore ?? '?'} files`
                : session.state}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            {canCancel && (
              <button
                onClick={() => setShowCancel(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-xs shadow transition-all"
                data-testid="recovery-cancel-button"
              >
                {t('recovery.mode.cancel')}
              </button>
            )}
            {!minimized && (
              <button onClick={() => setMinimized(true)} className="btn-ghost text-xs">
                {t('recovery.mode.hide')}
              </button>
            )}
          </div>
        </div>
      </div>

      {showCancel && (
        <RecoveryCancelModal session={session} onClose={() => setShowCancel(false)} />
      )}
      {showConfirm && (
        <RecoveryConfirmationModal session={session} onClose={() => setShowConfirm(false)} />
      )}
    </>
  );
}

function RecoveryIcon() {
  return (
    <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 12h3m12 0h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
